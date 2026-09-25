import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCreditCatalog, readCheckoutAttempt, startAccountCheckout, type AccountCreditCatalog } from "../accountCheckout";

export const catalog: AccountCreditCatalog = { packages: [{ id: "starter", name: "Starter", units: 50_000, price_cents: 500 }],
  currency: "usd", scale: 1000, checkout_available: true, terms_version: "terms-v1", catalog_version: "quote-v1",
  terms_url: "https://joinhavn.io/terms/v1", refund_url: "https://joinhavn.io/refunds/v1" };
const result = { purchase_id: "pur_alice", checkout_url: "https://checkout.stripe.com/c/pay/example", state: "pending" };

describe("Account checkout retry boundary", () => {
  const request = vi.fn();
  const start = (accountId = "acct_alice", value = catalog, signal = new AbortController().signal) => startAccountCheckout({
    storage: sessionStorage, accountId, pack: value.packages[0], catalog: value, request, signal });
  beforeEach(() => { sessionStorage.clear(); request.mockReset().mockResolvedValue(result); });

  it("persists before the request and reuses the same key after a lost response", async () => {
    request.mockImplementationOnce(async () => {
      expect(readCheckoutAttempt(sessionStorage, "acct_alice", "starter")?.key).toBeTruthy();
      throw new Error("Network response lost");
    });
    await expect(start()).rejects.toThrow("Network response lost");
    await start();
    const first = request.mock.calls[0][1];
    const second = request.mock.calls[1][1];
    expect(first.headers).toEqual(second.headers);
    expect(first.body).toBe(second.body);
    expect(JSON.parse(first.body)).toEqual({ package_id: "starter", terms_version: "terms-v1", catalog_version: "quote-v1" });
  });

  it("keeps attempts isolated by account", async () => {
    await start();
    await start("acct_bob");
    expect(request.mock.calls[0][1].headers["Idempotency-Key"]).not.toBe(request.mock.calls[1][1].headers["Idempotency-Key"]);
  });

  it("resumes pending attempts and only starts another purchase after a confirmed terminal state", async () => {
    await start();
    const originalKey = request.mock.calls[0][1].headers["Idempotency-Key"];
    request.mockResolvedValueOnce({ state: "pending" }).mockResolvedValueOnce(result);
    await start();
    expect(request.mock.calls[1][0]).toBe("/v2/account/purchases/pur_alice");
    expect(request.mock.calls[2][1].headers["Idempotency-Key"]).toBe(originalKey);
    request.mockResolvedValueOnce({ state: "paid" }).mockResolvedValueOnce({ ...result, purchase_id: "pur_second" });
    await start();
    expect(request.mock.calls[4][1].headers["Idempotency-Key"]).not.toBe(originalKey);
  });

  it("does not create a new purchase when previous status cannot be verified", async () => {
    await start();
    request.mockRejectedValueOnce(new Error("Service unavailable"));
    await expect(start()).rejects.toThrow("Service unavailable");
    expect(request).toHaveBeenCalledTimes(2);
    expect(readCheckoutAttempt(sessionStorage, "acct_alice", "starter")?.purchase_id).toBe("pur_alice");
  });

  it("retries the original accepted quote after a catalog update", async () => {
    request.mockRejectedValueOnce(new Error("Lost response"));
    await expect(start()).rejects.toThrow();
    await start("acct_alice", { ...catalog, catalog_version: "quote-v2", terms_version: "terms-v2" });
    expect(JSON.parse(request.mock.calls[1][1].body).catalog_version).toBe("quote-v1");
  });

  it("clears a quote only when core explicitly confirms it rejected the stale pricing", async () => {
    request.mockRejectedValueOnce(Object.assign(new Error("Pricing changed"), { code: "pricing_changed" }));
    await expect(start()).rejects.toThrow("Reload prices");
    expect(readCheckoutAttempt(sessionStorage, "acct_alice", "starter")).toBeNull();
  });

  it("refuses to pay when safe retry storage is unavailable or corrupted", async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("storage blocked"); } } as unknown as Storage;
    await expect(startAccountCheckout({ storage, accountId: "acct_alice", pack: catalog.packages[0], catalog, request,
      signal: new AbortController().signal })).rejects.toThrow("Allow browser storage");
    sessionStorage.setItem("havnai.account-checkout.v1:acct_alice:starter", "not json");
    await expect(start()).rejects.toThrow("previous checkout needs review");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not expose a checkout result after an account switch abort", async () => {
    const controller = new AbortController();
    request.mockImplementationOnce(async () => { controller.abort(); return result; });
    await expect(start("acct_alice", catalog, controller.signal)).rejects.toThrow();
  });

  it("rejects an unexpected redirect destination", async () => {
    request.mockResolvedValueOnce({ ...result, checkout_url: "https://evil.example/" });
    await expect(start()).rejects.toThrow("unexpected address");
  });

  it("fails closed on invalid pricing or executable policy links", () => {
    expect(parseCreditCatalog(catalog)).toEqual(catalog);
    expect(() => parseCreditCatalog({ ...catalog, terms_url: "javascript:alert(1)" })).toThrow();
    expect(() => parseCreditCatalog({ ...catalog, packages: [{ ...catalog.packages[0], price_cents: -1 }] })).toThrow();
  });
});
