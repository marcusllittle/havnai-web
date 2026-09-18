import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "../../pages/pricing";
import WalletPage from "../../pages/wallet";
import * as api from "../../lib/havnai";

const { wallet } = vi.hoisted(() => ({ wallet: { activeWallet: null as string | null, connectedWallet: null as string | null, source: "none", connecting: false, connect: vi.fn() } }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../WalletProvider", () => ({ useWallet: () => wallet }));
vi.mock("../../lib/hai-token", () => ({ isHaiFundingConfigured: () => true, readHaiBalance: vi.fn(), transferHaiToTreasury: vi.fn(), ensureSepoliaNetwork: vi.fn(), getBrowserProvider: vi.fn() }));
vi.mock("../../lib/havnai", async original => ({
  ...await original<typeof import("../../lib/havnai")>(),
  fetchPackages: vi.fn(), fetchCreditReference: vi.fn(), fetchCredits: vi.fn(), fetchPaymentHistory: vi.fn(),
  fetchWalletRewards: vi.fn(), fetchHaiFundings: vi.fn(), fetchTesterDistributionRequests: vi.fn(),
  createCheckout: vi.fn(), convertCreditsWithMetaMask: vi.fn(), fundCreditsWithHai: vi.fn(), claimRewards: vi.fn(), requestTesterDistribution: vi.fn(),
}));
const balance: api.CreditBalance = { wallet: "preview", balance: 84, total_deposited: 100, total_spent: 16, credits_enabled: true };
const packages = { stripe_enabled: false, packages: [{ id: "creator", name: "Creator Pack", credits: 150, price_cents: 1200, description: "150 credits" }] };

describe("Pricing and wallet presentation", () => {
  let container: HTMLDivElement; let root: Root;
  const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.trim() === text)!;
  const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear(); wallet.activeWallet = null; wallet.connectedWallet = null; wallet.source = "none";
    vi.mocked(api.fetchPackages).mockResolvedValue(packages);
    vi.mocked(api.fetchCreditReference).mockResolvedValue({ credits_enabled: true, reference: [{ id: "image", label: "Image", credits_per_job: 1 }] });
    vi.mocked(api.fetchCredits).mockResolvedValue(balance);
    vi.mocked(api.fetchPaymentHistory).mockResolvedValue([]);
    vi.mocked(api.fetchWalletRewards).mockResolvedValue({ wallet: "preview", total_rewards: 12, claimable: 0, claimed: 12 });
    vi.mocked(api.fetchHaiFundings).mockResolvedValue({ fundings: [] } as unknown as api.HaiFundingsResponse);
    vi.mocked(api.fetchTesterDistributionRequests).mockResolvedValue({ requests: [], tester_distribution: { enabled: false } } as unknown as api.TesterDistributionRequestsResponse);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("keeps guest checkout, funding, and conversion disabled with labeled inputs", async () => {
    await render(<PricingPage />);
    expect(button("Connect wallet to buy").disabled).toBe(true);
    expect(button("Fund 100 Credits").disabled).toBe(true);
    expect(button("Convert").disabled).toBe(true);
    expect(container.querySelector('[aria-label="HAI amount to fund credits"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Confirmed funding transaction hash"]')).not.toBeNull();
    expect(container.querySelector<HTMLDetailsElement>(".account-convert")!.open).toBe(false);
    expect(api.createCheckout).not.toHaveBeenCalled();
    expect(api.fundCreditsWithHai).not.toHaveBeenCalled();
  });

  it("retries package loading and retains the deployment checkout restriction", async () => {
    wallet.activeWallet = "site-session"; wallet.source = "env";
    vi.mocked(api.fetchPackages).mockRejectedValueOnce(new Error("Offline"));
    await render(<PricingPage />);
    expect(container.querySelector(".pricing-card")).toBeNull();
    await act(async () => button("Try again").click());
    expect(container.textContent).toContain("$12.00");
    expect(button("Unavailable in alpha").disabled).toBe(true);
    expect(container.textContent).not.toContain("Best Value");
  });

  it("does not substitute old costs for an empty rate response", async () => {
    vi.mocked(api.fetchCreditReference).mockResolvedValue({ credits_enabled: true, reference: [] });
    await render(<PricingPage />);
    expect(container.textContent).toContain("Generation costs have not been published");
    expect(container.querySelector(".credit-rate-grid")).toBeNull();
    expect(container.textContent).not.toContain("SDXL Image");
  });

  it("distinguishes missing balances from disabled credits and recovers on refresh", async () => {
    wallet.activeWallet = "site-session"; wallet.source = "env";
    vi.mocked(api.fetchCredits).mockRejectedValueOnce(new Error("Offline"));
    await render(<WalletPage />);
    expect(container.textContent).toContain("Balance unavailable");
    expect(container.textContent).not.toContain("Credits not enabled");
    expect(container.querySelector(".page-container")).toBeNull();
    expect(container.querySelector(".chart-section")).toBeNull();
    await act(async () => button("Refresh balances").click());
    expect(container.textContent).toContain("84.0");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(api.claimRewards).not.toHaveBeenCalled();
  });

  it("does not show an empty request history alongside a failed request load", async () => {
    wallet.activeWallet = "site-session";
    vi.mocked(api.fetchTesterDistributionRequests).mockRejectedValueOnce(new Error("Request history unavailable"));
    await render(<WalletPage />);
    expect(container.textContent).toContain("Request history unavailable");
    expect(container.textContent).not.toContain("No test HAI requests have been submitted");
    expect(button("Request Test HAI").disabled).toBe(true);
  });

  it("retains funding history and its transaction link", async () => {
    wallet.activeWallet = "site-session";
    const hash = `0x${"a".repeat(64)}`;
    vi.mocked(api.fetchHaiFundings).mockResolvedValue({ fundings: [{ id: "fund-1", created_at: 1789600000, amount: 25, credits_granted: 25, status: "credited", tx_hash: hash }] } as unknown as api.HaiFundingsResponse);
    await render(<WalletPage />);
    const history = container.querySelector('[aria-label="HAI funding history table"]');
    expect(history?.textContent).toContain("credited");
    expect(history?.querySelector("a")?.href).toBe(`https://sepolia.etherscan.io/tx/${hash}`);
    expect(api.fundCreditsWithHai).not.toHaveBeenCalled();
  });
});
