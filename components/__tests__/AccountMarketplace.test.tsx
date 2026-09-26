import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountMarketplace } from "../AccountMarketplace";
const auth = vi.hoisted(() => ({ account: { id: "alice" } as { id: string } | null, signedIn: true, loading: false,
  configured: true, error: "", request: vi.fn() }));
vi.mock("../AccountProvider", async original => ({ ...await original<typeof import("../AccountProvider")>(), useAccount: () => auth }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
const item = { id: 4, title: "Quiet coast", description: "Morning light", price_units: 1250, scale: 1000,
  status: "active", preview_url: "/v2/marketplace/listings/4/preview", created_at: 1000 };
const result = { listing_id: 4, job_id: "job-image", price_units: 1250, sale_id: "sale-one" };
const fetcher = vi.fn(); let host: HTMLDivElement; let root: Root;
const button = (text: string) => [...host.querySelectorAll("button")].find(el => el.textContent?.trim() === text)!;
const render = () => act(async () => { root.render(<AccountMarketplace />); });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetcher);
  sessionStorage.clear(); auth.account = { id: "alice" }; auth.signedIn = true;
  auth.request.mockReset().mockResolvedValue(result);
  fetcher.mockReset().mockImplementation(async () => new Response(JSON.stringify({ listings: [item], total: 1, limit: 24, offset: 0 })));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it("lets guests browse and directs purchases to sign-in without wallet calls", async () => {
  auth.account = null; auth.signedIn = false;
  await render();
  expect(host.querySelector('img[src="/api/v2/marketplace/listings/4/preview"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
  expect(host.textContent).toContain("Sign in to buy");
  expect(host.textContent).not.toContain("Connect wallet");
  expect(auth.request).not.toHaveBeenCalled();
  await act(async () => button("Receipts").click());
  expect(host.textContent).toContain("Sign in to see your listings");
  expect(auth.request).not.toHaveBeenCalled();
});

it("coalesces a purchase and explicitly retries the same lost response", async () => {
  auth.request.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue(result);
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
  await act(async () => { button("Buy for 1.25 credits").click(); button("Buy for 1.25 credits").click(); });
  expect(auth.request).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Connection lost");
  expect(button("Retry purchase for 1.25 credits")).toBeDefined();
  await act(async () => button("Retry purchase for 1.25 credits").click());
  expect(auth.request.mock.calls[1]).toEqual(auth.request.mock.calls[0]);
  expect(host.textContent).toContain("Request completed");
  expect(button("Retry purchase for 1.25 credits")).toBeUndefined();
});

it("clears insufficient-credit purchases and sends the buyer to pricing", async () => {
  const error = Object.assign(new Error("Not enough credits for this purchase. Add credits and try again."), { code: "insufficient_credits" });
  auth.request.mockRejectedValueOnce(error);
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
  await act(async () => button("Buy for 1.25 credits").click());
  expect(auth.request).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Not enough credits");
  expect(host.querySelector<HTMLAnchorElement>('a[href="/pricing"]')?.textContent).toBe("Get credits");
  expect(button("Retry purchase for 1.25 credits")).toBeUndefined();
  expect(sessionStorage.getItem("havnai.account-marketplace-request.v1:alice")).toBeNull();
});

it("never automatically submits a saved purchase or carries it to another account", async () => {
  sessionStorage.setItem("havnai.account-marketplace-request.v1:alice", JSON.stringify({ kind: "purchase", key: "persisted-purchase-key", listingId: 4, units: 1250 }));
  await render();
  expect(button("Retry purchase for 1.25 credits")).toBeDefined();
  expect(auth.request).not.toHaveBeenCalled();
  auth.account = { id: "bob" };
  await render();
  expect(button("Retry purchase for 1.25 credits")).toBeUndefined();
  expect(auth.request).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("havnai.account-marketplace-request.v1:alice")).not.toBeNull();
});

it("loads owner-only media, delists without JSON, and shows account receipts", async () => {
  auth.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return undefined;
    if (path.includes("receipts")) return { total: 1, receipts: [{ id: "sale-one", title: "Quiet coast", price_units: 1250, scale: 1000, direction: "sale", created_at: 1000 }] };
    return { listings: [{ ...item, owner_account_id: "alice", artifact_id: "art-one", job_id: "job-image" }], total: 1 };
  });
  await render();
  await act(async () => button("Your listings & purchases").click());
  expect(host.querySelector('img[src="/api/account-media/art-one"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
  await act(async () => button("Remove listing").click());
  expect(host.textContent).toContain("Listing removed");
  expect(auth.request).toHaveBeenCalledWith("/v2/marketplace/listings/4", expect.objectContaining({ method: "DELETE" }));
  await act(async () => button("Receipts").click());
  expect(host.textContent).toContain("Received 1.25 credits");
  expect(host.textContent).toContain("sale-one");
});

it("keeps malformed request recovery visible and blocks another purchase", async () => {
  sessionStorage.setItem("havnai.account-marketplace-request.v1:alice", "corrupt");
  await render();
  expect(host.textContent).toContain("needs review");
  await act(async () => host.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
  expect(button("Buy for 1.25 credits").disabled).toBe(true);
});

it("opens a relisting form for owned creations and confirms publishing", async () => {
  auth.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith("/v2/jobs/")) return { id: "job-image", owner_account_id: "alice", type: "image", status: "succeeded", artifacts: [{ id: "art-one", kind: "image" }] };
    if (init?.method === "POST") return { listing_id: 8, job_id: "job-image", price_units: 1250 };
    return { listings: [{ ...item, status: "sold", owner_account_id: "alice", artifact_id: "art-one", job_id: "job-image" }], total: 1 };
  });
  await render(); await act(async () => button("Your listings & purchases").click());
  await act(async () => host.querySelector<HTMLButtonElement>(".marketplace-gallery-card")!.click());
  await act(async () => button("Relist creation").click());
  expect(host.querySelector<HTMLInputElement>('.account-listing-form input')?.value).toBe("Quiet coast");
  await act(async () => host.querySelector('.account-listing-form form')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(host.textContent).toContain("Your listing is published.");
  expect(host.querySelector(".account-listing-form")).toBeNull();
});
