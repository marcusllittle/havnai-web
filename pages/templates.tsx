import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Layers3, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { useWallet } from "../components/WalletProvider";
import { createWorkflow, fetchMarketplace, type Workflow } from "../lib/havnai";
import { isUsableWallet } from "../lib/wallet";

const categories = ["Image Generation", "Video Generation", "Face Swap", "Upscaling", "Style Transfer", "Other"];
const emptyDraft = { name: "", description: "", category: "Image Generation", model: "", prompt: "", negative: "", steps: "28", guidance: "6" };
const workflowHref = (id: string) => `/create?workflow=${encodeURIComponent(id)}`;

function TemplateDetails({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  const config = workflow.config || {};
  return <dialog ref={dialog} className="template-dialog" aria-labelledby="template-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="template-detail">
      <header><div><span className="product-eyebrow">Workflow template</span><h2 id="template-title">{workflow.name}</h2></div><button type="button" aria-label="Close template" onClick={onClose}><X size={21} aria-hidden="true" /></button></header>
      <p>{workflow.description || "A reusable starting point for your next creation."}</p>
      <dl>{[["Category", workflow.category || "Other"], ["Model", config.model || "Auto"], ["Steps", config.steps ?? "Model default"], ["Guidance", config.guidance ?? "Model default"]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>
      {config.prompt_template && <section><h3>Prompt template</h3><p className="template-prompt">{String(config.prompt_template)}</p></section>}
      {config.negative_prompt && <details><summary>Negative prompt</summary><p className="template-prompt">{String(config.negative_prompt)}</p></details>}
      <section><h3>Creator</h3><p className="template-wallet">{workflow.creator_wallet}</p></section>
      <p className="template-hint">Review this template in Create, then apply it when you’re ready. Edit any placeholders before generating.</p>
      <Link href={workflowHref(workflow.id)} className="product-primary">Use this template <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
  </dialog>;
}

export default function TemplatesPage() {
  const wallet = useWallet();
  const [view, setView] = useState<"browse" | "create">("browse");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState<Workflow | null>(null);
  const identity = useRef(wallet.activeWallet);
  identity.current = wallet.activeWallet;
  const saveInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setSaved(null); setSaveError(""); }, [wallet.activeWallet]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError("");
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetchMarketplace({ search: query || undefined, category: category || undefined, offset: page * 12, limit: 12, signal: controller.signal })
      .then(result => {
        if (!Array.isArray(result.workflows) || !Number.isFinite(result.total)) throw new Error("Invalid catalog");
        if (active) { setItems(result.workflows); setTotal(result.total); }
      })
      .catch(() => { if (active) { setItems([]); setError("Templates couldn’t load. Try again in a moment."); } })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [query, category, page, revision]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const address = wallet.activeWallet;
    if (saveInFlight.current || !address || !isUsableWallet(address)) return;
    if (!draft.name.trim()) { setSaveError("Give your template a name."); return; }
    const steps = Number(draft.steps), guidance = Number(draft.guidance);
    if (!Number.isInteger(steps) || steps < 1 || steps > 100 || !Number.isFinite(guidance) || guidance < 1 || guidance > 30) { setSaveError("Use 1–100 steps and guidance between 1 and 30."); return; }
    saveInFlight.current = true; setSaving(true); setSaveError(""); setSaved(null);
    try {
      const result = await createWorkflow({ wallet: address, name: draft.name.trim(), description: draft.description.trim(), category: draft.category, config: { model: draft.model.trim() || "auto", prompt_template: draft.prompt.trim(), negative_prompt: draft.negative.trim(), steps, guidance } });
      if (mounted.current && identity.current === address) { setSaved(result); }
    } catch {
      if (mounted.current && identity.current === address) setSaveError("Your template couldn’t be saved. Your draft is still here; try again.");
    } finally { saveInFlight.current = false; if (mounted.current) setSaving(false); }
  };
  const update = (field: keyof typeof emptyDraft, value: string) => { setDraft(current => ({ ...current, [field]: value })); setSaved(null); };
  const hasWallet = !!wallet.activeWallet && isUsableWallet(wallet.activeWallet);
  return <>
    <SeoHead title="Workflow templates" description="Explore reusable creative setups and save a template for your next generation." path="/templates" noindex />
    <SiteHeader />
    <main className="product-page templates-page">
      <header className="templates-heading"><div><span className="product-eyebrow"><Layers3 size={14} aria-hidden="true" /> Creative starting points</span><h1>{view === "browse" ? "Skip the blank canvas." : "Keep a good idea."}</h1><p>{view === "browse" ? "Find a setup you like. Make it your own." : "A reusable starting point for your next creation."}</p></div>{view === "browse" && <button className="product-primary" type="button" onClick={() => setView("create")}><Plus size={16} aria-hidden="true" /> New template</button>}</header>
      <div className="templates-tabs" role="group" aria-label="Template views"><button type="button" aria-pressed={view === "browse"} onClick={() => setView("browse")}>Explore templates</button><button type="button" aria-pressed={view === "create"} onClick={() => setView("create")}>Your draft</button></div>
      {view === "browse" ? <>
        <div className="templates-toolbar"><label className="templates-search"><Search size={18} aria-hidden="true" /><input aria-label="Search templates" type="search" placeholder="Search for a style, scene, or idea" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="templates-category"><span>Category</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
        <div className="templates-result-heading"><h2>{category || "Explore the possibilities"}</h2><span>{loading ? "Loading…" : error ? "Unavailable" : `${total} templates`}</span></div>
        {loading ? <div className="templates-state" role="status"><Layers3 size={28} aria-hidden="true" /><h3>Finding your next starting point…</h3></div> : error ? <div className="templates-state" role="alert"><h3>We couldn’t reach the catalog.</h3><p>{error}</p><button className="product-secondary" type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : items.length === 0 ? <div className="templates-state"><Layers3 size={30} aria-hidden="true" /><h3>{query || category ? "No matching templates yet." : "A little room for inspiration."}</h3><p>{query || category ? "Try a different search or category." : "The shared catalog is empty. You can still save your own starting point."}</p>{query || category ? <button className="product-secondary" type="button" onClick={() => { setSearch(""); setQuery(""); setCategory(""); setPage(0); }}>Clear filters</button> : <button className="product-secondary" type="button" onClick={() => setView("create")}>Create a template</button>}</div> : <>
          <div className="templates-grid">{items.map(item => <button type="button" className="template-card" key={item.id} onClick={() => setSelected(item)}><div className="template-card-top"><Layers3 size={24} aria-hidden="true" /><span>{item.category || "Other"}</span></div><h3>{item.name}</h3><p>{item.description || "A reusable setup, ready for your own direction."}</p><div className="template-card-model">{String(item.config?.model || "Auto model")}</div><div className="template-card-bottom"><span>{item.usage_count || 0} uses</span><strong>View template <ArrowRight size={15} aria-hidden="true" /></strong></div></button>)}</div>
          {total > 12 && <nav className="templates-pagination" aria-label="Template pages"><button type="button" className="product-secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(total / 12)}</span><button type="button" className="product-secondary" disabled={(page + 1) * 12 >= total} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
        </>}
      </> : <div className="template-compose"><aside><span className="product-eyebrow">Keep a good idea close</span><h2>A setup worth coming back to.</h2><p>Save the prompt and settings you want to reuse. You can review the template in Create before generating.</p><div><SlidersHorizontal size={22} aria-hidden="true" /><p>Shared publishing is limited in the Public Alpha. Saving a draft does not publish it to the catalog.</p></div></aside><form onSubmit={save}><h2>Your template</h2><fieldset disabled={saving}><label>Name<input required maxLength={160} value={draft.name} onChange={e => update("name", e.target.value)} placeholder="Golden-hour portraits" /></label><label>Description<textarea rows={2} maxLength={2000} value={draft.description} onChange={e => update("description", e.target.value)} placeholder="What makes this setup useful?" /></label><label>Category<select value={draft.category} onChange={e => update("category", e.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label>Prompt template<textarea rows={5} maxLength={4000} value={draft.prompt} onChange={e => update("prompt", e.target.value)} placeholder="An editorial portrait of {subject}, warm afternoon light…" /></label><p className="template-hint">Use placeholders such as {"{subject}"} to remind yourself what to edit.</p><details className="template-settings"><summary>Model &amp; generation settings</summary><label>Model<input value={draft.model} maxLength={200} onChange={e => update("model", e.target.value)} placeholder="Auto: choose from available models" /></label><label>Negative prompt<textarea rows={2} maxLength={4000} value={draft.negative} onChange={e => update("negative", e.target.value)} placeholder="What should the result avoid?" /></label><div className="template-number-fields"><label>Steps<input type="number" required min={1} max={100} value={draft.steps} onChange={e => update("steps", e.target.value)} /></label><label>Guidance<input type="number" required min={1} max={30} step={0.5} value={draft.guidance} onChange={e => update("guidance", e.target.value)} /></label></div></details></fieldset>
        {saveError && <p className="template-error" role="alert">{saveError}</p>}
        {saved && <div className="template-saved" role="status"><strong>“{saved.name}” is saved.</strong><Link href={workflowHref(saved.id)}>Review in Create <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
        {hasWallet ? <button className="product-primary" type="submit" disabled={saving || !!saved}>{saving ? "Saving…" : saved ? "Saved" : "Save template"}</button> : <><p className="template-hint">Connect a wallet to save this template to your account.</p><button className="product-primary" type="button" disabled={wallet.connecting} onClick={() => { void wallet.connect().catch(() => setSaveError("Wallet connection didn’t finish. Try again.")); }}>{wallet.connecting ? "Connecting…" : "Connect wallet"}</button></>}
      </form></div>}
      <footer className="templates-footer"><p>Templates are starting points. Results depend on the model and available capacity.</p><Link href="/create">Start from scratch <ArrowUpRight size={15} aria-hidden="true" /></Link></footer>
      {selected && <TemplateDetails workflow={selected} onClose={() => setSelected(null)} />}
    </main>
  </>;
}
