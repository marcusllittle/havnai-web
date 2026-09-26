import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarketplacePage from "../../pages/marketplace";
import * as api from "../../lib/havnai";

const { wallet, router } = vi.hoisted(() => ({
  wallet: { activeWallet: null as string | null, connectedWallet: null as string | null, source: "none", connecting: false, connect: vi.fn() },
  router: { isReady: true, pathname: "/marketplace", query: {} as Record<string, string>, replace: vi.fn() },
}));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../WalletProvider", () => ({ useWallet: () => wallet }));
vi.mock("../../lib/havnai", async original => ({
  ...await original<typeof import("../../lib/havnai")>(),
  fetchGalleryBrowse: vi.fn(), fetchMarketplace: vi.fn(), fetchMyGalleryListings: vi.fn(),
  fetchGalleryCollection: vi.fn(), fetchCredits: vi.fn(), fetchOwnershipHistory: vi.fn(), purchaseGalleryListing: vi.fn(),
}));
const listing: api.GalleryListing = { id: 4, job_id: "job-four", seller_wallet: "0x2222222222222222222222222222222222222222", owner_wallet: "0x2222222222222222222222222222222222222222", title: "Quiet coast", description: "Morning light", price_credits: 25, asset_type: "image", listed: true, sold: false, status: "active", image_url: "https://example.com/coast.png", created_at: 1789660000, updated_at: 1789660000 };
const catalog = (items = [listing]) => ({ listings: items, total: items.length, limit: 24, offset: 0, sort: "newest" });

describe("Marketplace browsing and purchase entry", () => {
  let container: HTMLDivElement;
  let root: Root;
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.trim() === label)!;
  const render = async () => { await act(async () => root.render(<MarketplacePage />)); };
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    wallet.activeWallet = null; wallet.connectedWallet = null; wallet.source = "none";
    router.query = {};
    vi.mocked(api.fetchGalleryBrowse).mockResolvedValue(catalog());
    vi.mocked(api.fetchMarketplace).mockResolvedValue({ workflows: [], total: 0, offset: 0, limit: 20 });
    vi.mocked(api.fetchMyGalleryListings).mockResolvedValue([]);
    vi.mocked(api.fetchGalleryCollection).mockResolvedValue([]);
    vi.mocked(api.fetchOwnershipHistory).mockResolvedValue([]);
    vi.mocked(api.fetchCredits).mockResolvedValue({ balance: 100 } as api.CreditsResponse);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("submits search deliberately and clears unmatched filters", async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>('[aria-label="Search gallery listings"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "  sunrise  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(api.fetchGalleryBrowse).toHaveBeenCalledTimes(1);
    vi.mocked(api.fetchGalleryBrowse).mockResolvedValue(catalog([]));
    await act(async () => button("Search").click());
    expect(api.fetchGalleryBrowse).toHaveBeenLastCalledWith(expect.objectContaining({ search: "sunrise", offset: 0 }));
    expect(container.textContent).toContain("Nothing matches just yet.");
    await act(async () => button("Clear filters").click());
    expect(input.value).toBe("");
    expect(container.textContent).toContain("A space for something original.");
  });

  it("distinguishes failure from empty catalogs and retries both catalogs", async () => {
    vi.mocked(api.fetchGalleryBrowse).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(api.fetchMarketplace).mockRejectedValueOnce(new Error("Offline"));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("out of reach");
    expect(container.querySelector(".library-empty")).toBeNull();
    await act(async () => button("Try again").click());
    expect(container.querySelector(".marketplace-gallery-card")).not.toBeNull();
    await act(async () => button("Workflows").click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => button("Try again").click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("Your next idea starts with a setup.");
  });

  it("honors direct links without rewriting them during initialization", async () => {
    router.query = { tab: "workflows" };
    await render();
    expect(button("Workflows").getAttribute("aria-pressed")).toBe("true");
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => button("Gallery").click());
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/marketplace", query: { tab: "gallery", galleryView: "browse" } }, undefined, { shallow: true });
  });

  it("keeps guest purchases disabled and restores focus after Escape", async () => {
    await render();
    const card = container.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!;
    card.focus(); await act(async () => card.click());
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(button("Close"));
    expect(button("Connect wallet to buy").disabled).toBe(true);
    expect(api.purchaseGalleryListing).not.toHaveBeenCalled();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(card);
    expect(document.body.style.overflow).toBe("");
  });

  it("only purchases on the explicit buy action with the displayed price", async () => {
    wallet.activeWallet = wallet.connectedWallet = "0x1111111111111111111111111111111111111111"; wallet.source = "connected";
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
    expect(api.purchaseGalleryListing).not.toHaveBeenCalled();
    vi.mocked(api.purchaseGalleryListing).mockRejectedValueOnce(new Error("Insufficient credits"));
    await act(async () => button("Buy for 25.0 credits").click());
    expect(api.purchaseGalleryListing).toHaveBeenCalledWith(4, wallet.connectedWallet, 25);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Insufficient credits");
  });

  it("keeps a failed preview readable and its listing usable", async () => {
    await render();
    await act(async () => container.querySelector<HTMLImageElement>(".marketplace-gallery-card img")!.dispatchEvent(new Event("error")));
    expect(container.textContent).toContain("Preview unavailable");
    await act(async () => container.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("does not show the previous listing's late ownership history", async () => {
    let finishHistory: (history: api.GalleryOwnershipEvent[]) => void = () => {};
    vi.mocked(api.fetchGalleryBrowse).mockResolvedValue(catalog([listing, { ...listing, id: 5, job_id: "job-five", title: "Amber hour" }]));
    vi.mocked(api.fetchOwnershipHistory).mockImplementationOnce(() => new Promise(resolve => { finishHistory = resolve; }));
    await render();
    await act(async () => container.querySelectorAll<HTMLButtonElement>(".marketplace-gallery-card")[0].click());
    await act(async () => button("Close").click());
    await act(async () => container.querySelectorAll<HTMLButtonElement>(".marketplace-gallery-card")[1].click());
    await act(async () => finishHistory([{ id: 1, job_id: listing.job_id, listing_id: 4, from_wallet: "", to_wallet: listing.owner_wallet, event_type: "mint", price_credits: 0, created_at: 1789660000 }]));
    expect(container.querySelector("#market-detail-title")?.textContent).toBe("Amber hour");
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain("Provenance");
  });
});
