// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { Wallet, toUtf8String } from "ethers";
import { authorizeAccountWallet } from "../accountWalletProof";
import type { InjectedProvider } from "../wallet";

const signer = Wallet.createRandom();
const address = signer.address.toLowerCase();
const challengeId = "a".repeat(64);
let request: ReturnType<typeof vi.fn>, rpc: ReturnType<typeof vi.fn>, controller: AbortController;
let provider: InjectedProvider, events: Map<string, () => void>;
const proof = (purpose = "wallet_link", linkId = "") => ({ challenge_id: challengeId, expires_at: Date.now() / 1000 + 300,
  message: `HavnAI optional wallet authorization\naccount_id: alice\nwallet: ${address}\nchain_id: 11155111\npurpose: ${purpose}\nnonce: ${challengeId}\nlink_id: ${linkId}\nThis action does not move content, credits, tokens, or rewards.` });
const run = (link?: { id: string; wallet: string }) => authorizeAccountWallet({ provider, wallet: address, accountId: "alice", request, signal: controller.signal, link });
beforeEach(() => {
  events = new Map(); controller = new AbortController();
  rpc = vi.fn(async ({ method, params }) => {
    if (method === "eth_accounts") return [address];
    if (method === "eth_chainId") return "0xaa36a7";
    if (method === "personal_sign") return signer.signMessage(toUtf8String(params[0]));
    throw new Error(`Forbidden wallet request: ${method}`);
  });
  provider = { request: rpc, on: (event: string, fn: () => void) => events.set(event, fn), removeListener: (event: string) => events.delete(event) } as InjectedProvider;
  request = vi.fn(async (path, init) => path.endsWith("wallet-challenges") ? proof() : { link_id: "link-one", status: "linked" });
});

it("signs exactly the server message and submits only proof identity and signature", async () => {
  const supplied = proof(); request.mockResolvedValueOnce(supplied);
  await expect(run()).resolves.toEqual({ link_id: "link-one", status: "linked" });
  const signed = rpc.mock.calls.find(([args]) => args.method === "personal_sign")![0];
  expect(toUtf8String(signed.params[0])).toBe(supplied.message);
  expect(signed.params[1]).toBe(address);
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ wallet: address, chain_id: 11155111, purpose: "wallet_link" });
  expect(Object.keys(JSON.parse(request.mock.calls[1][1].body)).sort()).toEqual(["challenge_id", "signature"]);
  expect(events.size).toBe(0);
});

it("uses a separate unlink proof and never sends a transfer or generation request", async () => {
  request.mockResolvedValueOnce(proof("wallet_unlink", "link-one"));
  await run({ id: "link-one", wallet: address });
  expect(request.mock.calls[1][0]).toBe("/v2/account/wallet-links/link-one");
  expect(request.mock.calls[1][1].method).toBe("DELETE");
  expect(rpc.mock.calls.every(([args]) => ["eth_accounts", "eth_chainId", "personal_sign"].includes(args.method))).toBe(true);
});

it("rejects wrong-account challenges before opening a signature prompt", async () => {
  request.mockResolvedValueOnce({ ...proof(), message: proof().message.replace("account_id: alice", "account_id: bob") });
  await expect(run()).rejects.toThrow("does not match");
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
});

it("cancels on a wallet switch and blocks another signature until the original settles", async () => {
  let resolveSignature!: (value: string) => void;
  rpc.mockImplementation(async ({ method }) => {
    if (method === "eth_accounts") return [address];
    if (method === "eth_chainId") return "0xaa36a7";
    return new Promise(resolve => { resolveSignature = resolve; });
  });
  const pending = run();
  const rejected = expect(pending).rejects.toThrow("cancelled");
  await vi.waitFor(() => expect(resolveSignature).toBeTypeOf("function"));
  events.get("accountsChanged")!();
  await rejected;
  await expect(run()).rejects.toThrow("still pending");
  resolveSignature(await signer.signMessage(proof().message));
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not commit a proof after account-view cancellation", async () => {
  request.mockImplementation(async () => { controller.abort(); return proof(); });
  await expect(run()).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
});

it("rejects unlinking a different selected wallet without creating a challenge", async () => {
  await expect(run({ id: "link-one", wallet: Wallet.createRandom().address })).rejects.toThrow("Select the linked address");
  expect(request).not.toHaveBeenCalled();
});
