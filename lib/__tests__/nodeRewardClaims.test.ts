import { beforeEach, describe, expect, it, vi } from "vitest";
import { Interface } from "ethers";
import type { NodeRewardBatch, NodeRewardClaim } from "../havnai";

const mocks = vi.hoisted(() => ({
  ensureInjectedProvider: vi.fn(),
  ensureSepoliaNetwork: vi.fn(),
  getBrowserProvider: vi.fn(),
  submitPublish: vi.fn(),
  confirmClaim: vi.fn(),
}));

vi.mock("../wallet", () => ({ ensureInjectedProvider: mocks.ensureInjectedProvider }));
vi.mock("../hai-token", () => ({
  ensureSepoliaNetwork: mocks.ensureSepoliaNetwork,
  getBrowserProvider: mocks.getBrowserProvider,
}));
vi.mock("../havnai", () => ({
  submitNodeRewardBatchPublish: mocks.submitPublish,
  confirmNodeRewardClaim: mocks.confirmClaim,
}));

import {
  claimNodeRewardOnSepolia,
  fundAndPublishNodeRewardBatch,
} from "../node-reward-claims";

const TREASURY = "0x1111111111111111111111111111111111111111";
const OPERATOR = "0x2222222222222222222222222222222222222222";
const CONTRACT = "0x3333333333333333333333333333333333333333";
const TOKEN = "0x4444444444444444444444444444444444444444";
const FUND_TX = `0x${"a".repeat(64)}`;
const PUBLISH_TX = `0x${"b".repeat(64)}`;
const CLAIM_TX = `0x${"c".repeat(64)}`;

const erc20Interface = new Interface([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const claimInterface = new Interface([
  "function totalOutstanding() view returns (uint256)",
  "function claim(uint256 batchId,uint256 index,address account,uint256 amount,bytes32[] proof)",
]);

const batch: NodeRewardBatch = {
  batch_id: 7,
  schema_version: "havnai-node-payout-claims.v1",
  merkle_root: "12".repeat(32),
  leaf_count: 1,
  payout_count: 3,
  total_amount_wei: "500",
  total_amount_hai: "0.0000000000000005",
  status: "ready",
  created_at: 1,
  network: "sepolia",
  chain_id: 11155111,
  treasury_wallet: TREASURY,
  claim_contract: CONTRACT,
  token_address: TOKEN,
  minimum_confirmations: 2,
  publish_payload: {
    network: "sepolia",
    chain_id: 11155111,
    from: TREASURY,
    to: CONTRACT,
    value: "0x0",
    calldata: `0x${"ab".repeat(100)}`,
  },
};

const claim: NodeRewardClaim = {
  schema_version: "havnai-node-payout-claims.v1",
  batch_id: 7,
  leaf_index: 2,
  wallet: OPERATOR,
  amount_wei: "500",
  amount_hai: "0.0000000000000005",
  leaf_hash: "34".repeat(32),
  merkle_root: "12".repeat(32),
  proof: ["56".repeat(32), "78".repeat(32)],
  node_ids: ["operator-1"],
  payout_count: 3,
  batch_status: "published",
  claimed: false,
  valid: true,
  network: "sepolia",
  chain_id: 11155111,
  claim_contract: CONTRACT,
  token_address: TOKEN,
  minimum_confirmations: 2,
};

describe("node reward wallet transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureInjectedProvider.mockResolvedValue({ provider: { request: vi.fn() }, error: null });
  });

  it("publishes the coordinator's exact calldata when the contract is solvent", async () => {
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const sendTransaction = vi.fn().mockResolvedValue({ hash: PUBLISH_TX, wait });
    const provider = {
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(TREASURY),
        sendTransaction,
      }),
      call: vi.fn()
        .mockResolvedValueOnce(erc20Interface.encodeFunctionResult("balanceOf", [700n]))
        .mockResolvedValueOnce(claimInterface.encodeFunctionResult("totalOutstanding", [200n])),
    };
    mocks.getBrowserProvider.mockReturnValue(provider);
    mocks.submitPublish.mockResolvedValue({ status: "published" });

    await fundAndPublishNodeRewardBatch(batch, 2);

    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(sendTransaction).toHaveBeenCalledWith({
      to: CONTRACT,
      value: "0x0",
      data: batch.publish_payload.calldata,
    });
    expect(wait).toHaveBeenCalledWith(2);
    expect(mocks.submitPublish).toHaveBeenCalledWith(7, PUBLISH_TX);
  });

  it("funds only the exact liability deficit before publishing", async () => {
    const fundingWait = vi.fn().mockResolvedValue({ status: 1 });
    const publishWait = vi.fn().mockResolvedValue({ status: 1 });
    const sendTransaction = vi.fn()
      .mockResolvedValueOnce({ hash: FUND_TX, wait: fundingWait })
      .mockResolvedValueOnce({ hash: PUBLISH_TX, wait: publishWait });
    mocks.getBrowserProvider.mockReturnValue({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(TREASURY),
        sendTransaction,
      }),
      call: vi.fn()
        .mockResolvedValueOnce(erc20Interface.encodeFunctionResult("balanceOf", [100n]))
        .mockResolvedValueOnce(claimInterface.encodeFunctionResult("totalOutstanding", [200n])),
    });
    mocks.submitPublish.mockResolvedValue({ status: "published" });

    await fundAndPublishNodeRewardBatch(batch, 2);

    expect(sendTransaction.mock.calls[0][0]).toEqual({
      to: TOKEN,
      value: "0x0",
      data: erc20Interface.encodeFunctionData("transfer", [CONTRACT, 600n]),
    });
    expect(sendTransaction.mock.calls[1][0]).toEqual({
      to: CONTRACT,
      value: "0x0",
      data: batch.publish_payload.calldata,
    });
  });

  it("submits the proof-bound claim from the operator wallet", async () => {
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const sendTransaction = vi.fn().mockResolvedValue({ hash: CLAIM_TX, wait });
    mocks.getBrowserProvider.mockReturnValue({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(OPERATOR),
        sendTransaction,
      }),
    });
    mocks.confirmClaim.mockResolvedValue({ status: "claimed" });

    await claimNodeRewardOnSepolia(claim, 2);

    expect(sendTransaction).toHaveBeenCalledWith({
      to: CONTRACT,
      value: "0x0",
      data: claimInterface.encodeFunctionData("claim", [
        7,
        2,
        OPERATOR,
        500n,
        [`0x${claim.proof[0]}`, `0x${claim.proof[1]}`],
      ]),
    });
    expect(wait).toHaveBeenCalledWith(2);
    expect(mocks.confirmClaim).toHaveBeenCalledWith(7, 2, CLAIM_TX);
  });

  it("rejects a signer that is not the proof-bound operator", async () => {
    const sendTransaction = vi.fn();
    mocks.getBrowserProvider.mockReturnValue({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(TREASURY),
        sendTransaction,
      }),
    });

    await expect(claimNodeRewardOnSepolia(claim, 2)).rejects.toThrow("is not the operator wallet");
    expect(sendTransaction).not.toHaveBeenCalled();
  });
});
