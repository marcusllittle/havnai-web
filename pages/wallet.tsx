import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import {
  fetchCredits,
  fetchWalletRewards,
  claimRewards,
  CreditBalance,
  WalletRewards,
  WALLET,
} from "../lib/havnai";

const WalletPage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [rewards, setRewards] = useState<WalletRewards | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchCredits().catch(() => null),
      fetchWalletRewards().catch(() => null),
    ]).then(([cr, rw]) => {
      if (!active) return;
      setCredits(cr);
      setRewards(rw);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await claimRewards();
      setClaimResult(`Claimed ${res.claimed.toFixed(4)} HAI${res.tx_hash ? ` (tx: ${res.tx_hash})` : ""}`);
      // Refresh rewards
      const rw = await fetchWalletRewards().catch(() => null);
      if (rw) setRewards(rw);
    } catch (err: any) {
      setClaimResult(err?.message || "Claim failed.");
    }
    setClaiming(false);
  };

  const isZeroWallet = WALLET === "0x0000000000000000000000000000000000000000";

  return (
    <>
      <Head><title>HavnAI Wallet</title></Head>
      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Stage 6 + 7 Alpha</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button type="button" className={`nav-toggle ${navOpen ? "nav-open" : ""}`} aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
            <span /><span />
          </button>
          <nav className={`nav-links ${navOpen ? "nav-open" : ""}`} onClick={() => setNavOpen(false)}>
            <a href="/#home">Home</a>
            <a href="/test">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="/join" className="nav-primary">Join</a>
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Wallet</p>
            <h1 className="hero-title">Your Wallet</h1>
            <p className="hero-subtitle">View your credits, HAI rewards, and on-chain balance.</p>
          </div>
        </section>

        <section className="page-container">
          {isZeroWallet && (
            <div className="library-empty" style={{ marginBottom: "1.5rem" }}>
              <p>No wallet configured. Set <code>NEXT_PUBLIC_HAVNAI_WALLET</code> in your .env.local to connect your EVM wallet.</p>
              <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>Web3 wallet connect (MetaMask, WalletConnect) is coming in a future update.</p>
            </div>
          )}

          {/* Wallet address */}
          <div className="wallet-card">
            <div className="stat-label">Connected Wallet</div>
            <div className="wallet-address">{WALLET}</div>
          </div>

          {loading && <p className="library-loading">Loading wallet data...</p>}

          {!loading && (
            <div className="stats-grid">
              {/* Credits */}
              <div className="stat-card">
                <div className="stat-label">Credit Balance</div>
                <div className="stat-value">{credits?.balance?.toFixed(1) ?? "--"}</div>
                <div className="stat-sub">
                  {credits ? `${credits.total_deposited.toFixed(1)} deposited / ${credits.total_spent.toFixed(1)} spent` : "Credits not enabled"}
                </div>
              </div>

              {/* HAI rewards */}
              <div className="stat-card">
                <div className="stat-label">Total HAI Earned</div>
                <div className="stat-value">{rewards?.total_rewards?.toFixed(4) ?? "--"}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Claimable HAI</div>
                <div className="stat-value" style={{ color: "#8ff0b6" }}>{rewards?.claimable?.toFixed(4) ?? "--"}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Already Claimed</div>
                <div className="stat-value">{rewards?.claimed?.toFixed(4) ?? "--"}</div>
              </div>
            </div>
          )}

          {/* Claim section */}
          {!loading && rewards && rewards.claimable > 0 && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Claim Rewards</h3>
              </div>
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.85rem" }}>
                You have <strong style={{ color: "#8ff0b6" }}>{rewards.claimable.toFixed(4)} HAI</strong> available to claim.
                Once on-chain settlement is live, this will trigger a transaction to your wallet.
              </p>
              <button type="button" className="job-action-button" disabled={claiming} onClick={handleClaim}>
                {claiming ? "Claiming..." : `Claim ${rewards.claimable.toFixed(4)} HAI`}
              </button>
              {claimResult && (
                <p style={{ marginTop: "0.75rem", color: claimResult.includes("failed") ? "#ffb3b3" : "#8ff0b6", fontSize: "0.85rem" }}>
                  {claimResult}
                </p>
              )}
            </div>
          )}

          {/* Buy credits CTA */}
          <div className="chart-section" style={{ textAlign: "center" }}>
            <h3 className="chart-title" style={{ marginBottom: "0.75rem" }}>Need more credits?</h3>
            <a href="/pricing" className="job-action-button" style={{ textDecoration: "none", display: "inline-block" }}>
              Buy Credits
            </a>
          </div>
        </section>
      </main>
    </>
  );
};

export default WalletPage;
