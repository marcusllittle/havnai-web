import { useEffect, useRef, useState } from "react";
import type { AccountStudioAccess } from "../lib/musicStudioApi";
import type { V1Job } from "../lib/videoStudioApi";
import { creditUnits, marketCredits, pendingMarketIntent, submitMarketIntent, type MarketResult } from "../lib/accountMarketplace";

export function AccountListingForm({ account, jobId, request, initialTitle = "", initialPrice = "1", onComplete, onClose, onPendingChange }: {
  account: string; jobId: string; request: AccountStudioAccess["request"]; initialTitle?: string; initialPrice?: string;
  onComplete: (result: MarketResult) => void; onClose: () => void; onPendingChange: () => void;
}) {
  const [job, setJob] = useState<V1Job | null>(null); const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(initialTitle); const [price, setPrice] = useState(initialPrice);
  const [description, setDescription] = useState(""); const [category, setCategory] = useState(""); const [artifact, setArtifact] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof pendingMarketIntent>>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const operation = useRef(false); const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const active = new AbortController(); controller.current = active;
    heading.current?.focus(); setLoading(true); setError("");
    try { setPending(pendingMarketIntent(sessionStorage, account)); }
    catch (reason) { setRecoveryBlocked(true); setError(reason instanceof Error ? reason.message : "Could not recover your request."); }
    void request<V1Job>(`/v2/jobs/${encodeURIComponent(jobId)}`, { signal: active.signal }).then(value => {
      if (active.signal.aborted) return;
      if (value.id !== jobId || value.owner_account_id !== account) throw new Error("This creation does not belong to your account.");
      if (value.status !== "succeeded" || !["image", "image_gen"].includes(value.type || "")) throw new Error("Only completed image generations can be listed.");
      const images = value.artifacts.filter(item => item.kind === "image" && /^[a-zA-Z0-9_-]{1,128}$/.test(item.id));
      if (!images.length) throw new Error("No image output is available for this creation.");
      setJob({ ...value, artifacts: images }); setArtifact(images[0].id);
    }).catch(reason => { if (!active.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load this creation."); })
      .finally(() => { if (!active.signal.aborted) setLoading(false); });
    return () => active.abort();
  }, [account, jobId, request]);

  const retry = pending?.kind === "list" && pending.body.job_id === jobId;
  const submit = async () => {
    if (!controller.current || operation.current || recoveryBlocked || (!job && !retry)) return;
    const signal = controller.current.signal; operation.current = true; setBusy(true); setError("");
    try {
      const result = await submitMarketIntent(sessionStorage, account, { request, signal }, retry ? undefined : {
        kind: "list", body: { job_id: jobId, artifact_id: artifact, title: title.trim(), price_units: creditUnits(price), description: description.trim(), category: category.trim() },
      });
      signal.throwIfAborted(); onComplete(result);
    } catch (reason) {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : "Could not publish this listing.");
    } finally {
      operation.current = false;
      if (!signal.aborted) {
        setBusy(false);
        try { setPending(pendingMarketIntent(sessionStorage, account)); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read your saved request."); }
        onPendingChange();
      }
    }
  };
  return <section className="market-account account-listing-form" aria-label="Publish a marketplace listing">
    <button type="button" onClick={onClose}>Close listing form</button>
    <h2 ref={heading} tabIndex={-1}>List your creation for sale</h2>
    <p>A reduced, watermarked preview and the listing details become public. Your prompt stays private. A sale transfers this creation and its outputs to the buyer; you receive the listed credit price.</p>
    {loading && <p role="status">Loading your creation...</p>}
    {error && <p role="alert">{error}</p>}
    {pending && <p>{retry ? "A listing request is awaiting confirmation. Retry sends the original details and price." : "Resolve your pending marketplace request before publishing another listing."}</p>}
    {retry && pending?.kind === "list" && <p>{pending.body.title}: {marketCredits(pending.body.price_units)} credits</p>}
    {retry ? <button type="button" disabled={busy} onClick={() => void submit()}>Retry listing request</button> : job && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || Boolean(pending) || recoveryBlocked}>
        {artifact && <img className="account-listing-preview" src={`/api/account-media/${artifact}`} alt="Your private creation" />}
        {job.artifacts.length > 1 && <label>Public preview image<select value={artifact} onChange={event => setArtifact(event.target.value)}>{job.artifacts.map((item, index) => <option key={item.id} value={item.id}>Image {index + 1}</option>)}</select></label>}
        <label>Title<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Price in credits<input required inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} /></label>
        <label>Description (optional)<textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label>Category (optional)<input maxLength={100} value={category} onChange={event => setCategory(event.target.value)} /></label>
        <button type="submit">{busy ? "Publishing..." : "Publish listing"}</button>
      </fieldset>
    </form>}
  </section>;
}
