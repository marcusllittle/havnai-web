import { useEffect, useState } from "react";
import { useAccount } from "./AccountProvider";

interface Summary { id: string; created_at: number; job_count: number; publication_count: number; playlist_count: number; workflow_count?: number; like_count?: number; save_count?: number; credit_units: number }
interface Page { receipts: Summary[]; total: number; scale: number }
interface Detail { scale: number; receipt: { id: string; created_at: number; wallet: string; credit_units: number;
  jobs: Array<{ id: string }>; publication_ids?: string[]; playlist_ids?: string[]; workflow_ids?: string[]; like_ids?: string[]; save_ids?: string[] } }
const amount = (units: number, scale: number) => (units / scale).toLocaleString(undefined, { maximumFractionDigits: 3 });

/** Account-id keyed by the account page; uses no wallet provider or signing API. */
export function AccountImportReceipts() {
  const { request } = useAccount();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<Page | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setList(null); setError("");
    request<Page>(`/v2/account/import-receipts?limit=10&offset=${page * 10}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setList(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load import receipts."); });
    return () => controller.abort();
  }, [open, page, request, revision]);
  useEffect(() => {
    setDetail(null); setDetailError("");
    if (!open || !selected) return;
    const controller = new AbortController();
    request<Detail>(`/v2/account/import-receipts/${encodeURIComponent(selected)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(reason => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : "Could not load this receipt."); });
    return () => controller.abort();
  }, [open, selected, request, revision]);
  return <section className="account-summary-card" aria-label="Import receipts">
    <h2>Import receipts</h2>
    <p>Completed wallet-to-account transfers. Saved reviews appear only after a transfer finishes.</p>
    <button type="button" aria-expanded={open} onClick={() => { setOpen(value => !value); setSelected(null); }}>{open ? "Hide import history" : "View import history"}</button>
    {open && <>
      {error ? <p role="alert">{error}</p> : !list ? <p role="status">Loading import history…</p> : !list.total ? <p>No completed imports yet.</p> : <>
        <ul>{list.receipts.map(receipt => <li key={receipt.id} style={{ padding: "0.75rem 0", overflowWrap: "anywhere" }}>
          <p>{new Date(receipt.created_at * 1000).toLocaleString()} · Completed</p>
          <p>{receipt.job_count} creations · {receipt.publication_count} publications · {receipt.playlist_count} playlists · {receipt.workflow_count || 0} workflows · {receipt.like_count || 0} liked songs · {receipt.save_count || 0} saved songs · {amount(receipt.credit_units, list.scale)} credits</p>
          <button type="button" aria-label={`View import ${receipt.id}`} onClick={() => setSelected(receipt.id)}>View receipt</button>
        </li>)}</ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="button" disabled={page === 0} onClick={() => { setSelected(null); setPage(value => value - 1); }}>Previous imports</button>
          <button type="button" disabled={(page + 1) * 10 >= list.total} onClick={() => { setSelected(null); setPage(value => value + 1); }}>Older imports</button>
        </div>
      </>}
      {selected && <section aria-label="Import receipt details" style={{ overflowWrap: "anywhere" }}>
        {detailError ? <p role="alert">{detailError}</p> : !detail || detail.receipt.id !== selected ? <p role="status">Loading receipt…</p> : <>
          <h3>Completed import</h3><p>Receipt: {detail.receipt.id}</p><p>From wallet: {detail.receipt.wallet}</p>
          <p>{amount(detail.receipt.credit_units, detail.scale)} credits transferred.</p>
          <p>This records the transfer at completion. Later sales or edits do not change this receipt.</p>
          <ul>{detail.receipt.jobs.map(job => <li key={`job:${job.id}`}>Creation: {job.id}</li>)}
            {(detail.receipt.publication_ids || []).map(id => <li key={`publication:${id}`}>Publication: {id}</li>)}
            {(detail.receipt.playlist_ids || []).map(id => <li key={`playlist:${id}`}>Playlist: {id}</li>)}
            {(detail.receipt.workflow_ids || []).map(id => <li key={`workflow:${id}`}>Workflow: {id}</li>)}{(detail.receipt.like_ids || []).map(id => <li key={`like:${id}`}>Liked song: {id}</li>)}{(detail.receipt.save_ids || []).map(id => <li key={`save:${id}`}>Saved song: {id}</li>)}</ul>
        </>}
      </section>}
      <button type="button" onClick={() => setRevision(value => value + 1)}>Refresh import receipts</button>
    </>}
  </section>;
}
