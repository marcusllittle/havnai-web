import { hexlify, toUtf8Bytes, verifyMessage } from "ethers";
import type { InjectedProvider } from "./wallet";
import type { MusicAccountRequest } from "./accountMusicClient";

type Challenge = { challenge_id: string; message: string; expires_at: number };
type Link = { id: string; wallet: string };
const pendingSignatures = new WeakMap<InjectedProvider, Promise<unknown>>();

function abortable<T>(promise: Promise<T>, signal: AbortSignal, timeout = 90_000): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const fail = (reason: unknown) => { cleanup(); reject(reason); };
    const abort = () => fail(new Error("Wallet authorization cancelled. Start again when you are ready."));
    const timer = setTimeout(() => fail(new Error("Wallet request timed out. Complete or cancel any open request before trying again.")), timeout);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, fail);
  });
}

/** Sign the exact stored EIP-191 proof; never transfer funds or infer ownership. */
export async function authorizeAccountWallet({ provider, wallet, accountId, request, signal, link, onStage }: {
  provider: InjectedProvider; wallet: string; accountId: string; request: MusicAccountRequest; signal: AbortSignal;
  link?: Link; onStage?: (stage: string) => void;
}): Promise<{ link_id: string; status: "linked" | "unlinked" }> {
  if (pendingSignatures.has(provider)) throw new Error("A wallet signature is still pending. Complete or cancel it in your wallet first.");
  const selected = wallet.toLowerCase();
  if (link && link.wallet.toLowerCase() !== selected) throw new Error("Select the linked address in your wallet before unlinking it.");
  const operation = new AbortController();
  const cancel = () => operation.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  for (const event of ["accountsChanged", "chainChanged", "disconnect"]) provider.on?.(event, cancel);
  const rpc = <T,>(method: string) => abortable(provider.request({ method }) as Promise<T>, operation.signal, 15_000);
  try {
    const accounts = await rpc<string[]>("eth_accounts");
    if (!Array.isArray(accounts) || accounts[0]?.toLowerCase() !== selected) throw new Error("The selected wallet changed. Start again with the intended address.");
    const chain = Number(await rpc<string>("eth_chainId"));
    if (![1, 11155111].includes(chain)) throw new Error("Select Ethereum or Sepolia in your wallet, then try again.");
    const purpose = link ? "wallet_unlink" : "wallet_link";
    onStage?.("Verifying your account…");
    const proof = await request<Challenge>("/v2/account/wallet-challenges", { method: "POST", signal: operation.signal,
      body: JSON.stringify({ wallet: selected, chain_id: chain, purpose, ...(link ? { link_id: link.id } : {}) }) });
    operation.signal.throwIfAborted();
    if (!/^[a-f0-9]{64}$/.test(proof.challenge_id) || typeof proof.message !== "string"
        || typeof proof.expires_at !== "number" || !Number.isFinite(proof.expires_at) || proof.expires_at * 1000 <= Date.now()
        || !proof.message.split("\n").includes(`account_id: ${accountId}`)
        || !proof.message.split("\n").includes(`wallet: ${selected}`)
        || !proof.message.split("\n").includes(`chain_id: ${chain}`)
        || !proof.message.split("\n").includes(`purpose: ${purpose}`)
        || !proof.message.split("\n").includes(`nonce: ${proof.challenge_id}`)
        || !proof.message.split("\n").includes(`link_id: ${link?.id || ""}`)) {
      throw new Error("The wallet proof does not match this account or action. Please try again.");
    }
    if (pendingSignatures.has(provider)) throw new Error("A wallet signature is still pending. Complete or cancel it in your wallet first.");
    onStage?.(link ? "Confirm unlinking in your wallet…" : "Confirm linking in your wallet…");
    const signing = Promise.resolve().then(() => {
      operation.signal.throwIfAborted();
      return provider.request({ method: "personal_sign", params: [hexlify(toUtf8Bytes(proof.message)), selected] });
    });
    pendingSignatures.set(provider, signing);
    const clear = () => { if (pendingSignatures.get(provider) === signing) pendingSignatures.delete(provider); };
    void signing.then(clear, clear);
    const signature = await abortable(signing, operation.signal);
    operation.signal.throwIfAborted();
    if (typeof signature !== "string" || verifyMessage(proof.message, signature).toLowerCase() !== selected) {
      throw new Error("Your wallet signed with a different address. Nothing was linked or unlinked.");
    }
    if ((await rpc<string[]>("eth_accounts"))[0]?.toLowerCase() !== selected || Number(await rpc<string>("eth_chainId")) !== chain) {
      throw new Error("Your wallet or network changed. Start this action again.");
    }
    onStage?.("Saving wallet settings…");
    const result = await request<{ link_id: string; status: "linked" | "unlinked" }>(
      link ? `/v2/account/wallet-links/${encodeURIComponent(link.id)}` : "/v2/account/wallet-links", {
        method: link ? "DELETE" : "POST", signal: operation.signal,
        body: JSON.stringify({ challenge_id: proof.challenge_id, signature }),
      });
    operation.signal.throwIfAborted();
    return result;
  } catch (reason) {
    if (reason && typeof reason === "object" && "code" in reason && reason.code === 4001) {
      throw new Error("Wallet request declined. No wallet settings were changed.");
    }
    throw reason;
  } finally {
    signal.removeEventListener("abort", cancel);
    for (const event of ["accountsChanged", "chainChanged", "disconnect"]) provider.removeListener?.(event, cancel);
  }
}
