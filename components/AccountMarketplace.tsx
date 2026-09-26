import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
import { SiteHeader } from "./SiteHeader";
import { SeoHead } from "./SeoHead";
import { AccountListingForm } from "./AccountListingForm";
import { browseAccountMarket, marketCredits, marketPreview, pendingMarketIntent, submitMarketIntent,
  type AccountMarketListing, type MarketPage, type MarketReceipt } from "../lib/accountMarketplace";

type View = "browse" | "owned" | "receipts";
export function AccountMarketplace({ listJob }: { listJob?: string }) {
  const account = useAccount();
  return <AccountMarketplaceWorkspace key={account.account?.id || (account.signedIn ? "loading-account" : "guest")} listJob={listJob} />;
}

function AccountMarketplaceWorkspace({ listJob }: { listJob?: string }) {
  const auth = useAccount(); const account = auth.account?.id;
  const [view, setView] = useState<View>("browse");
  const [draft, setDraft] = useState(""); const [search, setSearch] = useState(""); const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0); const [revision, setRevision] = useState(0);
  const [listings, setListings] = useState<AccountMarketListing[]>([]); const [receipts, setReceipts] = useState<MarketReceipt[]>([]);
  const [total, setTotal] = useState(0); const [selected, setSelected] = useState<AccountMarketListing | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [errorAction, setErrorAction] = useState<"fund_credits" | "reload_marketplace" | "open_collection" | "review_pending_request" | "">("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [pending, setPending] = useState<ReturnType<typeof pendingMarketIntent>>(null);
  const [listingDraft, setListingDraft] = useState<{ jobId: string; title?: string; price?: string } | null>(null);
  useEffect(() => { setListingDraft(listJob && /^[a-zA-Z0-9_-]{1,128}$/.test(listJob) ? { jobId: listJob } : null); }, [listJob]);
  const refreshPending = () => {
    if (!account) return;
    try { setPending(pendingMarketIntent(sessionStorage, account)); }
    catch (reason) { setRecoveryError(reason instanceof Error ? reason.message : "Could not recover your request."); }
  };
  const mutating = useRef(false); const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    if (account) {
      try { setPending(pendingMarketIntent(sessionStorage, account)); }
      catch (reason) { setRecoveryError(reason instanceof Error ? reason.message : "Could not recover your request."); }
    }
    return () => controller.abort();
  }, [account]);

  useEffect(() => {
    const controller = new AbortController();
    setListings([]); setReceipts([]); setTotal(0); setSelected(null); setError(""); setErrorAction("");
    if (view !== "browse" && !account) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    const query = new URLSearchParams({ limit: "24", offset: String(page * 24), search, sort });
    const load = async () => {
      if (view === "receipts") {
        const data = await auth.request<{ receipts: MarketReceipt[]; total: number }>(`/v2/account/marketplace/receipts?${query}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setReceipts(data.receipts); setTotal(data.total); }
      } else {
        const data = view === "browse" ? await browseAccountMarket(query, controller.signal)
          : await auth.request<MarketPage>(`/v2/account/marketplace/listings?${query}`, { signal: controller.signal });
        if (view === "owned" && data.listings.some(item => item.owner_account_id !== account)) throw new Error("Could not confirm listing ownership.");
        if (!controller.signal.aborted) { setListings(data.listings); setTotal(data.total); }
      }
    };
    void load().catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load the marketplace."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view, account, auth.request, page, search, sort, revision]);

  const act = async (kind: "purchase" | "resume" | "delist") => {
    if (!account || !lifetime.current || mutating.current || (kind !== "resume" && !selected)) return;
    const signal = lifetime.current.signal;
    mutating.current = true; setBusy(true); setError(""); setErrorAction(""); setMessage("");
    try {
      if (kind === "delist") {
        await auth.request<void>(`/v2/marketplace/listings/${selected!.id}`, { method: "DELETE", signal });
      } else {
        await submitMarketIntent(sessionStorage, account, { request: auth.request, signal }, kind === "resume" ? undefined
          : { kind: "purchase", listingId: selected!.id, units: selected!.price_units });
      }
      signal.throwIfAborted();
      setMessage(kind === "delist" ? "Listing removed from the marketplace." : "Request completed. Your creations and receipts are updated.");
      setSelected(null); setListingDraft(null); setPage(0); setRevision(value => value + 1);
    } catch (reason) {
      if (!signal.aborted) {
        const code = reason instanceof Error && "code" in reason ? String(reason.code) : "";
        if (code === "insufficient_credits") setErrorAction("fund_credits");
        else if (["listing_not_found", "listing_price_changed", "marketplace_artifact_unavailable"].includes(code)) setErrorAction("reload_marketplace");
        else if (code === "cannot_buy_own_listing") setErrorAction("open_collection");
        else if (code === "idempotency_conflict") setErrorAction("review_pending_request");
        setError(reason instanceof Error ? reason.message : "Could not complete this request.");
      }
    } finally {
      mutating.current = false;
      if (!signal.aborted) {
        setBusy(false);
        try { setPending(pendingMarketIntent(sessionStorage, account)); }
        catch (reason) { setRecoveryError(reason instanceof Error ? reason.message : "Could not read the saved request."); }
      }
    }
  };
  const changeView = (next: View) => { setView(next); setPage(0); setSelected(null); setMessage(""); setErrorAction(""); };
  const needsAccount = view !== "browse" && !account;
  const original = (item: AccountMarketListing) => account && item.owner_account_id === account && item.artifact_id && /^[a-zA-Z0-9_-]{1,128}$/.test(item.artifact_id)
    ? `/api/account-media/${item.artifact_id}` : undefined;

  return <><SeoHead title="Marketplace" description="Collect original HavnAI creations using account credits." path="/marketplace" /><SiteHeader />
    <main className="market-page account-market">
      <header className="market-heading"><div><span className="market-eyebrow">The HavnAI marketplace</span><h1>Find something worth keeping.</h1><p>Browse freely. Collect creations with your account credits.</p></div><Link className="market-create" href="/library">Your creations</Link></header>
      <section className="market-content" aria-label="Marketplace">
        <nav className="marketplace-tabs" aria-label="Marketplace views">
          {(["browse", "owned", "receipts"] as const).map(value => <button key={value} type="button" className={`marketplace-tab ${view === value ? "is-active" : ""}`} aria-pressed={view === value} onClick={() => changeView(value)}>{value === "browse" ? "Browse" : value === "owned" ? "Your listings & purchases" : "Receipts"}</button>)}
          <Link className="marketplace-tab" href="/marketplace?tab=workflows">Workflows</Link>
        </nav>
        {auth.error && <p role="alert">{auth.error} <Link href="/account">Open account</Link></p>}
        {recoveryError && <p role="alert">{recoveryError}</p>}
        {listingDraft && (account ? <AccountListingForm key={`${account}:${listingDraft.jobId}`} account={account} jobId={listingDraft.jobId}
          request={auth.request} initialTitle={listingDraft.title} initialPrice={listingDraft.price}
          onPendingChange={refreshPending} onClose={() => { setListingDraft(null); refreshPending(); }}
          onComplete={() => { setListingDraft(null); refreshPending(); setMessage("Your listing is published."); setPage(0); setRevision(value => value + 1); }} />
          : <p>Sign in to publish your creation. <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/marketplace?listJob=${listingDraft.jobId}`)}`}>Sign in</Link></p>)}
        {pending && <aside className="market-account"><p>A marketplace request is waiting for confirmation.</p><button type="button" disabled={busy} onClick={() => void act("resume")}>{pending.kind === "purchase" ? `Retry purchase for ${marketCredits(pending.units)} credits` : "Retry listing request"}</button></aside>}
        {view === "browse" && <form className="marketplace-toolbar" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); setPage(0); }}>
          <input className="library-search" aria-label="Search marketplace" placeholder="Search creations" value={draft} onChange={event => setDraft(event.target.value)} maxLength={200} />
          <select className="library-sort-select" aria-label="Sort marketplace" value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="price_low">Price low</option><option value="price_high">Price high</option></select>
          <button type="submit">Search</button>
        </form>}
        {message && <p role="status">{message} <Link href="/library">Open Collection</Link></p>}
        {error && <p role="alert">{error} {errorAction === "fund_credits" ? <Link href="/pricing">Get credits</Link>
          : errorAction === "open_collection" ? <Link href="/library">Open Collection</Link>
          : errorAction === "review_pending_request" ? <button type="button" onClick={refreshPending}>Review saved request</button>
          : <button type="button" onClick={() => setRevision(value => value + 1)}>Reload marketplace</button>}</p>}
        {needsAccount ? <p>{auth.loading ? "Loading your account..." : <>Sign in to see your listings and receipts. <Link href="/sign-in?redirect_url=%2Fmarketplace">Sign in</Link></>}</p>
          : loading ? <p role="status">Loading marketplace...</p> : !error && total === 0 ? <p>No {view === "receipts" ? "marketplace receipts" : "listings"} to show yet.</p> : null}
        <div className="marketplace-gallery-grid">{listings.map(item => <button type="button" key={item.id} className="marketplace-gallery-card" onClick={() => setSelected(item)}>
          <div className="marketplace-gallery-media">{(original(item) || marketPreview(item)) && <img src={original(item) || marketPreview(item)} alt={item.title} loading="lazy" />}</div>
          <div className="marketplace-gallery-body"><h2>{item.title}</h2><p>{marketCredits(item.price_units)} credits</p><span>{item.status}</span></div>
        </button>)}</div>
        {receipts.length > 0 && <ul>{receipts.map(receipt => <li key={receipt.id}><h2>{receipt.title}</h2><p>{receipt.direction === "purchase" ? "Paid" : "Received"} {marketCredits(receipt.price_units)} credits · {new Date(receipt.created_at * 1000).toLocaleString()}</p><p>Receipt: {receipt.id}</p></li>)}</ul>}
        {selected && <section className="market-account" aria-label="Selected creation"><button type="button" onClick={() => setSelected(null)}>Close details</button><h2>{selected.title}</h2><p>{selected.description}</p><p>{marketCredits(selected.price_units)} credits</p>
          {original(selected) ? <><a href={original(selected)} download>Download original</a>{selected.status === "active" ? <button type="button" disabled={busy} onClick={() => void act("delist")}>Remove listing</button>
            : selected.job_id && <button type="button" disabled={busy || Boolean(pending)} onClick={() => setListingDraft({ jobId: selected.job_id!, title: selected.title, price: String(selected.price_units / 1000) })}>Relist creation</button>}</>
            : account ? <><p>This purchase pays the seller and moves the creation to your Collection.</p><button type="button" disabled={busy || Boolean(pending) || Boolean(recoveryError)} onClick={() => void act("purchase")}>Buy for {marketCredits(selected.price_units)} credits</button><Link href="/pricing">Get credits</Link></>
            : <Link href="/sign-in?redirect_url=%2Fmarketplace">Sign in to buy</Link>}
        </section>}
        {!loading && total > 24 && <nav aria-label="Marketplace pages"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(total / 24)}</span><button type="button" disabled={(page + 1) * 24 >= total} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
      </section>
    </main></>;
}
