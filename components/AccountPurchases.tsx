import React, { useEffect, useState } from "react";
import { useAccount } from "./AccountProvider";

interface Purchase {
  id: string;
  package_id: string;
  units: number;
  price_cents: number;
  currency: string;
  state: string;
  created_at: number;
}
interface PurchaseList { purchases: Purchase[]; scale: number; next_cursor: string | null }
interface Receipt {
  purchase_id: string;
  state: string;
  scale: number;
  receipt: { id: number; price_cents: number; currency: string; units: number; terms_version: string; created_at: number } | null;
  adjustments: Array<{ refunded_cents: number; disputed_cents: number; retained_units: number; settled_delta: number; created_at: number }>;
}

const money = (cents: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
const states: Record<string, string> = { pending: "Awaiting payment confirmation", paid: "Paid", expired: "Checkout expired",
  cancelled: "Cancelled", refunded: "Refunded", partially_refunded: "Partially refunded", disputed: "Payment disputed" };

/** Mounted with an account-id key so purchases never carry across account switches. */
export function AccountPurchases() {
  const { request } = useAccount();
  const [list, setList] = useState<PurchaseList | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    request<PurchaseList>(`/v2/account/purchases${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`, { signal: controller.signal })
      .then(next => { if (!controller.signal.aborted) setList(next); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load purchases."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, cursor, revision]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setReceipt(null); setReceiptError("");
    request<Receipt>(`/v2/account/purchases/${encodeURIComponent(selected)}`, { signal: controller.signal })
      .then(next => { if (!controller.signal.aborted) setReceipt(next); })
      .catch(reason => { if (!controller.signal.aborted) setReceiptError(reason instanceof Error ? reason.message : "Could not load receipt."); });
    return () => controller.abort();
  }, [selected, request, revision]);

  return <section className="account-summary-card" aria-labelledby="account-purchases-title">
    <div className="account-purchases-heading"><h2 id="account-purchases-title">Purchases and receipts</h2>
      <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh purchases</button></div>
    <p>Credits arrive after payment is confirmed. Returning from checkout does not confirm a payment.</p>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading purchases…</p> : !list?.purchases.length && !error ? <p>No purchases yet.</p> : null}
    {!loading && list && <ul className="account-purchase-list">{list.purchases.map(purchase => <li key={purchase.id}>
      <div><strong>{purchase.units / list.scale} credits · {money(purchase.price_cents, purchase.currency)}</strong>
        <p>{states[purchase.state] || "Checking payment"} · {new Date(purchase.created_at * 1000).toLocaleDateString()}</p></div>
      <button type="button" onClick={() => setSelected(purchase.id)}>View {purchase.state === "pending" || purchase.state === "expired" || purchase.state === "cancelled" ? "purchase" : "receipt"}</button>
    </li>)}</ul>}
    <div className="account-actions">
      {cursor && <button type="button" disabled={loading} onClick={() => setCursor(null)}>Latest purchases</button>}
      {list?.next_cursor && <button type="button" disabled={loading} onClick={() => setCursor(list.next_cursor)}>Older purchases</button>}
    </div>
    {selected && <div className="account-receipt" aria-label="Purchase details">
      <button type="button" onClick={() => { setSelected(null); setReceipt(null); }}>Close details</button>
      {receiptError ? <p role="alert">{receiptError}</p> : !receipt ? <p role="status">Loading receipt…</p> : <>
        <h3>{states[receipt.state] || "Purchase details"}</h3>
        <p className="account-purchase-id">Purchase {receipt.purchase_id}</p>
        {receipt.receipt ? <>
          <p>Receipt #{receipt.receipt.id} · {new Date(receipt.receipt.created_at * 1000).toLocaleString()}</p>
          <p>{money(receipt.receipt.price_cents, receipt.receipt.currency)} for {receipt.receipt.units / receipt.scale} credits</p>
          <p>Purchase terms: {receipt.receipt.terms_version}</p>
          {receipt.adjustments.filter(item => item.settled_delta !== 0).map((item, index) => <p key={index}>
            {new Date(item.created_at * 1000).toLocaleString()}: {item.settled_delta > 0 ? "+" : ""}{item.settled_delta / receipt.scale} credits adjusted;
            {" "}{money(item.refunded_cents, receipt.receipt!.currency)} refunded,
            {" "}{money(item.disputed_cents, receipt.receipt!.currency)} disputed.
          </p>)}
        </> : <p>A receipt will appear here once payment is confirmed.</p>}
      </>}
    </div>}
  </section>;
}
