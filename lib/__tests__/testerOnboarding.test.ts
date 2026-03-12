import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importHavnaiFresh() {
  vi.resetModules();
  return await import("../havnai");
}

describe("tester onboarding + HAI distribution API helpers", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_HAVNAI_API_BASE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchHaiFundings requests wallet funding history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wallet: "0xabc",
        fundings: [{ id: 1, amount: 10, credits_granted: 10, status: "completed", created_at: 1 }],
        hai_funding_enabled: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const result = await havnai.fetchHaiFundings("0xabc");

    expect(result.wallet).toBe("0xabc");
    expect(result.fundings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/credits/hai-fundings?wallet=0xabc");
  });

  it("requestTesterDistribution posts amount and note to canonical endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "pending",
        request: { id: 7, wallet: "0xabc", requested_hai: 100, status: "pending", credits_granted: 0, created_at: 1, updated_at: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const result = await havnai.requestTesterDistribution("0xabc", 100, "need credits");

    expect(result.status).toBe("pending");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/credits/tester-distribution/request");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      wallet: "0xabc",
      requested_hai: 100,
      request_note: "need credits",
    });
  });

  it("fetchTesterDistributionRequests enforces limit clamp and wallet query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wallet: "0xabc",
        requests: [],
        tester_distribution: { enabled: true, allowlist_enforced: false, default_request_hai: 100, cooldown_hours: 24 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const result = await havnai.fetchTesterDistributionRequests("0xabc", 999);

    expect(result.wallet).toBe("0xabc");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/credits/tester-distribution/requests?wallet=0xabc&limit=200");
  });

  it("surfaces backend tester-distribution errors to UI callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: (name: string) => (name === "content-type" ? "application/json" : null) },
      json: async () => ({
        error: "wallet_not_allowed",
        message: "Wallet is not in the trusted tester allowlist.",
      }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    await expect(havnai.requestTesterDistribution("0xabc", 50)).rejects.toMatchObject({
      code: "wallet_not_allowed",
      status: 403,
    });
  });
});
