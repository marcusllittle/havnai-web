import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletButton } from "../WalletButton";

const wallet = vi.hoisted(() => ({ address: null as string | null, shortAddress: "0x1111…1111", connecting: false, connect: vi.fn(), disconnect: vi.fn() }));
vi.mock("../../lib/WalletContext", () => ({ useWallet: () => wallet }));

describe("Shared wallet controls", () => {
  let container: HTMLDivElement, root: Root;
  const render = () => act(async () => root.render(<WalletButton />));
  const trigger = () => container.querySelector<HTMLButtonElement>(".wallet-connect-btn")!;
  const copy = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent === "Copy address")!;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    wallet.address = "0x1111111111111111111111111111111111111111";
    wallet.connect.mockResolvedValue(undefined);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("announces its menu, provides a wallet link, and restores focus with Escape", async () => {
    await render(); await act(async () => trigger().click());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('a[href="/wallet"]')).not.toBeNull();
    await act(async () => copy().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("reports clipboard failure and only confirms a completed copy", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await render(); await act(async () => trigger().click());
    await act(async () => copy().click());
    expect(container.textContent).toContain("Select the address above");
    expect(container.textContent).not.toContain("Copied!");
    await act(async () => copy().click());
    expect(container.textContent).toContain("Copied!");
    expect(writeText).toHaveBeenLastCalledWith(wallet.address);
  });

  it("discards clipboard feedback after an account switch", async () => {
    let finish!: () => void;
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) } });
    await render(); await act(async () => trigger().click()); await act(async () => copy().click());
    wallet.address = "0x2222222222222222222222222222222222222222";
    await render(); await act(async () => finish());
    await act(async () => trigger().click());
    expect(container.textContent).not.toContain("Copied!");
    expect(container.querySelector(".wallet-menu-address")?.textContent).toBe(wallet.address);
  });

  it("shows a rejected connection without an unhandled rejection", async () => {
    wallet.address = null;
    wallet.connect.mockRejectedValueOnce(new Error("Open a supported browser wallet."));
    await render(); await act(async () => trigger().click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Open a supported browser wallet.");
    await act(async () => trigger().click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
