import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WalletProvider } from "../WalletProvider";
import { WalletButton } from "../WalletButton";
import { setActiveWalletProvider } from "../../lib/wallet";

const address = "0x1111111111111111111111111111111111111111";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  setActiveWalletProvider(null);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); setActiveWalletProvider(null);
  delete window.ethereum; vi.useRealTimers(); vi.unstubAllGlobals();
});

it("Connect Wallet sends the permission RPC even while the passive account check is stuck", async () => {
  vi.useFakeTimers();
  const request = vi.fn(({ method }: { method: string }) => {
    if (method === "eth_accounts") return new Promise(() => {});
    if (method === "eth_requestAccounts") return Promise.resolve([address]);
    return Promise.resolve("0xaa36a7");
  });
  window.ethereum = { isMetaMask: true, request };
  await act(async () => root.render(<WalletProvider><WalletButton /></WalletProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>(".wallet-connect-btn")!.click());
  expect(request.mock.calls.filter(([args]) => args.method === "eth_requestAccounts")).toHaveLength(1);
  expect(host.textContent).toContain("0x1111...1111");
  await act(async () => vi.advanceTimersByTimeAsync(11000));
  expect(host.textContent).toContain("0x1111...1111");
});

it("uses MetaMask's announced provider when another extension owns window.ethereum", async () => {
  const wrongRequest = vi.fn().mockResolvedValue([]);
  window.ethereum = { isMetaMask: true, request: wrongRequest };
  const request = vi.fn(({ method }: { method: string }) => Promise.resolve(
    method === "eth_accounts" ? [] : method === "eth_requestAccounts" ? [address] : "0xaa36a7"
  ));
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
    detail: { info: { uuid: "test-metamask", name: "MetaMask", rdns: "io.metamask" }, provider: { isMetaMask: true, request } },
  }));
  // MetaMask appears after the application has already performed its passive check.
  await act(async () => root.render(<WalletProvider><WalletButton /></WalletProvider>));
  window.addEventListener("eip6963:requestProvider", announce);
  try {
    await act(async () => host.querySelector<HTMLButtonElement>(".wallet-connect-btn")!.click());
    expect(request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(wrongRequest.mock.calls.some(([args]) => args.method === "eth_requestAccounts")).toBe(false);
    expect(host.textContent).toContain("0x1111...1111");
  } finally { window.removeEventListener("eip6963:requestProvider", announce); }
});
