import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Clock3, History, LoaderCircle, LockKeyhole, LogIn, RotateCcw } from "lucide-react";
import { useAccount } from "../../components/AccountProvider";
import { SiteHeader } from "../../components/SiteHeader";
import { SeoHead } from "../../components/SeoHead";

type Deleted = { job_id: string; deleted_at: number; recover_until: number; purged_at: number | null };

export default function DeletedCreationsPage() {
  const account = useAccount();
  return <><SeoHead title="Deleted creations" noindex /><SiteHeader />
    <main className="account-page recovery-page">
      <div className="recovery-shell">
        <header className="recovery-heading">
          <div>
            <p className="recovery-eyebrow"><History size={16} aria-hidden="true" />Your account</p>
            <h1>Deleted creations</h1>
            <p>You have 30 days to bring a deleted creation back.</p>
          </div>
          <Link href="/library" className="recovery-button recovery-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Back to Collection</Link>
        </header>
        {account.account ? <DeletedCreations key={account.account.id} /> : account.loading ? <div className="recovery-state" role="status">
          <LoaderCircle size={26} className="recovery-spinner" aria-hidden="true" /><p>Loading your account…</p>
        </div> : account.error ? <div className="recovery-state">
          <span className="recovery-state-icon"><History size={28} aria-hidden="true" /></span>
          <h2>Your account is out of reach</h2>
          <p role="alert">We couldn't load your account. Try again to see your deleted creations.</p>
          <button className="recovery-button recovery-button-primary" type="button" onClick={() => void account.refresh().catch(() => undefined)}><RotateCcw size={16} aria-hidden="true" />Try again</button>
        </div> : <div className="recovery-state">
          <span className="recovery-state-icon"><LockKeyhole size={28} aria-hidden="true" /></span>
          <h2>Your creations, kept for you.</h2>
          <p>Sign in to find your recently deleted work and restore it to your account.</p>
          <Link href="/sign-in?redirect_url=%2Faccount%2Fdeleted" className="recovery-button recovery-button-primary"><LogIn size={17} aria-hidden="true" />Sign in to restore</Link>
        </div>}
        <aside className="recovery-policy" aria-label="About restoring creations">
          <LockKeyhole size={19} aria-hidden="true" />
          <div><h2>Back in your hands. Still private.</h2><p>Restored work stays private. Publish it, list it for sale, or add it to playlists when you're ready. Payment and audit records are retained.</p></div>
        </aside>
        <footer className="recovery-footer"><Link href="/account">Your account<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/music">Music Studio<ArrowUpRight size={15} aria-hidden="true" /></Link></footer>
      </div>
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
    pending.current = true; setBusy(item.job_id); setError(""); setNotice("");
    const signal = lifetime.current.signal;
    try {
      await account.request(`/v2/jobs/${encodeURIComponent(item.job_id)}/restore`, { method: "POST", signal });
      if (signal.aborted) return;
      setItems(current => current.filter(row => row.job_id !== item.job_id));
      setNotice("Restored privately. Republish or add it to playlists separately.");
    } catch { if (!signal.aborted) setError("Could not restore this creation. Its recovery window may have expired. Please refresh and try again."); }
    finally { pending.current = false; if (!signal.aborted) setBusy(""); }
  }
  return <>
    {error && <div className="recovery-feedback recovery-feedback-error" role="alert"><p>{error}</p><button className="recovery-button recovery-button-secondary" type="button" disabled={Boolean(busy)} onClick={() => setRevision(value => value + 1)}><RotateCcw size={16} aria-hidden="true" />Try again</button></div>}
    {notice && <div className="recovery-feedback" role="status"><Check size={19} aria-hidden="true" /><p>{notice} <Link href="/library">Open Collection</Link> or <Link href="/music">Music Studio</Link>.</p></div>}
    {loading ? <div className="recovery-state" role="status"><LoaderCircle size={26} className="recovery-spinner" aria-hidden="true" /><p>Loading deleted creations…</p></div>
      : !error && !items.length ? <div className="recovery-state">
        <span className="recovery-state-icon"><History size={30} aria-hidden="true" /></span>
        <h2>Nothing to restore.</h2><p>No deleted creations. If you delete something, you'll find it here during its recovery window.</p>
        <Link href="/library" className="recovery-button recovery-button-primary">Open Collection<ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div> : items.length > 0 && <section className="recovery-list-panel" aria-label="Deleted creations">
        <div className="recovery-list-heading"><h2>Recently deleted<span>{items.length}</span></h2><span><Clock3 size={15} aria-hidden="true" />30-day recovery</span></div>
        <ul className="recovery-list">{items.map(item => {
          const expired = Boolean(item.purged_at) || item.recover_until * 1000 <= Date.now();
          const daysLeft = Math.max(1, Math.ceil((item.recover_until * 1000 - Date.now()) / 86_400_000));
          const deadline = new Date(item.recover_until * 1000);
          return <li key={item.job_id} className="recovery-item">
            <span className="recovery-item-icon"><History size={23} aria-hidden="true" /></span>
            <div className="recovery-item-details">
              <div className="recovery-item-heading"><h3>Deleted creation</h3><span className={`recovery-deadline${expired ? " is-expired" : ""}`}>{expired ? "Recovery window ended" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}</span></div>
              <p className="recovery-item-id">{item.job_id}</p>
              <p className="recovery-item-dates">Deleted {new Date(item.deleted_at * 1000).toLocaleDateString()}{!expired && <> · Restore by <time dateTime={deadline.toISOString()}>{deadline.toLocaleString()}</time></>}</p>
            </div>
            {!expired && <button className="recovery-button recovery-button-primary" type="button" disabled={Boolean(busy)} onClick={() => void restore(item)}>
              {busy === item.job_id ? <LoaderCircle size={16} className="recovery-spinner" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
              {busy === item.job_id ? "Restoring…" : "Restore privately"}
            </button>}
          </li>;
        })}</ul>
      </section>}
  </>;
}
