import { getAddress, Interface } from "ethers";
import {
  confirmNodeRewardClaim,
  type NodeRewardBatch,
  type NodeRewardClaim,
  type NodeRewardClaimResponse,
  type NodeRewardPublishResponse,
  submitNodeRewardBatchPublish,
} from "./havnai";
import { ensureSepoliaNetwork, getBrowserProvider } from "./hai-token";
import { ensureInjectedProvider } from "./wallet";

const ERC20_INTERFACE = new Interface([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const CLAIM_INTERFACE = new Interface([
  "function totalOutstanding() view returns (uint256)",
  "function claim(uint256 batchId,uint256 index,address account,uint256 amount,bytes32[] proof)",
]);

export type NodeRewardPublishProgress =
  | "connecting"
  | "switching_network"
  | "checking_funding"
  | "awaiting_funding"
  | "confirming_funding"
  | "awaiting_publish"
  | "confirming_publish"
  | "registering";

export type NodeRewardClaimProgress =
  | "connecting"
  | "switching_network"
  | "awaiting_claim"
  | "confirming_claim"
  | "registering";

interface FundingState {
  balance: bigint;
  outstanding: bigint;
  required: bigint;
  deficit: bigint;
}

function requireAddress(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`${label} is not configured.`);
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${label} is invalid.`);
  }
}

function requirePositiveAmount(value: string): bigint {
  let amount: bigint;
  try {
    amount = BigInt(value);
  } catch {
    throw new Error("Reward amount is invalid.");
  }
  if (amount <= BigInt(0)) throw new Error("Reward amount must be positive.");
  return amount;
}

function assertSepolia(network: string, chainId: number): void {
  if (network !== "sepolia" || chainId !== 11155111) {
    throw new Error("Node rewards are not configured for Sepolia.");
  }
}

async function readFundingState(
  provider: ReturnType<typeof getBrowserProvider>,
  tokenAddress: string,
  contractAddress: string,
  batchAmount: bigint
): Promise<FundingState> {
  const [balanceResult, outstandingResult] = await Promise.all([
    provider.call({
      to: tokenAddress,
      data: ERC20_INTERFACE.encodeFunctionData("balanceOf", [contractAddress]),
    }),
    provider.call({
      to: contractAddress,
      data: CLAIM_INTERFACE.encodeFunctionData("totalOutstanding"),
    }),
  ]);
  const balance = ERC20_INTERFACE.decodeFunctionResult("balanceOf", balanceResult)[0] as bigint;
  const outstanding = CLAIM_INTERFACE.decodeFunctionResult("totalOutstanding", outstandingResult)[0] as bigint;
  const required = outstanding + batchAmount;
  return {
    balance,
    outstanding,
    required,
    deficit: required > balance ? required - balance : BigInt(0),
  };
}

export async function fundAndPublishNodeRewardBatch(
  batch: NodeRewardBatch,
  confirmations: number,
  onProgress?: (step: NodeRewardPublishProgress, txHash?: string) => void
): Promise<NodeRewardPublishResponse> {
  assertSepolia(batch.network, batch.chain_id);
  assertSepolia(batch.publish_payload.network, batch.publish_payload.chain_id);
  if (batch.status !== "ready") throw new Error("Only ready reward batches can be published.");

  const treasury = requireAddress(batch.treasury_wallet || batch.publish_payload.from, "Treasury wallet");
  const contract = requireAddress(batch.claim_contract || batch.publish_payload.to, "Reward claim contract");
  const token = requireAddress(batch.token_address, "HAI token");
  const payloadTarget = requireAddress(batch.publish_payload.to, "Publish target");
  if (payloadTarget !== contract) throw new Error("Publish target does not match the reward contract.");
  if (batch.publish_payload.value !== "0x0") throw new Error("Publish transaction must have zero value.");
  const amount = requirePositiveAmount(batch.total_amount_wei);

  onProgress?.("connecting");
  const selection = await ensureInjectedProvider();
  if (!selection.provider) throw selection.error || new Error("MetaMask is unavailable.");

  onProgress?.("switching_network");
  await ensureSepoliaNetwork(selection.provider);
  const provider = getBrowserProvider(selection.provider);
  const signer = await provider.getSigner();
  const signerWallet = getAddress(await signer.getAddress());
  if (signerWallet !== treasury) {
    throw new Error(`Connected wallet ${signerWallet} is not the treasury wallet.`);
  }

  onProgress?.("checking_funding");
  const funding = await readFundingState(provider, token, contract, amount);
  if (funding.deficit > BigInt(0)) {
    onProgress?.("awaiting_funding");
    const fundingTx = await signer.sendTransaction({
      to: token,
      value: "0x0",
      data: ERC20_INTERFACE.encodeFunctionData("transfer", [contract, funding.deficit]),
    });
    onProgress?.("confirming_funding", fundingTx.hash);
    const fundingReceipt = await fundingTx.wait(Math.max(1, confirmations));
    if (!fundingReceipt || fundingReceipt.status !== 1) {
      throw new Error("Reward contract funding failed on Sepolia.");
    }
  }

  onProgress?.("awaiting_publish");
  const publishTx = await signer.sendTransaction({
    to: contract,
    value: "0x0",
    data: batch.publish_payload.calldata,
  });
  onProgress?.("confirming_publish", publishTx.hash);
  const publishReceipt = await publishTx.wait(Math.max(1, confirmations));
  if (!publishReceipt || publishReceipt.status !== 1) {
    throw new Error("Reward root publication failed on Sepolia.");
  }

  onProgress?.("registering", publishTx.hash);
  return submitNodeRewardBatchPublish(batch.batch_id, publishTx.hash);
}

export async function claimNodeRewardOnSepolia(
  claim: NodeRewardClaim,
  confirmations: number,
  onProgress?: (step: NodeRewardClaimProgress, txHash?: string) => void
): Promise<NodeRewardClaimResponse> {
  assertSepolia(claim.network, claim.chain_id);
  if (claim.batch_status !== "published") throw new Error("Reward root is not published yet.");
  if (claim.claimed) throw new Error("This reward has already been claimed.");
  if (!claim.valid) throw new Error("Coordinator rejected the local reward proof.");

  const contract = requireAddress(claim.claim_contract, "Reward claim contract");
  const operator = requireAddress(claim.wallet, "Operator wallet");
  const amount = requirePositiveAmount(claim.amount_wei);

  onProgress?.("connecting");
  const selection = await ensureInjectedProvider();
  if (!selection.provider) throw selection.error || new Error("MetaMask is unavailable.");

  onProgress?.("switching_network");
  await ensureSepoliaNetwork(selection.provider);
  const provider = getBrowserProvider(selection.provider);
  const signer = await provider.getSigner();
  const signerWallet = getAddress(await signer.getAddress());
  if (signerWallet !== operator) {
    throw new Error(`Connected wallet ${signerWallet} is not the operator wallet.`);
  }

  onProgress?.("awaiting_claim");
  const transaction = await signer.sendTransaction({
    to: contract,
    value: "0x0",
    data: CLAIM_INTERFACE.encodeFunctionData("claim", [
      claim.batch_id,
      claim.leaf_index,
      operator,
      amount,
      claim.proof.map((item) => `0x${item.replace(/^0x/, "")}`),
    ]),
  });
  onProgress?.("confirming_claim", transaction.hash);
  const receipt = await transaction.wait(Math.max(1, confirmations));
  if (!receipt || receipt.status !== 1) {
    throw new Error("Node reward claim failed on Sepolia.");
  }

  onProgress?.("registering", transaction.hash);
  return confirmNodeRewardClaim(claim.batch_id, claim.leaf_index, transaction.hash);
}

export async function verifyPendingNodeRewardBatch(
  batch: NodeRewardBatch
): Promise<NodeRewardPublishResponse> {
  if (!batch.publish_tx_hash) throw new Error("Pending reward batch has no transaction hash.");
  return submitNodeRewardBatchPublish(batch.batch_id, batch.publish_tx_hash);
}

export async function verifyPendingNodeRewardClaim(
  claim: NodeRewardClaim,
  txHash: string
): Promise<NodeRewardClaimResponse> {
  return confirmNodeRewardClaim(claim.batch_id, claim.leaf_index, txHash);
}
