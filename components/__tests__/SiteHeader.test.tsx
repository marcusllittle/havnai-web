import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../SiteHeader";

const route = vi.hoisted(() => ({ pathname: "/music/library", asPath: "/music/library" }));
vi.mock("next/router", () => ({ useRouter: () => route }));
vi.mock("../WalletButton", () => ({ WalletButton: () => <button type="button">Wallet menu</button> }));

describe("Site navigation", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<SiteHeader />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it("identifies Library separately from Music and uses only the brand icon", () => {
    const active = container.querySelectorAll('[aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toBe("Library");
    expect(container.querySelector(".brand-wordmark")).toBeNull();
    expect(container.querySelector(".brand")?.getAttribute("aria-label")).toBe("HavnAI home");
  });

  it("makes every destination available without a disclosure", () => {
    const links = Array.from(container.querySelectorAll("nav a"));
    expect(links.map(link => link.textContent)).toEqual([
      "Astra", "Create", "Music", "Discover", "Library", "Video", "Collection",
      "Marketplace", "Network", "Credits", "Run a Node", "Wallet", "How it works",
    ]);
    expect(new Set(links.map(link => link.getAttribute("href"))).size).toBe(13);
    expect(container.querySelector("nav button")).toBeNull();
    expect(container.querySelector('a[href="/templates"]')).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });
});
