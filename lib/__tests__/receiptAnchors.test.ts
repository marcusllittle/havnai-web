import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importHavnaiFresh() {
  vi.resetModules();
  return import("../havnai");
}

describe("Astra receipt anchor API", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_HAVNAI_API_BASE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches public receipt batches from the coordinator", async () => {
    const payload = {
      batches: [],
      unbatched_receipt_count: 3,
      network: "sepolia",
      chain_id: 11155111,
      treasury_wallet: "0x" + "1".repeat(40),
      minimum_confirmations: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const result = await havnai.fetchAstraReceiptBatches(75);

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/astra/receipts/batches?limit=75");
    expect(result.unbatched_receipt_count).toBe(3);
    expect(result.chain_id).toBe(11155111);
  });

  it("submits a Sepolia transaction for coordinator verification", async () => {
    const response = { status: "pending", pending: true, confirmations: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const txHash = `0x${"a".repeat(64)}`;
    const result = await havnai.submitAstraReceiptBatchAnchor(12, txHash);

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/astra/receipts/batches/12/anchor");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ tx_hash: txHash }),
    });
    expect(result.status).toBe("pending");
  });
});
