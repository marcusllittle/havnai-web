import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { SiteHeader } from "../components/SiteHeader";
import { useAccount } from "../components/AccountProvider";
import { AccountPurchases } from "../components/AccountPurchases";
import { AccountWallets } from "../components/AccountWallets";

interface CreditBalance {
  scale: number;
  available_units: number;
  reserved_units: number;
  debt_units: number;
}

export default function AccountPage() {
  const { configured, loading, signedIn, account, error, request, refresh } = useAccount();
  const [credits, setCredits] = useState<{ accountId: string; balance: CreditBalance } | null>(null);
  const [creditError, setCreditError] = useState("");
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    setCreditError("");
    request<CreditBalance>("/v2/account/credits", { signal: controller.signal })
      .then(balance => { if (!controller.signal.aborted) setCredits({ accountId: account.id, balance }); })
      .catch(reason => { if (!controller.signal.aborted) setCreditError(reason instanceof Error ? reason.message : "Could not load credits."); });
    return () => controller.abort();
  }, [account, request]);
  const balance = account && credits?.accountId === account.id ? credits.balance : null;

  return <><Head><title>Your account · HavnAI</title></Head><SiteHeader />
    <main className="account-auth-page">
      <h1>Your HavnAI account</h1>
      <p>Your creations and credits stay with your account. A wallet is optional.</p>
      {!configured ? <p role="status">Accounts are not available yet. Please try again later.</p>
        : loading ? <p role="status">Loading your account…</p>
        : !signedIn ? <div className="account-actions"><Link className="btn" href="/sign-in">Sign in</Link><Link href="/sign-up">Create account</Link></div>
        : error ? <div role="alert"><p>{error}</p><button onClick={() => void refresh().catch(() => undefined)}>Try again</button></div>
        : account && <>
          <section className="account-summary-card" aria-label="Your credits">
            <h2>Credits</h2>
            {balance ? <><p className="account-credit-total">{(balance.available_units / balance.scale).toLocaleString()} available</p>
              {balance.reserved_units > 0 && <p>{balance.reserved_units / balance.scale} reserved for work in progress</p>}
              {balance.debt_units > 0 && <p role="status">{balance.debt_units / balance.scale} credits need to be covered after a payment adjustment.</p>}</>
              : <p role={creditError ? "alert" : "status"}>{creditError || "Loading credits…"}</p>}
            <Link href="/pricing">Get credits</Link>
          </section>
          <AccountPurchases key={account.id} />
          <AccountWallets key={account.id} />
          <SignOutButton redirectUrl="/"><button type="button">Sign out</button></SignOutButton>
        </>}
    </main></>;
}
