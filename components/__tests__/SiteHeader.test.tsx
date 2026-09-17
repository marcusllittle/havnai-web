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
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it("identifies Music library separately and returns focus when Escape closes the menu", () => {
    const active = container.querySelectorAll('[aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toBe("Music library");
    const toggle = container.querySelector<HTMLButtonElement>(".nav-toggle")!;
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const link = container.querySelector<HTMLAnchorElement>('.nav-main-links a')!;
    act(() => { link.focus(); link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("keeps the navigation open for wallet controls and closes it on an outside press", () => {
    const toggle = container.querySelector<HTMLButtonElement>(".nav-toggle")!;
    act(() => toggle.click());
    act(() => container.querySelector<HTMLButtonElement>(".nav-wallet button")!.click());
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
});
