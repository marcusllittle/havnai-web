import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "../WalletProvider";
const mocks = vi.hoisted(() => ({ read: vi.fn(), request: vi.fn(), detect: vi.fn(), pin: vi.fn(), listeners: new Map<string, () => void>() }));
const address = "0x1111111111111111111111111111111111111111";
vi.mock("../../lib/wallet", () => {
  class WalletError extends Error { constructor(public code: string, message: string) { super(message); } }
  return {
    WalletError, getConfiguredWallet: () => null,
    ensureInjectedProvider: mocks.detect, setActiveWalletProvider: mocks.pin,
    readConnectedAccounts: mocks.read, requestAccounts: mocks.request,
    readChainInfo: async () => ({ chainId: "0x1", chainAllowed: true }),
    normalizeWalletError: (e: Error) => new WalletError("wallet_unknown", e.message),
  };
});
let wallet: ReturnType<typeof useWallet>;
function Probe() { wallet = useWallet(); return <span>{wallet.connectedWallet || "disconnected"}</span>; }
describe("wallet connection lifecycle", () => {
  let root: Root, host: HTMLDivElement;
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mocks.read.mockResolvedValue([address]);
    mocks.request.mockResolvedValue([address]);
    const provider = { isMetaMask: true, request: vi.fn(), on: (event: string, fn: () => void) => mocks.listeners.set(event, fn), removeListener: (event: string) => mocks.listeners.delete(event) };
    mocks.detect.mockResolvedValue({ provider, providerName: "MetaMask", hasProvider: true, hasConflict: false, error: null });
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<WalletProvider><Probe /></WalletProvider>));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.resetAllMocks(); mocks.listeners.clear(); vi.unstubAllGlobals(); });
  it("restores granted accounts silently and reuses the existing connection", async () => {
    expect(wallet.connectedWallet).toBe(address);
    await act(async () => { expect(await wallet.connect()).toBe(address); await wallet.refresh(); });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.detect).toHaveBeenCalledTimes(1);
  });
  it("keeps the connected account during a transient background error", async () => {
    mocks.read.mockRejectedValueOnce(new Error("temporary transport error"));
    await act(async () => wallet.refresh());
    expect(wallet.connectedWallet).toBe(address);
    expect(wallet.status).toBe("connected");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("does not reconnect after an explicit disconnect or a stale read", async () => {
    let finish!: (accounts: string[]) => void;
    mocks.read.mockReturnValueOnce(new Promise<string[]>(resolve => { finish = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = wallet.refresh(); });
    act(() => wallet.disconnect());
    await act(async () => { finish([address]); await refresh; await wallet.refresh(); });
    expect(wallet.connectedWallet).toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("honors an account permission revocation", async () => {
    mocks.read.mockResolvedValue([]);
    await act(async () => mocks.listeners.get("accountsChanged")?.());
    expect(wallet.connectedWallet).toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("does not briefly disconnect on transport events", async () => {
    mocks.read.mockRejectedValueOnce(new Error("transport offline"));
    await act(async () => mocks.listeners.get("disconnect")?.());
    expect(wallet.connectedWallet).toBe(address);
  });
});
