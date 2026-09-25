import { useEffect, useRef, useState } from "react";
import { useReverification } from "@clerk/nextjs";
import { AccountRequestError, useAccount } from "./AccountProvider";
import { useWallet } from "./WalletProvider";
import { ensureInjectedProvider } from "../lib/wallet";
import { authorizeAccountWallet } from "../lib/accountWalletProof";
import { AccountImportReview } from "./AccountImportReview";

const verificationHint = { clerk_error: { type: "forbidden", reason: "reverification-error",
  metadata: { reverification: { level: "first_factor", afterMinutes: 5 } } } } as const;

export function AccountWallets() {
  const account = useAccount();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [unlink, setUnlink] = useState<{ id: string; wallet: string } | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.abort(); };
  }, []);
  const verifiedRequest = useReverification(async (path: string, init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    try { return { data: await account.request<unknown>(path, init) }; }
    catch (reason) {
      if (reason instanceof AccountRequestError && reason.code === "reauthentication_required") return verificationHint;
      throw reason;
    }
  });
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const result = await verifiedRequest(path, init);
    init?.signal?.throwIfAborted();
    if (!result || !("data" in result)) throw new Error("Account verification is still required. Please try again.");
    return result.data as T;
  }
  async function authorize(link?: { id: string; wallet: string }) {
    if (active.current || !account.account) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(""); setMessage("Opening your wallet…");
    try {
      const selected = wallet.connectedWallet || await wallet.connect();
      controller.signal.throwIfAborted();
      if (!selected) throw new Error("Choose a wallet address to continue.");
      const selection = await ensureInjectedProvider();
      controller.signal.throwIfAborted();
      if (!selection.provider) throw new Error("No wallet is available. Enable your wallet extension and try again.");
      await authorizeAccountWallet({ provider: selection.provider, wallet: selected, accountId: account.account.id,
        request, signal: controller.signal, link, onStage: stage => { if (!controller.signal.aborted) setMessage(stage); } });
      controller.signal.throwIfAborted();
      await account.refresh();
      if (!controller.signal.aborted) { setUnlink(null); setMessage(link ? "Wallet unlinked. Your account, creations, and credits are unchanged." : "Wallet linked. Your existing content and credits have not moved."); }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setMessage("");
        setError(reason instanceof Error ? reason.message : "Wallet authorization failed. Please try again.");
        // A response can be lost after core commits. Refresh durable link state instead of auto-signing again.
        await account.refresh().catch(() => undefined);
      }
    } finally {
      if (active.current === controller) active.current = null;
      if (alive.current) setBusy(false);
    }
  }
  if (!account.account) return null;
  return <section className="account-summary-card" aria-label="Linked wallets">
    <h2>Linked wallets</h2>
    <p>Wallets unlock blockchain rewards, token transfers, and ownership features. You do not need one to create or publish.</p>
    {account.account.wallets.length ? <ul>{account.account.wallets.map(link => <li key={link.id}>
      <code style={{ overflowWrap: "anywhere" }}>{link.wallet}</code>{" "}<button type="button" aria-label={`Unlink wallet ${link.wallet}`} disabled={busy} onClick={() => { setUnlink(link); setError(""); setMessage(""); }}>Unlink wallet</button>
      {" "}<button type="button" disabled={busy} onClick={() => setReviewLink(link.id)}>Review wallet content</button>
    </li>)}</ul> : <p>No wallets linked.</p>}
    <p>Linking a wallet never moves your existing content or credits automatically.</p>
    {unlink ? <div role="group" aria-label="Confirm unlink wallet">
      <p>Unlink <code style={{ overflowWrap: "anywhere" }}>{unlink.wallet}</code>? Your account, content, credits, and receipts stay with you. Confirm using this wallet and your account verification.</p>
      <button type="button" disabled={busy} onClick={() => void authorize(unlink)}>Confirm unlink</button>{" "}
      <button type="button" disabled={busy} onClick={() => setUnlink(null)}>Keep linked</button>
    </div> : <button type="button" disabled={busy} onClick={() => void authorize()}>Link wallet</button>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {error && <button type="button" disabled={busy} onClick={() => void account.refresh().then(() => {
      if (alive.current) { setError(""); setMessage("Linked wallets refreshed."); }
    }).catch(() => { if (alive.current) setError("Could not refresh linked wallets. Please try again."); })}>Refresh linked wallets</button>}
    {busy && <button type="button" onClick={() => { active.current?.abort(); setMessage("Cancelled here. Close any pending wallet or account verification prompt before trying again."); }}>Cancel request</button>}
    {account.account.wallets.filter(link => link.id === reviewLink).map(link =>
      <AccountImportReview key={`${account.account!.id}:${link.id}`} link={link} request={request} onClose={() => setReviewLink(null)} />)}
  </section>;
}
