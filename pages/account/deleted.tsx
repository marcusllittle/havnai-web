import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "../../components/AccountProvider";
import { SiteHeader } from "../../components/SiteHeader";
import { SeoHead } from "../../components/SeoHead";

type Deleted = { job_id: string; deleted_at: number; recover_until: number; purged_at: number | null };

export default function DeletedCreationsPage() {
  const account = useAccount();
  return <><SeoHead title="Deleted creations" noindex /><SiteHeader />
    <main className="account-page"><h1>Deleted creations</h1>
      {account.account ? <DeletedCreations key={account.account.id} /> : <p>{account.loading ? "Loading your account…" : <Link href="/sign-in">Sign in to recover your creations</Link>}</p>}
      <Link href="/music">Back to Music Studio</Link>
    </main></>;
}

function DeletedCreations() {
  const account = useAccount();
  const [items, setItems] = useState<Deleted[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    setLoading(true); setError("");
    void account.request<{ generations: Deleted[] }>("/v2/account/deleted-generations", { signal: controller.signal, cache: "no-store" })
      .then(result => { if (!controller.signal.aborted) setItems(result.generations); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load deleted creations. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account.request, revision]);
  async function restore(item: Deleted) {
    if (pending.current || !lifetime.current) return;
    pending.current = true; setBusy(item.job_id); setError("");
    const signal = lifetime.current.signal;
    try {
      await account.request(`/v2/jobs/${encodeURIComponent(item.job_id)}/restore`, { method: "POST", signal });
      if (signal.aborted) return;
      setItems(current => current.filter(row => row.job_id !== item.job_id));
      setNotice("Restored privately. Republish or add it to playlists separately.");
    } catch { if (!signal.aborted) setError("Could not restore this creation. Its recovery window may have expired. Please refresh and try again."); }
    finally { pending.current = false; if (!signal.aborted) setBusy(""); }
  }
  return <><p>Recover creations within 30 days. Restoring keeps them private; publication, listings and playlist placement require a new action. Payment and audit records are retained.</p>
    {error && <p role="alert">{error} <button disabled={Boolean(busy)} onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading deleted creations…</p> : !error && !items.length ? <p>No deleted creations.</p> :
      <ul>{items.map(item => <li key={item.job_id} style={{ overflowWrap: "anywhere", marginBottom: "1rem" }}>
        <span>{item.job_id}</span><p>Deleted {new Date(item.deleted_at * 1000).toLocaleDateString()}. Recovery ends {new Date(item.recover_until * 1000).toLocaleString()}.</p>
        {item.purged_at || item.recover_until * 1000 <= Date.now() ? <span>Recovery window ended</span> :
          <button disabled={Boolean(busy)} onClick={() => void restore(item)}>{busy === item.job_id ? "Restoring…" : "Restore privately"}</button>}
      </li>)}</ul>}
  </>;
}
