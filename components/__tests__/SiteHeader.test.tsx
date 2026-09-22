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

  it("groups destinations without removing any existing route", () => {
    const links = Array.from(container.querySelectorAll("nav a"));
    expect(links.map(link => link.textContent)).toEqual([
      "Image", "Video", "Music", "Discover", "Astra", "Marketplace", "Network overview",
      "Run a Node", "How it works", "Library", "Collection", "Wallet", "Credits",
    ]);
    expect(new Set(links.map(link => link.getAttribute("href"))).size).toBe(13);
    expect(container.querySelector("nav button")).toBeNull();
    expect(container.querySelector('a[href="/templates"]')).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(Array.from(container.querySelectorAll("summary")).map(item => item.textContent)).toEqual(["Create", "Network", "Your Havn"]);
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/create", "/video-studio", "/music", "/discover", "/astra", "/marketplace", "/nodes",
      "/run-a-node", "/how-it-works", "/music/library", "/library", "/wallet", "/pricing",
    ]);
  });

  it("closes an open group on Escape and returns focus to its summary", () => {
    const group = container.querySelector("details")!;
    group.open = true;
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(group.open).toBe(false);
    expect(document.activeElement).toBe(group.querySelector("summary"));
  });

  it("closes navigation on outside interaction and route changes", () => {
    const group = container.querySelector("details")!;
    group.open = true;
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(group.open).toBe(false);
    group.open = true;
    route.asPath = "/music/library?tab=saved";
    act(() => root.render(<SiteHeader />));
    expect(group.open).toBe(false);
    route.asPath = "/music/library";
  });
});
