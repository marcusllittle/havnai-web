import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SiteHeader } from "../SiteHeader";
import { WalletProvider } from "../WalletProvider";
import { setActiveWalletProvider } from "../../lib/wallet";

const route = vi.hoisted(() => ({ pathname: "/", asPath: "/" }));
const account = vi.hoisted(() => ({ configured: true, signedIn: false, loading: false }));
vi.mock("next/router", () => ({ useRouter: () => route }));
vi.mock("../AccountProvider", () => ({ useAccount: () => account }));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ signOut: vi.fn() }) }));

const address = "0x1111111111111111111111111111111111111111";
let host: HTMLDivElement, root: Root;
let granted: boolean;
let request: ReturnType<typeof vi.fn>;
const connectButton = () => host.querySelector<HTMLButtonElement>(".wallet-connect-btn")!;
const render = () => act(async () => root.render(<WalletProvider><SiteHeader /></WalletProvider>));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  account.configured = true; account.signedIn = false; account.loading = false;
  route.pathname = "/"; route.asPath = "/"; granted = false;
  setActiveWalletProvider(null);
  request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_accounts") return granted ? [address] : [];
    if (method === "eth_requestAccounts") { granted = true; return [address]; }
    if (method === "eth_chainId") return "0xaa36a7";
    throw new Error(`Unexpected wallet request: ${method}`);
  });
  window.ethereum = { isMetaMask: true, request };
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); delete window.ethereum;
  setActiveWalletProvider(null); vi.unstubAllGlobals();
});

it.each([320, 390, 768, 1366])("keeps voluntary connect beside sign-in across guest navigation at %ipx", async width => {
  vi.stubGlobal("innerWidth", width);
  for (const path of ["/", "/discover", "/music", "/marketplace", "/sign-in"]) {
    route.pathname = path; route.asPath = path;
    await render();
    const actions = host.querySelector(".nav-wallet")!;
    expect(actions.querySelector('a[href="/sign-in"]')).not.toBeNull();
    expect(actions.querySelector(".wallet-connect-btn")).toBe(connectButton());
    expect(connectButton().textContent).toBe("Connect Wallet");
    expect(connectButton().closest("details")).toBeNull();
    expect(connectButton().disabled).toBe(false);
  }
  expect(request.mock.calls.every(([args]) => ["eth_accounts", "eth_chainId"].includes(args.method))).toBe(true);
  await act(async () => connectButton().click());
  expect(request.mock.calls.filter(([args]) => args.method === "eth_requestAccounts")).toHaveLength(1);
  expect(request.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
  expect(connectButton().getAttribute("aria-label")).toContain("0x1111...1111");
});

it("shows the same wallet control for signed-in and unconfigured accounts", async () => {
  account.signedIn = true;
  await render();
  expect(host.textContent).toContain("Sign out");
  expect(connectButton().textContent).toBe("Connect Wallet");
  account.configured = false;
  await render();
  expect(host.querySelectorAll(".wallet-connect-btn")).toHaveLength(1);
  expect(host.querySelector(".account-session-button")).toBeNull();
  expect(request.mock.calls.some(([args]) => args.method === "eth_requestAccounts")).toBe(false);
});

it("recovers from an explicit permission cancellation without signing or prompting again", async () => {
  await render();
  request.mockRejectedValueOnce(Object.assign(new Error("User rejected connection"), { code: 4001 }));
  await act(async () => connectButton().click());
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(connectButton().disabled).toBe(false);
  route.pathname = "/discover"; route.asPath = "/discover";
  await render();
  expect(request.mock.calls.filter(([args]) => args.method === "eth_requestAccounts")).toHaveLength(1);
  await act(async () => connectButton().click());
  await act(async () => connectButton().click());
  expect(host.querySelector('[aria-label="Wallet options"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>(".wallet-dropdown-disconnect")!.click());
  expect(connectButton().textContent).toBe("Connect Wallet");
  expect(request.mock.calls.filter(([args]) => args.method === "eth_requestAccounts")).toHaveLength(2);
  expect(request.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
});

it("passively restores the existing provider connection after remount", async () => {
  await render();
  await act(async () => connectButton().click());
  await act(async () => root.render(<></>));
  await render();
  expect(connectButton().getAttribute("aria-label")).toContain("0x1111...1111");
  expect(request.mock.calls.filter(([args]) => args.method === "eth_requestAccounts")).toHaveLength(1);
});
