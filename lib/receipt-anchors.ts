import { getAddress } from "ethers";
import {
  type AstraReceiptAnchorResponse,
  type AstraReceiptBatch,
  submitAstraReceiptBatchAnchor,
} from "./havnai";
import { ensureSepoliaNetwork, getBrowserProvider } from "./hai-token";
import { ensureInjectedProvider } from "./wallet";

export type ReceiptAnchorProgress =
  | "connecting"
  | "switching_network"
  | "awaiting_transaction"
  | "confirming"
  | "registering";

export async function anchorReceiptBatchOnSepolia(
  batch: AstraReceiptBatch,
  confirmations: number,
  onProgress?: (step: ReceiptAnchorProgress, txHash?: string) => void
): Promise<AstraReceiptAnchorResponse> {
  const treasury = batch.anchor_payload.from || batch.anchor_payload.to;
  if (!treasury || !batch.anchor_payload.to) {
    throw new Error("Coordinator treasury wallet is not configured.");
  }
  if (batch.anchor_payload.chain_id !== 11155111 || batch.anchor_payload.network !== "sepolia") {
    throw new Error("Receipt batch is not configured for Sepolia.");
  }

  onProgress?.("connecting");
  const selection = await ensureInjectedProvider();
  if (!selection.provider) {
    throw selection.error || new Error("MetaMask is unavailable.");
  }

  onProgress?.("switching_network");
  await ensureSepoliaNetwork(selection.provider);
  const provider = getBrowserProvider(selection.provider);
  const signer = await provider.getSigner();
  const signerWallet = getAddress(await signer.getAddress());
  if (signerWallet.toLowerCase() !== treasury.toLowerCase()) {
    throw new Error(`Connected wallet ${signerWallet} is not the treasury wallet.`);
  }

  onProgress?.("awaiting_transaction");
  const transaction = await signer.sendTransaction({
    to: getAddress(batch.anchor_payload.to),
    value: "0x0",
    data: batch.anchor_payload.calldata,
  });
  onProgress?.("confirming", transaction.hash);
  const receipt = await transaction.wait(Math.max(1, confirmations));
  if (!receipt || receipt.status !== 1) {
    throw new Error("Receipt anchor transaction failed on Sepolia.");
  }

  onProgress?.("registering", transaction.hash);
  return submitAstraReceiptBatchAnchor(batch.batch_id, transaction.hash);
}

export async function verifyPendingReceiptBatchAnchor(
  batch: AstraReceiptBatch
): Promise<AstraReceiptAnchorResponse> {
  if (!batch.anchor_tx_hash) {
    throw new Error("Pending batch has no transaction hash.");
  }
  return submitAstraReceiptBatchAnchor(batch.batch_id, batch.anchor_tx_hash);
}
