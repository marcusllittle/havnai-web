import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
import { useWallet } from "./WalletProvider";
import { ensureInjectedProvider } from "../lib/wallet";
import { recoverImport, signImport, submitImport, type ImportSnapshot, type ImportProof, type ImportReceipt } from "../lib/accountImport";

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;
type Item = { id: string; eligible: boolean; title?: string | null; type?: string; exclusion?: string | null };
interface Preview {
  jobs: Item[]; publications: Array<Item & { job_id: string }>; playlists: Item[];
  total: number; playlist_total: number; eligible_count: number; publication_selection_limit_exceeded: boolean;
  credits: { available_units: number | null; scale: number; exclusion: string | null };
}
interface Selection { job_ids: string[]; publication_ids: string[]; playlist_ids: string[]; include_credits: boolean }
interface Snapshot extends ImportSnapshot {
  id: string; jobs: Array<{ id: string }>; publications: Array<{ id: string; title: string }>;
  playlists: Array<{ id: string; title: string }>; credits: { available_units: number; scale: number } | null;
  expires_at: number;
}
const explanation: Record<string, string> = {
  job_not_final: "Still processing", active_listing: "Delist before importing",
  not_current_owner: "Now owned by someone else", already_account_owned: "Already belongs to an account",
  import_publication_selection_required: "Select every publication belonging to the selected creations, or deselect those creations.",
  import_selection_unavailable: "Ownership or availability changed. Reload the inventory and review a new selection.",
};
const credits = (units: number, scale: number) => (units / scale).toLocaleString(undefined, { maximumFractionDigits: 3 });

export function AccountImportReview({ link, request, onClose }: {
  link: { id: string; wallet: string }; request: Request; onClose: () => void;
}) {
  const account = useAccount();
  const wallet = useWallet();
  const [enabled, setEnabled] = useState(false);
  const [signed, setSigned] = useState(false);
  const [receipt, setReceipt] = useState<ImportReceipt | null>(null);
  const proof = useRef<ImportProof | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selection, setSelection] = useState<Selection>({ job_ids: [], publication_ids: [], playlist_ids: [], include_credits: false });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const pending = useRef<{ key: string; selection: Selection } | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const base = `/v2/account/wallet-links/${encodeURIComponent(link.id)}`;
  useEffect(() => { heading.current?.focus(); return () => active.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setPreview(null); setError("");
    account.request<Preview>(`${base}/import-preview?limit=50&offset=${page * 50}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setPreview(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load wallet content."); });
    return () => controller.abort();
  }, [account.request, base, page, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setEnabled(false);
    account.request<{ execution_enabled: boolean }>("/v2/account/import-capabilities", { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setEnabled(result.execution_enabled === true); })
      .catch(() => { /* Fail closed; inventory review remains available. */ });
    return () => controller.abort();
  }, [account.request, revision]);
  async function confirm(checkOnly = false) {
    if (active.current || !snapshot || !account.account || (!enabled && !checkOnly)) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      let result = await recoverImport(account.request, snapshot, controller.signal);
      if (!result && !checkOnly) {
        if (!proof.current) {
          const connected = wallet.connectedWallet || await wallet.connect();
          controller.signal.throwIfAborted();
          if (!connected) throw new Error("Choose the linked wallet address to continue.");
          const selected = await ensureInjectedProvider();
          controller.signal.throwIfAborted();
          if (!selected.provider) throw new Error("Enable your wallet extension to confirm this import.");
          proof.current = await signImport({ provider: selected.provider, snapshot, accountId: account.account.id,
            origin: window.location.origin, request, signal: controller.signal });
          controller.signal.throwIfAborted();
          setSigned(true);
        }
        result = await submitImport(request, snapshot, proof.current, controller.signal);
      }
      controller.signal.throwIfAborted();
      if (result) {
        setReceipt(result);
        await account.refresh().catch(() => undefined);
      } else setError("No completed import was found. You can retry this confirmation or check import history later.");
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not confirm the import. Check its result before starting another review.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (active.current === controller) active.current = null;
    }
  }
  function toggle(field: "job_ids" | "publication_ids" | "playlist_ids", id: string) {
    setSelection(value => ({ ...value, [field]: value[field].includes(id) ? value[field].filter(item => item !== id) : [...value[field], id] }));
  }
  async function prepare() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      if (!pending.current) pending.current = { key: crypto.randomUUID(), selection };
      setHasPending(true);
      const result = await request<Snapshot>(`${base}/import-snapshots`, { method: "POST", signal: controller.signal,
        headers: { "Idempotency-Key": pending.current.key }, body: JSON.stringify(pending.current.selection) });
      if (!controller.signal.aborted) { setSnapshot(result); pending.current = null; setHasPending(false); }
    } catch (reason) {
      if (!controller.signal.aborted) {
        const code = reason && typeof reason === "object" && "code" in reason ? String(reason.code) : "";
        setError(explanation[code] || (reason instanceof Error ? reason.message : "Could not prepare this review."));
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (active.current === controller) active.current = null;
    }
  }
  function startOver() {
    proof.current = null; setSigned(false); setReceipt(null);
    pending.current = null; setHasPending(false); setSnapshot(null); setError("");
    setSelection({ job_ids: [], publication_ids: [], playlist_ids: [], include_credits: false });
    setRevision(value => value + 1);
  }
  const locked = busy || hasPending;
  const hasSelection = selection.job_ids.length + selection.playlist_ids.length > 0 || selection.include_credits;
  function list(label: string, items: Item[], field: "job_ids" | "publication_ids" | "playlist_ids") {
    return <fieldset disabled={locked} style={{ minWidth: 0 }}><legend>{label}</legend>
      {items.length ? items.map(item => <label key={item.id} style={{ display: "block", overflowWrap: "anywhere", padding: "0.5rem 0" }}>
        <input type="checkbox" checked={selection[field].includes(item.id)} disabled={!item.eligible}
          onChange={() => toggle(field, item.id)} />{" "}{item.title || item.id}
        {!item.eligible && <span> — {explanation[item.exclusion || ""] || "Not eligible for this wallet"}</span>}
      </label>) : <p>None on this page.</p>}
    </fieldset>;
  }
  return <section aria-label="Review wallet content" className="account-summary-card">
    <h3 tabIndex={-1} ref={heading}>Review existing wallet content</h3>
    <p style={{ overflowWrap: "anywhere" }}>{link.wallet}</p>
    <p>Choose what you want to bring into your account. Reviewing does not open your wallet or move anything.</p>
    {snapshot ? <div role="status">
      <h4>Your selection is ready for review</h4>
      <p>{snapshot.jobs.length} creations, {snapshot.publications.length} publications, {snapshot.playlists.length} playlists.</p>
      {snapshot.jobs.map(job => <p key={job.id} style={{ overflowWrap: "anywhere" }}>{job.id}</p>)}
      {snapshot.publications.map(pub => <p key={pub.id}>{pub.title}</p>)}
      {snapshot.playlists.map(playlist => <p key={playlist.id}>{playlist.title}</p>)}
      <p>{snapshot.credits ? `${credits(snapshot.credits.available_units, snapshot.credits.scale)} credits selected.` : "No credits selected."}</p>
      <p>Review expires at {new Date(snapshot.expires_at * 1000).toLocaleTimeString()}.</p>
      {receipt ? <>
        <h4>Import complete</h4>
        <p>Your selected content and credits now belong to this account. Unlinking the wallet will not move them back.</p>
        <p style={{ overflowWrap: "anywhere" }}>Receipt: {receipt.receipt.id}</p>
      </> : <>
        {enabled ? <>
          <p>Confirm to move exactly this selection into your account. Unlinking the wallet will not undo the import. No blockchain tokens move.</p>
          <button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Checking import…" : signed ? "Retry import" : "Confirm import with wallet"}</button>
        </> : <p>Transfers are not available yet. No content or credits have moved through this review.</p>}
        {signed && <>
          <p>Your signed confirmation is kept only while this review is open. A lost response does not mean the import failed. Check import history if you close this review.</p>
          <button type="button" disabled={busy} onClick={() => void confirm(true)}>Check import result</button>
        </>}
      </>}
      <button type="button" disabled={busy || (signed && !receipt)} onClick={startOver}>Review a different selection</button>
    </div> : <>
      {preview ? <>
        <p>{preview.eligible_count} eligible creations of {preview.total}. {preview.playlist_total} playlists.</p>
        {list("Creations", preview.jobs, "job_ids")}
        {list("Song publications — select these with their creations", preview.publications, "publication_ids")}
        {preview.publication_selection_limit_exceeded && <p role="alert">There are too many publications on this page for one review. Select fewer creations.</p>}
        {list("Playlists", preview.playlists, "playlist_ids")}
        <label style={{ display: "block", padding: "1rem 0" }}><input type="checkbox" checked={selection.include_credits}
          disabled={locked || preview.credits.available_units === null || preview.credits.available_units === 0}
          onChange={event => setSelection(value => ({ ...value, include_credits: event.target.checked }))} />{" "}
          {preview.credits.available_units === null ? "Credit balance requires review" : `${credits(preview.credits.available_units, preview.credits.scale)} available credits`}
        </label>
        <p>Selected: {selection.job_ids.length} creations, {selection.publication_ids.length} publications, {selection.playlist_ids.length} playlists.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="button" disabled={locked || page === 0} onClick={() => setPage(value => value - 1)}>Previous page</button>
          <button type="button" disabled={locked || (page + 1) * 50 >= Math.max(preview.total, preview.playlist_total)} onClick={() => setPage(value => value + 1)}>Next page</button>
          <button type="button" disabled={busy || !hasSelection} onClick={() => void prepare()}>{busy ? "Preparing review…" : hasPending ? "Retry same review" : "Review selection"}</button>
          {hasPending && <button type="button" disabled={busy} onClick={startOver}>Start over</button>}
        </div>
      </> : !error && <p role="status">Loading wallet content…</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {!preview && error && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry inventory</button>}
    <button type="button" onClick={onClose} style={{ marginTop: "1rem" }}>Close review</button>
  </section>;
}
