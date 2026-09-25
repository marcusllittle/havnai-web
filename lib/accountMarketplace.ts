import type { AccountStudioAccess } from "./musicStudioApi";

export interface AccountMarketListing {
  id: number; title: string; description: string; category: string; asset_type: string; model: string;
  price_units: number; scale: number; status: "active" | "sold" | "delisted"; created_at: number;
  preview_url: string | null; job_id?: string; artifact_id?: string; owner_account_id?: string;
  creator_account_id?: string | null; original_url?: string;
}
export interface MarketReceipt {
  id: string; listing_id: number; job_id: string; title: string; price_units: number; scale: number;
  direction: "purchase" | "sale"; ledger_entry_id: number; created_at: number;
}
export interface MarketPage { listings: AccountMarketListing[]; total: number; limit: number; offset: number }
export interface MarketListingInput {
  job_id: string; artifact_id: string; title: string; price_units: number; description?: string; category?: string;
}
export interface MarketResult { listing_id: number; job_id: string; price_units: number; sale_id?: string }
type Intent = { key: string } & ({ kind: "purchase"; listingId: number; units: number } | { kind: "list"; body: MarketListingInput });
const storageKey = (account: string) => `havnai.account-marketplace-request.v1:${account}`;
const validUnits = (units: unknown): units is number => Number.isSafeInteger(units) && Number(units) > 0 && Number(units) <= 1e15;
const validId = (id: unknown): id is number => Number.isSafeInteger(id) && Number(id) > 0;

export function creditUnits(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a positive credit price with at most three decimal places.");
  const units = Number(match[1]) * 1000 + Number((match[2] || "").padEnd(3, "0"));
  if (!validUnits(units)) throw new Error("Enter a credit price between 0.001 and 1,000,000,000,000.");
  return units;
}

export function marketCredits(units: number): string {
  if (!validUnits(units)) throw new Error("The listing has an invalid price.");
  return (units / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function marketPreview(listing: AccountMarketListing): string | undefined {
  const expected = `/v2/marketplace/listings/${listing.id}/preview`;
  return validId(listing.id) && listing.preview_url === expected ? `/api${expected}` : undefined;
}

export async function browseAccountMarket(query: URLSearchParams, signal: AbortSignal): Promise<MarketPage> {
  const response = await fetch(`/api/v2/marketplace/listings?${query}`, { signal, credentials: "omit", cache: "no-store" });
  const body = await response.json().catch(() => null);
  signal.throwIfAborted();
  if (!response.ok) throw new Error(body?.error?.message || "Could not load the marketplace. Try again.");
  if (!Array.isArray(body?.listings) || !Number.isInteger(body.total) || body.total < 0 ||
      body.listings.some((item: AccountMarketListing) => !validId(item.id) || !validUnits(item.price_units) || item.scale !== 1000)) {
    throw new Error("The marketplace returned an invalid response.");
  }
  return body;
}

function validListing(body: MarketListingInput): boolean {
  return Boolean(body && typeof body === "object" &&
    Object.keys(body).every(key => ["job_id", "artifact_id", "title", "description", "category", "price_units"].includes(key)) &&
    typeof body.job_id === "string" && body.job_id.length > 0 && body.job_id.length <= 128 &&
    typeof body.artifact_id === "string" && body.artifact_id.length > 0 && body.artifact_id.length <= 128 &&
    typeof body.title === "string" && body.title.trim() && body.title.length <= 200 && validUnits(body.price_units) &&
    (body.description === undefined || typeof body.description === "string" && body.description.length <= 2000) &&
    (body.category === undefined || typeof body.category === "string" && body.category.length <= 100));
}

export function pendingMarketIntent(storage: Storage, account: string): Intent | null {
  const raw = storage.getItem(storageKey(account));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value.key !== "string" || value.key.length < 16 || value.key.length > 128 ||
        !(value.kind === "purchase" && validId(value.listingId) && validUnits(value.units) || value.kind === "list" && validListing(value.body))) throw new Error();
    return value;
  } catch { throw new Error("Your saved marketplace request needs review before another transaction can start."); }
}

export async function submitMarketIntent(storage: Storage, account: string, access: AccountStudioAccess,
  input?: { kind: "purchase"; listingId: number; units: number } | { kind: "list"; body: MarketListingInput }): Promise<MarketResult> {
  const signal = access.signal;
  signal.throwIfAborted();
  let pending = pendingMarketIntent(storage, account);
  if (pending && input) throw new Error("Resume your pending marketplace request before starting another.");
  if (!pending) {
    if (!input || !(input.kind === "purchase" ? validId(input.listingId) && validUnits(input.units) : validListing(input.body))) {
      throw new Error("Choose a valid listing and price first.");
    }
    pending = { ...input, key: crypto.randomUUID() };
    storage.setItem(storageKey(account), JSON.stringify(pending));
  }
  const path = pending.kind === "purchase" ? `/v2/marketplace/listings/${pending.listingId}/purchase` : "/v2/marketplace/listings";
  const body = pending.kind === "purchase" ? { expected_price_units: pending.units } : pending.body;
  try {
    const result = await access.request<MarketResult>(path, { method: "POST", signal,
      headers: { "Idempotency-Key": pending.key }, body: JSON.stringify(body) });
    signal.throwIfAborted();
    if (!validId(result.listing_id) || typeof result.job_id !== "string" || !result.job_id ||
        result.price_units !== (pending.kind === "purchase" ? pending.units : pending.body.price_units) ||
        (pending.kind === "purchase" && (result.listing_id !== pending.listingId || !result.sale_id)) ||
        (pending.kind === "list" && result.job_id !== pending.body.job_id)) throw new Error("Could not confirm the marketplace receipt. Retry this request.");
    storage.removeItem(storageKey(account));
    return result;
  } catch (reason) {
    const code = reason instanceof Error && "code" in reason ? String(reason.code) : "";
    // These failures occur before any settlement. Ambiguous transport/server
    // failures retain the exact request so recovery cannot double charge.
    if (!signal.aborted && ["invalid_listing", "invalid_purchase", "invalid_price_units", "marketplace_ineligible", "marketplace_unsettled",
      "marketplace_artifact_unavailable", "job_not_found", "listing_not_found", "already_listed", "listing_price_changed",
      "cannot_buy_own_listing", "insufficient_credits", "sale_account_unavailable"].includes(code)) storage.removeItem(storageKey(account));
    throw reason;
  }
}
