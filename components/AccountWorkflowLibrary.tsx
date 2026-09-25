import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
import type { Workflow } from "../lib/havnai";

export function AccountWorkflowLibrary({ onEdit }: { onEdit: (workflow: Workflow) => void }) {
  const account = useAccount();
  const [items, setItems] = useState<Workflow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    account.request<{ workflows: Workflow[]; total: number }>(`/v2/account/workflows?limit=12&offset=${page * 12}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setItems(result.workflows); setTotal(result.total); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load templates."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account.request, page, revision]);
  async function change(item: Workflow, deleting = false) {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError("");
    try {
      await account.request(`/v2/account/workflows/${encodeURIComponent(item.id)}`, { signal: controller.signal,
        method: deleting ? "DELETE" : "PATCH", ...(deleting ? {} : { body: JSON.stringify({ published: !item.published }) }) });
      controller.signal.throwIfAborted(); setRemove(null); setRevision(value => value + 1);
    } catch (reason) {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Could not update this template."); }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (active.current === controller) active.current = null;
    }
  }
  return <section aria-label="Your templates">
    <h2>Your saved templates</h2>
    <p>Private templates belong to your account. Publishing shares the entire prompt and settings with everyone.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Refresh templates</button>
    {loading ? <p role="status">Loading templates…</p> : !error && items.length === 0 ? <p>No saved templates on this page.</p> : <div className="templates-grid">
      {items.map(item => <article className="template-card" key={item.id}>
        <h3>{item.name}</h3><p>{item.description}</p><p>{item.published ? "Published" : "Private"}</p>
        <Link href={`/create?workflow=${encodeURIComponent(`account:${item.id}`)}`}>Review in Create</Link>{" "}
        <button type="button" disabled={busy} onClick={() => onEdit(item)}>Edit</button>{" "}
        <button type="button" disabled={busy} onClick={() => void change(item)}>{item.published ? "Unpublish" : "Publish template"}</button>{" "}
        {remove === item.id ? <><p>Delete this template? Your generated creations stay in your account.</p>
          <button type="button" disabled={busy} onClick={() => void change(item, true)}>Confirm delete</button>
          <button type="button" disabled={busy} onClick={() => setRemove(null)}>Keep template</button></>
          : <button type="button" disabled={busy} onClick={() => setRemove(item.id)}>Delete</button>}
      </article>)}
    </div>}
    <button type="button" disabled={loading || busy || page === 0} onClick={() => setPage(value => value - 1)}>Previous templates</button>
    <button type="button" disabled={loading || busy || (page + 1) * 12 >= total} onClick={() => setPage(value => value + 1)}>Next templates</button>
  </section>;
}
