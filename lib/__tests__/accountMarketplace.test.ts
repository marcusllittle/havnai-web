import { afterEach, describe, expect, it, vi } from "vitest";
import { browseAccountMarket, creditUnits, marketCredits, marketPreview, pendingMarketIntent, submitMarketIntent } from "../accountMarketplace";
import type { AccountMarketListing } from "../accountMarketplace";
import { AccountRequestError } from "../../components/AccountProvider";

const purchase = { kind: "purchase" as const, listingId: 4, units: 1250 };
const receipt = { listing_id: 4, job_id: "job-image", price_units: 1250, sale_id: "sale-one" };
const storage = () => {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key) } as Storage;
};
afterEach(() => vi.unstubAllGlobals());

describe("Account marketplace transactions", () => {
  it("retries the identical purchase after a lost response and isolates accounts", async () => {
    const saved = storage();
    const request = vi.fn().mockRejectedValueOnce(new Error("connection lost")).mockResolvedValue(receipt);
    const access = { request, signal: new AbortController().signal };
    await expect(submitMarketIntent(saved, "alice", access, purchase)).rejects.toThrow("connection lost");
    expect(pendingMarketIntent(saved, "alice")?.kind).toBe("purchase");
    expect(pendingMarketIntent(saved, "bob")).toBeNull();
    await expect(submitMarketIntent(saved, "alice", access, purchase)).rejects.toThrow("Resume");
    expect(request).toHaveBeenCalledTimes(1);
    expect(await submitMarketIntent(saved, "alice", access)).toEqual(receipt);
    expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
    expect(pendingMarketIntent(saved, "alice")).toBeNull();
    expect(request.mock.calls[0][0]).toBe("/v2/marketplace/listings/4/purchase");
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ expected_price_units: 1250 });
  });

  it("retains ambiguous receipts and aborts but allows correcting rejected prices", async () => {
    const saved = storage();
    const controller = new AbortController();
    const request = vi.fn().mockResolvedValue({ ...receipt, price_units: 999 });
    const access = { request, signal: controller.signal };
    await expect(submitMarketIntent(saved, "alice", access, purchase)).rejects.toThrow("receipt");
    expect(pendingMarketIntent(saved, "alice")).not.toBeNull();
    request.mockRejectedValueOnce(new AccountRequestError("Price changed", "listing_price_changed"));
    await expect(submitMarketIntent(saved, "alice", access)).rejects.toThrow("Price changed");
    expect(pendingMarketIntent(saved, "alice")).toBeNull();
    request.mockImplementationOnce(async () => { controller.abort(); return receipt; });
    await expect(submitMarketIntent(saved, "alice", access, purchase)).rejects.toThrow();
    expect(pendingMarketIntent(saved, "alice")).not.toBeNull();
  });

  it("persists listing intent and forbids injecting wallet identity", async () => {
    const saved = storage(); const request = vi.fn().mockResolvedValue(receipt);
    const access = { request, signal: new AbortController().signal };
    const body = { job_id: "job-image", artifact_id: "artifact-image", title: "Coast", price_units: 1250 };
    await expect(submitMarketIntent(saved, "alice", access, { kind: "list", body: { ...body, wallet: "spoof" } as typeof body })).rejects.toThrow("valid listing");
    expect(request).not.toHaveBeenCalled();
    await submitMarketIntent(saved, "alice", access, { kind: "list", body });
    expect(request.mock.calls[0][0]).toBe("/v2/marketplace/listings");
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(body);
    expect(pendingMarketIntent(saved, "alice")).toBeNull();
  });

  it("fails before sending when request persistence fails", async () => {
    const saved = storage(); saved.setItem = () => { throw new Error("Storage unavailable"); };
    const request = vi.fn();
    await expect(submitMarketIntent(saved, "alice", { request, signal: new AbortController().signal }, purchase)).rejects.toThrow("Storage unavailable");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not silently replace a malformed pending intent", () => {
    const saved = storage(); saved.setItem("havnai.account-marketplace-request.v1:alice", "bad");
    expect(() => pendingMarketIntent(saved, "alice")).toThrow("needs review");
  });

  it("keeps all three credit decimals without float rounding or exponent input", () => {
    expect(creditUnits(" 1.001 ")).toBe(1001);
    expect(creditUnits("0.001")).toBe(1);
    expect(creditUnits("1000000000000")).toBe(1e15);
    expect(marketCredits(1001)).toContain("1.001");
    for (const value of ["0", "-1", "1.0001", "1e3", "NaN", "Infinity", "1000000000001"]) expect(() => creditUnits(value)).toThrow();
  });

  it("browses anonymously and accepts only the dedicated preview route", async () => {
    const item = { id: 4, price_units: 1250, scale: 1000, preview_url: "/v2/marketplace/listings/4/preview" } as AccountMarketListing;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ listings: [item], total: 1, limit: 24, offset: 0 })));
    vi.stubGlobal("fetch", fetcher);
    await browseAccountMarket(new URLSearchParams({ search: "coast" }), new AbortController().signal);
    expect(fetcher.mock.calls[0][0]).toBe("/api/v2/marketplace/listings?search=coast");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "omit", cache: "no-store" });
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
    expect(marketPreview(item)).toBe("/api/v2/marketplace/listings/4/preview");
    expect(marketPreview({ ...item, preview_url: "https://external.example/original" })).toBeUndefined();
    fetcher.mockResolvedValue(new Response("<html>error</html>", { status: 500 }));
    await expect(browseAccountMarket(new URLSearchParams(), new AbortController().signal)).rejects.toThrow("Could not load");
  });
});
