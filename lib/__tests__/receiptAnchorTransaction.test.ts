import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AstraReceiptBatch } from "../havnai";

const mocks = vi.hoisted(() => ({
  ensureInjectedProvider: vi.fn(),
  ensureSepoliaNetwork: vi.fn(),
  getBrowserProvider: vi.fn(),
  submitAnchor: vi.fn(),
}));

vi.mock("../wallet", () => ({ ensureInjectedProvider: mocks.ensureInjectedProvider }));
vi.mock("../hai-token", () => ({
  ensureSepoliaNetwork: mocks.ensureSepoliaNetwork,
  getBrowserProvider: mocks.getBrowserProvider,
}));
vi.mock("../havnai", () => ({ submitAstraReceiptBatchAnchor: mocks.submitAnchor }));

import { anchorReceiptBatchOnSepolia } from "../receipt-anchors";

const TREASURY = "0x1111111111111111111111111111111111111111";
const TX_HASH = `0x${"a".repeat(64)}`;

const batch: AstraReceiptBatch = {
  batch_id: 9,
  schema_version: "receipt-merkle-batch.v1",
  merkle_root: "01".repeat(32),
  leaf_count: 4,
  status: "ready",
  created_at: 1,
  anchor_payload: {
    schema: "havnai.receipt-root.v1",
    network: "sepolia",
    chain_id: 11155111,
    from: TREASURY,
    to: TREASURY,
    value: "0x0",
    calldata: `0x${"12".repeat(62)}`,
  },
};

describe("receipt anchor wallet transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends exact zero-value calldata from treasury to itself", async () => {
    const injected = { request: vi.fn() };
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const sendTransaction = vi.fn().mockResolvedValue({ hash: TX_HASH, wait });
    mocks.ensureInjectedProvider.mockResolvedValue({ provider: injected, error: null });
    mocks.getBrowserProvider.mockReturnValue({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(TREASURY),
        sendTransaction,
      }),
    });
    mocks.submitAnchor.mockResolvedValue({ status: "anchored" });

    const result = await anchorReceiptBatchOnSepolia(batch, 2);

    expect(mocks.ensureSepoliaNetwork).toHaveBeenCalledWith(injected);
    expect(sendTransaction).toHaveBeenCalledWith({
      to: TREASURY,
      value: "0x0",
      data: batch.anchor_payload.calldata,
    });
    expect(wait).toHaveBeenCalledWith(2);
    expect(mocks.submitAnchor).toHaveBeenCalledWith(9, TX_HASH);
    expect(result.status).toBe("anchored");
  });

  it("rejects a connected wallet that is not the treasury", async () => {
    mocks.ensureInjectedProvider.mockResolvedValue({ provider: { request: vi.fn() }, error: null });
    mocks.getBrowserProvider.mockReturnValue({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue("0x2222222222222222222222222222222222222222"),
      }),
    });

    await expect(anchorReceiptBatchOnSepolia(batch, 2)).rejects.toThrow("is not the treasury wallet");
    expect(mocks.submitAnchor).not.toHaveBeenCalled();
  });
});
