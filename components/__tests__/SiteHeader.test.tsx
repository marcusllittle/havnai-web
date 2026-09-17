import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../SiteHeader";

const route = vi.hoisted(() => ({ pathname: "/music/library", asPath: "/music/library" }));
vi.mock("next/router", () => ({ useRouter: () => route }));
vi.mock("../WalletButton", () => ({ WalletButton: () => <button type="button">Wallet menu</button> }));

describe("Site navigation disclosures", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<SiteHeader />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("identifies Library separately from Music and uses only the brand icon", () => {
    const active = container.querySelectorAll('[aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toBe("Library");
    expect(container.querySelector(".brand-wordmark")).toBeNull();
    expect(container.querySelector(".brand")?.getAttribute("aria-label")).toBe("HavnAI home");
  });

  it("keeps the navigation open for wallet controls and closes it on an outside press", () => {
    const toggle = container.querySelector<HTMLButtonElement>(".nav-more-toggle")!;
    act(() => toggle.click());
    act(() => container.querySelector<HTMLButtonElement>(".nav-mobile-wallet button")!.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes More with Escape and restores its trigger's focus", () => {
    const more = container.querySelector<HTMLButtonElement>(".nav-more-toggle")!;
    act(() => more.click());
    expect(more.getAttribute("aria-expanded")).toBe("true");
    const link = container.querySelector<HTMLAnchorElement>(".nav-more-links a")!;
    act(() => { link.focus(); link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(more);
  });

  it("makes wallet and the introductory guide reachable without promoting templates", () => {
    for (const href of ["/wallet", "/how-it-works"]) expect(container.querySelector(`.nav-more-links a[href="${href}"]`)).not.toBeNull();
    expect(container.querySelector('a[href="/templates"]')).toBeNull();
  });

  it("moves whole links into More when space shrinks and preserves keyboard focus", () => {
    let availableWidth = 1500;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("nav-links") ? availableWidth : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { width: this.classList.contains("nav-measure-more") ? 80 : 100 } as DOMRect;
    });
    act(() => window.dispatchEvent(new Event("resize")));
    expect(container.querySelectorAll(".nav-main-links a")).toHaveLength(11);
    const network = container.querySelector<HTMLAnchorElement>('.nav-main-links a[href="/nodes"]')!;
    network.focus();
    availableWidth = 420;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(container.querySelectorAll(".nav-main-links a")).toHaveLength(2);
    expect(container.querySelector('.nav-main-links a[href="/nodes"]')).toBeNull();
    expect(container.querySelector('.nav-more-links a[href="/nodes"]')).not.toBeNull();
    expect(document.activeElement).toBe(container.querySelector(".nav-more-toggle"));
    const links = Array.from(container.querySelectorAll("nav a")).map(link => link.getAttribute("href"));
    expect(new Set(links).size).toBe(13);
    expect(links).toHaveLength(13);
    availableWidth = 1500;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(container.querySelectorAll(".nav-main-links a")).toHaveLength(11);
  });
});
