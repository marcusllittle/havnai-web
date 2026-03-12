import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { useWallet } from "../components/WalletProvider";
import {
  fetchCredits,
  fetchWalletRewards,
  claimRewards,
  fetchHaiFundings,
  fetchTesterDistributionRequests,
  requestTesterDistribution,
  CreditBalance,
  HaiFundingRecord,
  TesterDistributionConfig,
  TesterDistributionRequestRecord,
  WalletRewards,
} from "../lib/havnai";
import { ensureInjectedProvider, getConnectButtonLabel } from "../lib/wallet";
import { isHaiFundingConfigured, readHaiBalance, getBrowserProvider } from "../lib/hai-token";

const WalletPage: NextPage = () => {
  const wallet = useWallet();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [rewards, setRewards] = useState<WalletRewards | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);
  const [onChainHai, setOnChainHai] = useState<string | null>(null);
  const [fundings, setFundings] = useState<HaiFundingRecord[]>([]);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [testerConfig, setTesterConfig] = useState<TesterDistributionConfig | null>(null);
  const [testerRequests, setTesterRequests] = useState<TesterDistributionRequestRecord[]>([]);
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerSubmitting, setTesterSubmitting] = useState(false);
  const [testerAmount, setTesterAmount] = useState("100");
  const [testerNote, setTesterNote] = useState("");
  const [testerMessage, setTesterMessage] = useState<string | null>(null);
  const [testerError, setTesterError] = useState<string | null>(null);
  const haiFundingConfigured = isHaiFundingConfigured();
  const connectLabel = getConnectButtonLabel(wallet);

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!wallet.activeWallet) {
      setCredits(null);
      setRewards(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    Promise.all([
      fetchCredits(wallet.activeWallet).catch(() => null),
      fetchWalletRewards(wallet.activeWallet).catch(() => null),
    ]).then(([cr, rw]) => {
      if (!active) return;
      setCredits(cr);
      setRewards(rw);
      setLoading(false);
    });
    // Load on-chain HAI balance
    if (haiFundingConfigured && wallet.connectedWallet) {
      void (async () => {
        const selection = await ensureInjectedProvider();
        if (!active || !selection.provider) {
          if (active) setOnChainHai(null);
          return;
        }
        const provider = getBrowserProvider(selection.provider);
        readHaiBalance(wallet.connectedWallet!, provider)
          .then((result) => {
            if (active) setOnChainHai(result.formatted);
          })
          .catch(() => {
            if (active) setOnChainHai(null);
          });
      })();
    } else {
      setOnChainHai(null);
    }
    return () => { active = false; };
  }, [wallet.activeWallet]);

  useEffect(() => {
    let active = true;
    if (!wallet.activeWallet) {
      setFundings([]);
      setFundingError(null);
      setFundingLoading(false);
      setTesterRequests([]);
      setTesterConfig(null);
      setTesterLoading(false);
      setTesterError(null);
      setTesterMessage(null);
      return () => {
        active = false;
      };
    }

    setFundingLoading(true);
    setFundingError(null);
    fetchHaiFundings(wallet.activeWallet)
      .then((response) => {
        if (!active) return;
        setFundings(Array.isArray(response.fundings) ? response.fundings : []);
      })
      .catch((err: any) => {
        if (!active) return;
        setFundings([]);
        setFundingError(err?.message || "Failed to load HAI funding history.");
      })
      .finally(() => {
        if (active) setFundingLoading(false);
      });

    setTesterLoading(true);
    setTesterError(null);
    fetchTesterDistributionRequests(wallet.activeWallet)
      .then((response) => {
        if (!active) return;
        setTesterConfig(response.tester_distribution || null);
        setTesterRequests(Array.isArray(response.requests) ? response.requests : []);
      })
      .catch((err: any) => {
        if (!active) return;
        setTesterConfig(null);
        setTesterRequests([]);
        setTesterError(err?.message || "Failed to load tester distribution requests.");
      })
      .finally(() => {
        if (active) setTesterLoading(false);
      });

    return () => {
      active = false;
    };
  }, [wallet.activeWallet, claimResult]);

  useEffect(() => {
    if (!testerConfig?.default_request_hai) return;
    setTesterAmount((current) => {
      const parsed = Number.parseFloat(current);
      if (Number.isFinite(parsed) && parsed > 0) return current;
      return String(testerConfig.default_request_hai);
    });
  }, [testerConfig?.default_request_hai]);

  const handleClaim = async () => {
    if (!wallet.activeWallet) return;
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await claimRewards(wallet.activeWallet);
      setClaimResult(`Claimed ${res.claimed.toFixed(4)} HAI${res.tx_hash ? ` (tx: ${res.tx_hash})` : ""}`);
      // Refresh rewards
      const rw = await fetchWalletRewards(wallet.activeWallet).catch(() => null);
      if (rw) setRewards(rw);
    } catch (err: any) {
      setClaimResult(err?.message || "Claim failed.");
    }
    setClaiming(false);
  };

  const handleTesterRequest = async () => {
    if (!wallet.activeWallet) return;
    const amount = Number.parseFloat(testerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTesterError("Enter a valid HAI request amount.");
      return;
    }
    setTesterSubmitting(true);
    setTesterMessage(null);
    setTesterError(null);
    try {
      const result = await requestTesterDistribution(wallet.activeWallet, amount, testerNote);
      const message =
        result.message ||
        (result.status === "pending"
          ? "Tester distribution request submitted."
          : result.status === "pending_exists"
          ? "A pending tester request already exists."
          : `Request status: ${result.status}`);
      setTesterMessage(message);
      const refreshed = await fetchTesterDistributionRequests(wallet.activeWallet);
      setTesterConfig(refreshed.tester_distribution || null);
      setTesterRequests(Array.isArray(refreshed.requests) ? refreshed.requests : []);
      setTesterNote("");
    } catch (err: any) {
      setTesterError(err?.message || "Failed to submit tester distribution request.");
    } finally {
      setTesterSubmitting(false);
    }
  };

  const testerDistributionEnabled = testerConfig?.enabled === true;

  return (
    <>
      <Head><title>HavnAI Wallet</title></Head>
      <SiteHeader />

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Wallet</p>
            <h1 className="hero-title">Your Wallet</h1>
            <p className="hero-subtitle">View your credits, HAI rewards, and on-chain balance.</p>
          </div>
        </section>

        <section className="page-container">
          <div className="wallet-status-card">
            <div className="wallet-status-copy-block">
              <div className="wallet-status-heading-row">
                <span className={`wallet-status-pill wallet-source-${wallet.source}`}>
                  {wallet.source === "connected"
                    ? "Connected wallet"
                    : wallet.source === "env"
                    ? "Fallback site wallet"
                    : "No wallet"}
                </span>
                {wallet.providerName && <span className="wallet-status-provider">{wallet.providerName}</span>}
                {wallet.chainName && (
                  <span className={`wallet-status-provider${wallet.chainAllowed ? "" : " is-warning"}`}>
                    {wallet.chainName}
                  </span>
                )}
              </div>
              <div className="wallet-status-address">{wallet.activeWallet || "No wallet connected"}</div>
              <p className="wallet-status-note">
                {wallet.error?.message ||
                  wallet.message ||
                  (wallet.source === "connected"
                    ? "Wallet dashboard is using your connected MetaMask wallet."
                    : wallet.source === "env"
                    ? "Wallet dashboard is using NEXT_PUBLIC_HAVNAI_WALLET as a fallback site wallet."
                    : "Connect MetaMask or configure NEXT_PUBLIC_HAVNAI_WALLET to load wallet data.")}
              </p>
            </div>
            <div className="wallet-status-actions">
              <button
                type="button"
                className="job-action-button secondary"
                onClick={() => void wallet.connect()}
                disabled={wallet.connecting}
              >
                {connectLabel}
              </button>
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Tester Onboarding (Sepolia)</h3>
            </div>
            <ol style={{ color: "var(--text-muted)", lineHeight: 1.6, paddingLeft: "1.2rem", margin: 0 }}>
              <li>Connect MetaMask and confirm your active network is Sepolia.</li>
              <li>
                Get SepoliaETH for gas from faucets such as{" "}
                <a href="https://www.alchemy.com/faucets/ethereum-sepolia" target="_blank" rel="noreferrer">
                  Alchemy
                </a>{" "}
                or{" "}
                <a href="https://faucets.chain.link/sepolia" target="_blank" rel="noreferrer">
                  Chainlink
                </a>.
              </li>
              <li>Use Pricing to buy credits with HAI (1 HAI = 1 credit in this test phase).</li>
              <li>This page shows your credits, on-chain HAI, and HAI funding/tester request history.</li>
            </ol>
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

              {/* On-chain HAI balance */}
              {haiFundingConfigured && (
                <div className="stat-card">
                  <div className="stat-label">On-Chain HAI</div>
                  <div className="stat-value" style={{ color: "#ffd700" }}>
                    {onChainHai !== null ? Number(onChainHai).toFixed(2) : "--"}
                  </div>
                  <div className="stat-sub">Sepolia ERC-20 balance</div>
                </div>
              )}

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

          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">HAI Funding History</h3>
            </div>
            {fundingLoading ? (
              <p className="library-loading">Loading funding history...</p>
            ) : fundingError ? (
              <p className="job-hint error">{fundingError}</p>
            ) : fundings.length === 0 ? (
              <p className="job-hint">No HAI funding transactions recorded yet.</p>
            ) : (
              <div className="table-wrapper">
                <table className="rewards-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>HAI</th>
                      <th>Credits</th>
                      <th>Status</th>
                      <th>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundings.map((entry) => (
                      <tr key={entry.id}>
                        <td>{new Date(entry.created_at * 1000).toLocaleString()}</td>
                        <td>{entry.amount.toFixed(2)}</td>
                        <td>{entry.credits_granted.toFixed(2)}</td>
                        <td>{entry.status}</td>
                        <td>
                          {entry.tx_hash ? (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${entry.tx_hash}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {entry.tx_hash.slice(0, 10)}...
                            </a>
                          ) : (
                            "--"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="job-hint" style={{ marginTop: "0.6rem" }}>
              Pending means backend verification is still in progress; failed includes a verification error.
            </p>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Request Test HAI Support</h3>
            </div>
            <p className="job-hint" style={{ marginBottom: "0.8rem" }}>
              Trusted tester requests are reviewed manually by the HavnAI team. This is intentionally gated and
              may be allowlist-restricted.
            </p>
            {testerConfig && (
              <p className="job-hint" style={{ marginBottom: "0.8rem" }}>
                {testerDistributionEnabled
                  ? `Enabled · Default request ${testerConfig.default_request_hai} HAI · Cooldown ${testerConfig.cooldown_hours}h`
                  : "Tester distribution requests are currently disabled on this coordinator."}
              </p>
            )}
            <div className="convert-row">
              <div className="convert-input-group">
                <input
                  className="convert-input"
                  type="number"
                  min="1"
                  step="1"
                  value={testerAmount}
                  onChange={(event) => setTesterAmount(event.target.value)}
                  disabled={!wallet.activeWallet || testerSubmitting || !testerDistributionEnabled}
                />
              </div>
              <button
                type="button"
                className="convert-submit-btn"
                onClick={handleTesterRequest}
                disabled={!wallet.activeWallet || testerSubmitting || !testerDistributionEnabled}
              >
                {testerSubmitting ? "Submitting..." : "Request Test HAI"}
              </button>
            </div>
            <textarea
              className="library-search"
              style={{ marginTop: "0.6rem", minHeight: "80px", resize: "vertical" }}
              value={testerNote}
              onChange={(event) => setTesterNote(event.target.value)}
              placeholder="Optional note for reviewers (team, test scenario, urgency)"
              disabled={!wallet.activeWallet || testerSubmitting || !testerDistributionEnabled}
            />
            {testerMessage && <p className="convert-message">{testerMessage}</p>}
            {testerError && <p className="convert-error">{testerError}</p>}
            {testerLoading ? (
              <p className="library-loading">Loading tester requests...</p>
            ) : testerRequests.length === 0 ? (
              <p className="job-hint">No tester HAI requests yet for this wallet.</p>
            ) : (
              <div className="table-wrapper" style={{ marginTop: "0.8rem" }}>
                <table className="rewards-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Requested HAI</th>
                      <th>Status</th>
                      <th>Credits Granted</th>
                      <th>Admin Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testerRequests.map((requestRow) => (
                      <tr key={requestRow.id}>
                        <td>{new Date(requestRow.created_at * 1000).toLocaleString()}</td>
                        <td>{requestRow.requested_hai.toFixed(2)}</td>
                        <td>{requestRow.status}</td>
                        <td>{requestRow.credits_granted.toFixed(2)}</td>
                        <td>{requestRow.admin_note || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default WalletPage;
