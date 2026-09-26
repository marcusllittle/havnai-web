import { useEffect, useState } from "react";
import type { AccountStudioAccess } from "../lib/musicStudioApi";
import { verifyChain, type AccountVideoChain } from "../lib/accountVideoChains";

export function AccountVideoSequences({ account, access, revision, busy, onResume, onStop }: {
  account: string; access: AccountStudioAccess; revision: number; busy: boolean;
  onResume: (id: string) => void; onStop: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AccountVideoChain[]>([]);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  useEffect(() => { setPage(0); }, [revision, refresh]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError("");
    void access.request<{ chains: AccountVideoChain[] }>(`/v2/video-chains?offset=${page * 50}`, { signal: controller.signal, cache: "no-store" })
      .then(response => {
        if (controller.signal.aborted) return;
        const checked = response.chains.map(chain => verifyChain(chain, account));
        setRows(previous => page ? [...new Map([...previous, ...checked].map(chain => [chain.id, chain])).values()] : checked);
        setMore(checked.length === 50);
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load your video sequences."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, account, access, revision, refresh, page]);
  return <section className="studio-account">
    <button type="button" className="generator-mini-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>Saved video sequences</button>
    {open && <>
      <p className="generator-help">Resume a sequence to render its remaining clips. Each new clip uses credits. Stopping a sequence leaves an already submitted clip running.</p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading sequences...</p>}
      <button type="button" className="generator-mini-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh sequences</button>
      {!loading && !error && rows.length === 0 && <p>No saved sequences yet.</p>}
      <ul>{rows.map(chain => <li key={chain.id}>
        <p>{String(chain.template.prompt || "Video sequence").slice(0, 160)}</p>
        <p className="generator-help">{chain.jobs.filter(job => job.status === "succeeded").length}/{chain.total} clips ready · {chain.state}</p>
        {!["stopped", "failed"].includes(chain.state) && <button type="button" className="generator-mini-button" disabled={busy} onClick={() => onResume(chain.id)}>
          {chain.state === "complete" ? "View merged video" : chain.state === "rendered" ? chain.auto_stitch ? "Merge clips" : "View last clip" : "Resume sequence"}
        </button>}
        {chain.state === "active" && <button type="button" className="generator-mini-button" onClick={() => onStop(chain.id)}>Stop sequence</button>}
        {chain.state === "failed" && <p className="generator-help">A clip failed. Your completed clips are in Collection; no further clips will be submitted.</p>}
      </li>)}</ul>
      {more && <button type="button" className="generator-mini-button" disabled={loading} onClick={() => setPage(value => value + 1)}>Load more sequences</button>}
    </>}
  </section>;
}
