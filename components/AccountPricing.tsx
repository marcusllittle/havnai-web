import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAccount } from "./AccountProvider";
import { SiteHeader } from "./SiteHeader";
import { SeoHead } from "./SeoHead";
import { checkoutFinished, parseCreditCatalog, publicPolicyUrl, readCheckoutAttempt, startAccountCheckout,
  type AccountCreditCatalog, type AccountCreditPackage, type CheckoutAttempt } from "../lib/accountCheckout";

const price = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function AccountPricing() {
  const { signedIn, loading, account, error: accountError, request } = useAccount();
  const router = useRouter();
  const [catalog, setCatalog] = useState<AccountCreditCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [revision, setRevision] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Record<string, CheckoutAttempt | null>>({});
  const pending = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(() => () => { pending.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null); setCatalogError(""); setAccepted(false);
    fetch("/api/v2/credit-packages", { signal: controller.signal, credentials: "omit", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Pricing is temporarily unavailable. Please try again.");
        return parseCreditCatalog(await response.json());
      })
      .then(value => { if (!controller.signal.aborted) setCatalog(value); })
      .catch(reason => { if (!controller.signal.aborted) setCatalogError(reason instanceof Error ? reason.message : "Could not load prices."); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (!account || !catalog) return;
    const controller = new AbortController();
    try {
      const stored = Object.fromEntries(catalog.packages.map(pack => [pack.id, readCheckoutAttempt(window.sessionStorage, account.id, pack.id)]));
      setAttempts(stored);
      // Only confirmed terminal purchases can stop being retry candidates.
      void Promise.all(Object.entries(stored).map(async ([id, attempt]) => {
        if (!attempt?.purchase_id) return;
        const previous = await request<{ state: string }>(`/v2/account/purchases/${encodeURIComponent(attempt.purchase_id)}`, { signal: controller.signal });
        if (!controller.signal.aborted && checkoutFinished({ ...previous, purchase_id: attempt.purchase_id, checkout_url: null })) {
          setAttempts(current => ({ ...current, [id]: null }));
        }
      })).catch(() => undefined); // Keep the retry candidate if status cannot be verified.
    } catch (reason) { setCheckoutError(reason instanceof Error ? reason.message : "Could not restore checkout."); }
    return () => controller.abort();
  }, [account, catalog, request]);

  async function buy(pack: AccountCreditPackage) {
    if (inFlight.current || !account || !catalog || !catalog.checkout_available || !accepted) return;
    inFlight.current = true;
    const controller = new AbortController(); pending.current = controller;
    setBuying(pack.id); setCheckoutError("");
    try {
      const result = await startAccountCheckout({ storage: window.sessionStorage, accountId: account.id,
        pack, catalog, request, signal: controller.signal });
      controller.signal.throwIfAborted();
      if (checkoutFinished(result)) await router.push(`/account?purchase=${encodeURIComponent(result.purchase_id)}`);
      else window.location.assign(result.checkout_url!);
    } catch (reason) {
      if (!controller.signal.aborted) setCheckoutError(reason instanceof Error ? reason.message : "Checkout could not start. Please try again.");
    } finally {
      if (!controller.signal.aborted) { setBuying(null); inFlight.current = false; }
    }
  }

  return <><SeoHead title="Credits | HavnAI" description="Buy credits for your HavnAI account. Pay by card and keep your creations in one place." path="/pricing" />
    <SiteHeader /><main className="account-page">
      <div className="account-heading"><div><span className="account-eyebrow">Make room for your next idea</span>
        <h1>Credits for what you create.</h1><p>One-time credit packs, paid by card. Your balance belongs to your HavnAI account. No wallet needed.</p></div>
        <Link href="/account" className="account-secondary">Your account</Link></div>
      {loading ? <p role="status">Checking your account…</p> : !signedIn ? <p><Link href="/sign-in">Sign in</Link> or <Link href="/sign-up">create an account</Link> to buy credits.</p> : null}
      {accountError && <p role="alert" className="account-notice">{accountError}</p>}
      {catalogError ? <div className="account-notice" role="alert"><p>{catalogError}</p><button onClick={() => setRevision(value => value + 1)}>Reload prices</button></div>
        : !catalog ? <p role="status">Loading current prices…</p> : <>
          {!catalog.checkout_available && <p className="account-notice" role="status">Card checkout is not available yet. You can browse the credit packs below.</p>}
          {publicPolicyUrl(catalog.terms_url) && publicPolicyUrl(catalog.refund_url) && <div className="account-checkout-terms">
            <label><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={Boolean(buying)} />
              <span>I agree to the <a href={catalog.terms_url} target="_blank" rel="noopener noreferrer">credit purchase terms</a> and have read the <a href={catalog.refund_url} target="_blank" rel="noopener noreferrer">refund policy</a>.</span></label>
            <p>Terms version: {catalog.terms_version}. Review the total in Stripe before paying.</p>
          </div>}
          <div className="pricing-grid">{catalog.packages.map(pack => <article className="pricing-card" key={pack.id}>
            <h2 className="pricing-card-name">{pack.name}</h2><div className="pricing-card-price">{price(pack.price_cents)}</div>
            <div className="pricing-card-credits">{(pack.units / catalog.scale).toLocaleString()} credits</div>
            <p className="pricing-card-desc">One payment. Use your credits for supported image, music, and video generation.</p>
            {attempts[pack.id] && <p className="pricing-card-desc">Your previous {price(attempts[pack.id]!.price_cents)} checkout will be resumed.</p>}
            <button className="btn" disabled={loading || !account || !accepted || !catalog.checkout_available || Boolean(buying)}
              onClick={() => void buy(pack)}>{buying === pack.id ? "Opening checkout…" : attempts[pack.id] ? "Resume checkout" : `Buy ${pack.units / catalog.scale} credits`}</button>
          </article>)}</div>
        </>}
      {checkoutError && <div className="account-notice" role="alert"><p>{checkoutError}</p><div className="account-actions"><Link href="/account">View your purchases</Link>
        <button disabled={Boolean(buying)} onClick={() => setRevision(value => value + 1)}>Reload prices</button></div></div>}
      <section className="account-panel"><h2>How credits work</h2><p>Generation costs depend on the model and settings. Credits are reserved when a job starts, charged when it succeeds, and released if it fails or is cancelled.</p>
        <p>Your account keeps the purchase receipt and any payment adjustments. Browsing public work is free.</p></section>
    </main><footer className="account-footer"><Link href="/account">Account and receipts</Link><Link href="/how-it-works">How HavnAI works</Link><Link href="/wallet">Optional wallet features</Link></footer></>;
}
