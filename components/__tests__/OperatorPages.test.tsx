import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunANodePage from "../../pages/run-a-node";
import NodeRewardsPage from "../../pages/node-rewards";
import ReceiptAnchorsPage from "../../pages/receipt-anchors";
import { NodeAppDownload } from "../NodeAppDownload";
import * as api from "../../lib/havnai";
import * as rewards from "../../lib/node-reward-claims";
import * as receipts from "../../lib/receipt-anchors";

const { wallet } = vi.hoisted(() => ({ wallet: { activeWallet: null as string | null, connectedWallet: null as string | null, source: "none", connecting: false, connect: vi.fn() } }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../WalletProvider", () => ({ useWallet: () => wallet }));
vi.mock("../../lib/apiBase", () => ({ getApiBase: () => "/api" }));
vi.mock("../../lib/havnai", async original => ({ ...await original<typeof import("../../lib/havnai")>(), fetchNodeRewardBatches: vi.fn(), fetchNodeRewardClaims: vi.fn(), fetchAstraReceiptBatches: vi.fn(), createNodeRewardBatchWithMetaMask: vi.fn(), createAstraReceiptBatchWithMetaMask: vi.fn() }));
vi.mock("../../lib/node-reward-claims", () => ({ claimNodeRewardOnSepolia: vi.fn(), fundAndPublishNodeRewardBatch: vi.fn(), verifyPendingNodeRewardBatch: vi.fn(), verifyPendingNodeRewardClaim: vi.fn() }));
vi.mock("../../lib/receipt-anchors", () => ({ anchorReceiptBatchOnSepolia: vi.fn(), verifyPendingReceiptBatchAnchor: vi.fn() }));
const walletA = `0x${"1".repeat(40)}`; const walletB = `0x${"2".repeat(40)}`; const rootHash = `0x${"a".repeat(64)}`;
const claim = { batch_id: 8, leaf_index: 0, wallet: walletA, amount_hai: "12.5", payout_count: 10, node_ids: ["north"], valid: true, claimed: false, batch_status: "published", minimum_confirmations: 2 } as api.NodeRewardClaim;
const release = { tag_name: "desktop-v1.2", assets: [{ name: "havnai-setup.exe", size: 12000000, browser_download_url: "https://example.test/havnai.exe" }, { name: "havnai-aarch64.dmg", size: 15000000, browser_download_url: "https://example.test/havnai.dmg" }] };

describe("Operator setup and ledgers", () => {
  let container: HTMLDivElement; let root: Root; let copy: ReturnType<typeof vi.fn>;
  const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(node => node.textContent?.trim() === label)!;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    wallet.activeWallet = null; wallet.connectedWallet = null; wallet.source = "none";
    copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { userAgent: "iPhone", clipboard: { writeText: copy } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [release] }));
    vi.mocked(api.fetchNodeRewardBatches).mockResolvedValue({ batches: [], unbatched_payout_count: 0, treasury_wallet: walletB, minimum_confirmations: 2 } as api.NodeRewardBatchesResponse);
    vi.mocked(api.fetchNodeRewardClaims).mockResolvedValue({ claims: [] } as unknown as api.NodeRewardClaimsResponse);
    vi.mocked(api.fetchAstraReceiptBatches).mockResolvedValue({ batches: [], unbatched_receipt_count: 0, treasury_wallet: walletB, minimum_confirmations: 2 } as api.AstraReceiptBatchesResponse);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("offers release assets and makes Windows installation requirements visible", async () => {
    await render(<NodeAppDownload />);
    expect(container.querySelectorAll(".setup-downloads a")).toHaveLength(2);
    expect(container.textContent).toContain("the app installs the node natively");
    expect(container.textContent).toContain("Version 1.2");
    expect(container.querySelector<HTMLAnchorElement>('.setup-downloads a')?.href).toBe("https://example.test/havnai.exe");
    expect(container.querySelector(".is-recommended")).toBeNull();
  });

  it("distinguishes failed release lookup from no installers and retries", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    await render(<NodeAppDownload />);
    expect(container.textContent).toContain("Desktop downloads could not be loaded");
    expect(container.textContent).not.toContain("No desktop installers");
    await act(async () => button("Retry downloads").click());
    expect(container.querySelectorAll(".setup-downloads a")).toHaveLength(2);
  });

  it("keeps setup commands copyable and handles clipboard denial", async () => {
    copy.mockRejectedValueOnce(new Error("Denied"));
    await render(<RunANodePage />);
    await act(async () => button("Copy command").click());
    expect(container.textContent).toContain("Select and copy the command below");
    expect(container.querySelector('[aria-label="Node install command"]')?.textContent).toBe("curl -fsSL https://joinhavn.io/api/installers/install-node.sh | bash -s -- --server https://joinhavn.io/api");
    await act(async () => button("Copy command").click());
    expect(button("Copied!")).toBeDefined();
    expect(container.querySelectorAll(".setup-faq details")).toHaveLength(7);
  });

  it("does not present a failed rewards request as zero or an empty wallet", async () => {
    wallet.activeWallet = walletA;
    vi.mocked(api.fetchNodeRewardClaims).mockRejectedValueOnce(new Error("Offline"));
    await render(<NodeRewardsPage />);
    expect(container.textContent).toContain("Wallet claims are unavailable");
    expect(container.textContent).not.toContain("No reward claims found");
    expect(container.querySelector(".node-reward-metrics")?.textContent).not.toContain("0 HAI");
    await act(async () => button("Retry rewards").click());
    expect(container.textContent).toContain("No reward claims found");
    expect(api.createNodeRewardBatchWithMetaMask).not.toHaveBeenCalled();
  });

  it("ignores claims from an old wallet request after the wallet changes", async () => {
    wallet.activeWallet = walletA;
    let resolveOld!: (value: api.NodeRewardClaimsResponse) => void;
    vi.mocked(api.fetchNodeRewardClaims).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await render(<NodeRewardsPage />);
    wallet.activeWallet = walletB;
    await render(<NodeRewardsPage />);
    await act(async () => resolveOld({ claims: [claim] } as api.NodeRewardClaimsResponse));
    expect(container.querySelector(".node-reward-row.claim")).toBeNull();
    expect(container.textContent).toContain("No reward claims found");
  });

  it("keeps a claim disabled when the connected wallet does not own its proof", async () => {
    wallet.activeWallet = walletA; wallet.connectedWallet = walletB;
    vi.mocked(api.fetchNodeRewardClaims).mockResolvedValue({ claims: [claim] } as api.NodeRewardClaimsResponse);
    await render(<NodeRewardsPage />);
    expect(button("Claim HAI").disabled).toBe(true);
    expect(rewards.claimNodeRewardOnSepolia).not.toHaveBeenCalled();
  });

  it("does not reload an old wallet when its confirmation poll finishes", async () => {
    vi.useFakeTimers();
    wallet.activeWallet = walletA;
    vi.mocked(api.fetchNodeRewardBatches).mockResolvedValue({ batches: [{ batch_id: 9, status: "pending", publish_tx_hash: rootHash }], unbatched_payout_count: 0 } as api.NodeRewardBatchesResponse);
    let finishVerification!: (value: Awaited<ReturnType<typeof rewards.verifyPendingNodeRewardBatch>>) => void;
    vi.mocked(rewards.verifyPendingNodeRewardBatch).mockImplementationOnce(() => new Promise(resolve => { finishVerification = resolve; }));
    await render(<NodeRewardsPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    wallet.activeWallet = walletB;
    await render(<NodeRewardsPage />);
    await act(async () => finishVerification({ status: "pending" } as Awaited<ReturnType<typeof rewards.verifyPendingNodeRewardBatch>>));
    expect(api.fetchNodeRewardClaims).toHaveBeenCalledTimes(2);
    expect(api.fetchNodeRewardClaims).toHaveBeenLastCalledWith(walletB);
  });

  it("filters receipt batches, retains transaction links, and copies the full root", async () => {
    vi.mocked(api.fetchAstraReceiptBatches).mockResolvedValue({ batches: [
      { batch_id: 1, status: "ready", merkle_root: rootHash, leaf_count: 8, created_at: 1789600000 },
      { batch_id: 2, status: "anchored", merkle_root: rootHash, leaf_count: 16, created_at: 1789600000, anchor_tx_hash: rootHash },
    ], unbatched_receipt_count: 0 } as api.AstraReceiptBatchesResponse);
    await render(<ReceiptAnchorsPage />);
    await act(async () => button("Anchored").click());
    expect(container.querySelectorAll(".receipt-anchor-row")).toHaveLength(1);
    expect(container.querySelector<HTMLAnchorElement>(".receipt-anchor-row-actions a")?.href).toBe(`https://sepolia.etherscan.io/tx/${rootHash}`);
    await act(async () => button("Copy Root").click());
    expect(copy).toHaveBeenCalledWith(rootHash);
    expect(container.querySelector(".receipt-full-root code")?.textContent).toBe(rootHash);
    expect(receipts.anchorReceiptBatchOnSepolia).not.toHaveBeenCalled();
  });

  it("shows a receipt load error with retry instead of empty history", async () => {
    vi.mocked(api.fetchAstraReceiptBatches).mockRejectedValueOnce(new Error("Offline"));
    await render(<ReceiptAnchorsPage />);
    expect(container.textContent).toContain("The receipt ledger is unavailable");
    expect(container.textContent).not.toContain("No receipt batches found");
    expect(button("Build Batch").disabled).toBe(true);
    await act(async () => button("Retry receipts").click());
    expect(container.textContent).toContain("No receipt batches found");
  });
});
