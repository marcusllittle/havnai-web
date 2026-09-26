import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ signedIn: true, loading: false, error: "", account: { id: "acct_alice" } as { id: string } | null,
  request: vi.fn(), push: vi.fn(), wallet: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("next/router", () => ({ useRouter: () => ({ push: state.push }) }));
import { AccountPricing } from "../AccountPricing";

const catalog = { packages: [{ id: "starter", name: "Starter", units: 50_000, price_cents: 500 }], currency: "usd", scale: 1000,
  checkout_available: true, terms_version: "terms-v1", catalog_version: "quote-v1",
  terms_url: "https://joinhavn.io/terms/credits-v1", refund_url: "https://joinhavn.io/refunds/credits-v1" };

describe("Account pricing", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog))));
    vi.stubGlobal("ethereum", { request: state.wallet });
    state.signedIn = true; state.loading = false; state.error = ""; state.account = { id: "acct_alice" };
    state.request.mockReset(); state.wallet.mockReset(); state.push.mockReset(); sessionStorage.clear();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  const render = async () => act(async () => { root.render(<AccountPricing />); });
  const buyButton = () => [...container.querySelectorAll("button")].find(item => item.textContent?.includes("Buy 50"))!;

  it("shows server prices and requires terms before checkout without wallet calls", async () => {
    await render();
    expect(container.textContent).toContain("$5.00");
    expect(buyButton().disabled).toBe(true);
    expect(container.querySelector('a[href="https://joinhavn.io/terms/credits-v1"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://joinhavn.io/refunds/credits-v1"]')).not.toBeNull();
    state.request.mockResolvedValueOnce({ purchase_id: "pur_1", state: "paid", checkout_url: null });
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => buyButton().click());
    expect(state.request.mock.calls[0][0]).toBe("/v2/account/checkout");
    expect(state.push).toHaveBeenCalledWith("/account?purchase=pur_1");
    expect(state.wallet).not.toHaveBeenCalled();
  });

  it("lets guests browse prices and directs them to sign in", async () => {
    state.signedIn = false; state.account = null;
    await render();
    expect(container.querySelector('a[href="/sign-in"]')).not.toBeNull();
    expect(buyButton().disabled).toBe(true);
    expect(state.request).not.toHaveBeenCalled();
    expect(state.wallet).not.toHaveBeenCalled();
  });

  it("coalesces repeated clicks while checkout is pending", async () => {
    let finish!: (value: unknown) => void;
    state.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render();
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    const button = buyButton();
    await act(async () => { button.click(); button.click(); });
    expect(state.request).toHaveBeenCalledTimes(1);
    await act(async () => finish({ purchase_id: "pur_1", state: "paid", checkout_url: null }));
  });

  it("does not offer checkout if policies or provider configuration are missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...catalog, checkout_available: false, terms_url: null, refund_url: null })));
    await render();
    expect(container.textContent).toContain("Card checkout is not available yet");
    expect(buyButton().disabled).toBe(true);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector('footer a[href="/terms/credits-v1"]')).not.toBeNull();
    expect(container.querySelector('footer a[href="/refunds/credits-v1"]')).not.toBeNull();
    expect(container.querySelector('footer a[href="/support"]')).not.toBeNull();
  });

  it.each([null, "javascript:alert(1)", "https://user:password@joinhavn.io/terms"])("does not use public footer policies to repair an invalid checkout quote (%s)", async termsUrl => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...catalog, terms_url: termsUrl })));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Pricing is temporarily unavailable");
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(buyButton()).toBeUndefined();
    expect(container.querySelector('footer a[href="/terms/credits-v1"]')).not.toBeNull();
    expect(state.request).not.toHaveBeenCalled();
  });
});
