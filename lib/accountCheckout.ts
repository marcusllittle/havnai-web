export interface AccountCreditPackage { id: string; name: string; units: number; price_cents: number }
export interface AccountCreditCatalog {
  packages: AccountCreditPackage[];
  currency: string;
  scale: number;
  checkout_available: boolean;
  terms_version: string;
  catalog_version: string;
  terms_url: string | null;
  refund_url: string | null;
}
export interface CheckoutAttempt {
  key: string;
  package_id: string;
  terms_version: string;
  catalog_version: string;
  price_cents: number;
  currency: string;
  purchase_id?: string;
}
export interface CheckoutResult { purchase_id: string; checkout_url: string | null; state: string }
type AccountRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

const storageKey = (accountId: string, packageId: string) => `havnai.account-checkout.v1:${accountId}:${packageId}`;
const terminal = new Set(["paid", "refunded", "partially_refunded", "disputed", "expired", "cancelled"]);

export function publicPolicyUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch { return false; }
}

export function parseCreditCatalog(value: unknown): AccountCreditCatalog {
  const item = value as AccountCreditCatalog | null;
  if (!item || item.currency !== "usd" || item.scale !== 1000 || !Array.isArray(item.packages) ||
    !item.packages.length || !item.packages.every(pack => typeof pack.id === "string" && typeof pack.name === "string" &&
      Number.isSafeInteger(pack.units) && pack.units > 0 && Number.isSafeInteger(pack.price_cents) && pack.price_cents > 0) ||
    new Set(item.packages.map(pack => pack.id)).size !== item.packages.length ||
    typeof item.catalog_version !== "string" || !item.catalog_version || typeof item.terms_version !== "string" ||
    typeof item.checkout_available !== "boolean" ||
    (item.checkout_available && (!item.terms_version || !publicPolicyUrl(item.terms_url) || !publicPolicyUrl(item.refund_url)))) {
    throw new Error("Pricing is temporarily unavailable. Please try again.");
  }
  return item;
}

export function readCheckoutAttempt(storage: Storage, accountId: string, packageId: string): CheckoutAttempt | null {
  let raw: string | null;
  try { raw = storage.getItem(storageKey(accountId, packageId)); }
  catch { throw new Error("Allow browser storage to keep checkout retries safe, then try again."); }
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as CheckoutAttempt;
    if (typeof item.key !== "string" || item.key.length < 16 || item.key.length > 128 ||
      item.package_id !== packageId || typeof item.terms_version !== "string" || !item.terms_version ||
      typeof item.catalog_version !== "string" || !item.catalog_version || item.currency !== "usd" ||
      !Number.isSafeInteger(item.price_cents) || item.price_cents <= 0 ||
      (item.purchase_id !== undefined && (typeof item.purchase_id !== "string" || !item.purchase_id.startsWith("pur_")))) throw new Error();
    return item;
  } catch {
    // Never erase an ambiguous attempt and silently replace it with a new purchase.
    throw new Error("Your previous checkout needs review. Check Purchases in your account before starting another payment.");
  }
}

export async function startAccountCheckout({ storage, accountId, pack, catalog, request, signal }: {
  storage: Storage; accountId: string; pack: AccountCreditPackage; catalog: AccountCreditCatalog;
  request: AccountRequest; signal: AbortSignal;
}): Promise<CheckoutResult> {
  const key = storageKey(accountId, pack.id);
  let attempt = readCheckoutAttempt(storage, accountId, pack.id);
  if (attempt?.purchase_id) {
    const previous = await request<{ state: string }>(`/v2/account/purchases/${encodeURIComponent(attempt.purchase_id)}`, { signal });
    signal.throwIfAborted();
    if (terminal.has(previous.state)) {
      storage.removeItem(key);
      attempt = null;
    }
  }
  if (!attempt) {
    attempt = { key: crypto.randomUUID(), package_id: pack.id, terms_version: catalog.terms_version,
      catalog_version: catalog.catalog_version, price_cents: pack.price_cents, currency: catalog.currency };
    try { storage.setItem(key, JSON.stringify(attempt)); }
    catch { throw new Error("Allow browser storage to keep checkout retries safe, then try again."); }
  }
  signal.throwIfAborted();
  let result: CheckoutResult;
  try {
    result = await request<CheckoutResult>("/v2/account/checkout", { method: "POST", signal,
      headers: { "Idempotency-Key": attempt.key },
      body: JSON.stringify({ package_id: attempt.package_id, terms_version: attempt.terms_version, catalog_version: attempt.catalog_version }) });
  } catch (reason) {
    if (!signal.aborted && reason instanceof Error && "code" in reason && reason.code === "pricing_changed") {
      // Core returns this only before inserting a purchase or calling Stripe.
      storage.removeItem(key);
      throw new Error("Prices or terms changed. Reload prices and review them before paying.");
    }
    throw reason;
  }
  signal.throwIfAborted();
  if (typeof result.purchase_id !== "string" || !result.purchase_id.startsWith("pur_") || typeof result.state !== "string") {
    throw new Error("Checkout returned an unexpected response. Check your purchases before retrying.");
  }
  // Keep the original key even if saving the response fails: retry remains safe.
  try { storage.setItem(key, JSON.stringify({ ...attempt, purchase_id: result.purchase_id })); } catch { /* original key persisted */ }
  if (!terminal.has(result.state)) {
    let url: URL;
    try { url = new URL(result.checkout_url || ""); } catch { throw new Error("Checkout is not ready. Please check your purchases and try again."); }
    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password) {
      throw new Error("Checkout returned an unexpected address. Please try again.");
    }
  }
  return result;
}

export const checkoutFinished = (result: CheckoutResult) => terminal.has(result.state);
