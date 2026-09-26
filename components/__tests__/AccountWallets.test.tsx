import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountWallets } from "../AccountWallets";
import { authorizeAccountWallet } from "../../lib/accountWalletProof";
import { AccountRequestError } from "../AccountProvider";

const state = vi.hoisted(() => ({ account: { id: "alice", wallets: [] as Array<{ id: string; wallet: string }> },
  request: vi.fn(), refresh: vi.fn(), connect: vi.fn(), verified: vi.fn(), connectedWallet: "0xselected" as string | null }));
vi.mock("../AccountProvider", async original => ({ ...await original<typeof import("../AccountProvider")>(), useAccount: () => state }));
vi.mock("../WalletProvider", () => ({ useWallet: () => state }));
vi.mock("../../lib/wallet", () => ({ ensureInjectedProvider: vi.fn(async () => ({ provider: { request: vi.fn() } })) }));
vi.mock("../../lib/accountWalletProof", () => ({ authorizeAccountWallet: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ ClerkProvider: ({ children }: any) => children, useAuth: vi.fn(),
  useReverification: (fetcher: any) => async (...args: any[]) => {
    let result = await fetcher(...args);
    if (result?.clerk_error) { state.verified(result); result = await fetcher(...args); }
    return result;
  } }));
let root: Root, host: HTMLDivElement;
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === text)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.account = { id: "alice", wallets: [] }; state.connectedWallet = "0xselected";
  state.request.mockReset(); state.refresh.mockReset(); state.connect.mockReset(); state.verified.mockReset();
  vi.mocked(authorizeAccountWallet).mockReset().mockResolvedValue({ link_id: "link", status: "linked" });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("does not prompt on mount and coalesces repeated link clicks", async () => {
  await act(async () => root.render(<AccountWallets />));
  expect(authorizeAccountWallet).not.toHaveBeenCalled(); expect(state.connect).not.toHaveBeenCalled();
  await act(async () => { button("Link wallet").click(); button("Link wallet").click(); });
  expect(authorizeAccountWallet).toHaveBeenCalledTimes(1);
  expect(state.refresh).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Wallet linked. Your existing content and credits have not moved.");
});

it("requires explicit unlink confirmation while retaining ordinary account access", async () => {
  state.account.wallets = [{ id: "link-one", wallet: "0xlinked" }];
  await act(async () => root.render(<AccountWallets />));
  await act(async () => button("Unlink wallet").click());
  expect(authorizeAccountWallet).not.toHaveBeenCalled();
  expect(host.textContent).toContain("content, credits, and receipts stay with you");
  await act(async () => button("Keep linked").click());
  expect(host.querySelector('[aria-label="Confirm unlink wallet"]')).toBeNull();
  await act(async () => button("Unlink wallet").click());
  await act(async () => button("Confirm unlink").click());
  expect(authorizeAccountWallet).toHaveBeenCalledWith(expect.objectContaining({ link: { id: "link-one", wallet: "0xlinked" } }));
  expect(host.textContent).toContain("Wallet unlinked. Your account, creations, and credits are unchanged.");
});

it("opens account reverification only for the explicit core freshness error", async () => {
  state.request.mockRejectedValueOnce(new AccountRequestError("Verify again", "reauthentication_required")).mockResolvedValue({ challenge_id: "proof" });
  vi.mocked(authorizeAccountWallet).mockImplementation(async ({ request }) => {
    await request("/v2/account/wallet-challenges", { method: "POST" });
    return { link_id: "link", status: "linked" };
  });
  await act(async () => root.render(<AccountWallets />));
  await act(async () => button("Link wallet").click());
  expect(state.verified).toHaveBeenCalledWith(expect.objectContaining({ clerk_error: expect.objectContaining({ metadata: { reverification: { level: "first_factor", afterMinutes: 5 } } }) }));
  expect(state.request).toHaveBeenCalledTimes(2);
});

it("aborts pending authorization on unmount and does not refresh a different account", async () => {
  let finish!: (value: any) => void;
  vi.mocked(authorizeAccountWallet).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<AccountWallets />));
  await act(async () => button("Link wallet").click());
  const signal = vi.mocked(authorizeAccountWallet).mock.calls[0][0].signal;
  await act(async () => root.render(<div>Different account</div>));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ link_id: "link", status: "linked" }));
  expect(host.textContent).toBe("Different account");
  expect(state.refresh).not.toHaveBeenCalled();
});
