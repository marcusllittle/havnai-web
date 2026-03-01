import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { WalletButton } from "../components/WalletButton";
import { useWallet } from "../lib/WalletContext";
import {
  fetchPackages,
  fetchCredits,
  fetchPaymentHistory,
  createCheckout,
  convertCreditsWithMetaMask,
  CreditPackage,
  CreditBalance,
  PaymentRecord,
  HavnaiApiError,
} from "../lib/havnai";

/** Wrap a promise with a timeout so it can't hang forever. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

const PricingPage: NextPage = () => {
  const { address: connectedWallet, connect: handleConnectWallet, connecting: connectingWallet } = useWallet();
  const [navOpen, setNavOpen] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [convertAmount, setConvertAmount] = useState<number>(0);
  const [convertMessage, setConvertMessage] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!convertAmount || convertAmount <= 0) {
      setConvertError("Please enter a valid amount of credits to convert.");
      return;
    }
    if (!connectedWallet) {
      setConvertError("Connect your MetaMask wallet before converting credits.");
      return;
    }
    setConverting(true);
    try {
      const res = await convertCreditsWithMetaMask(convertAmount, connectedWallet);
      setConvertMessage(res.message || `Converted ${res.converted} credits to HAI.`);
      setConvertError(null);
      const updated = await fetchCredits(connectedWallet);
      setBalance(updated);
    } catch (err: any) {
      setConvertMessage(null);
      if (err?.code === 4001 || /user rejected/i.test(String(err?.message || ""))) {
        setConvertError("Signature request was rejected in MetaMask.");
      } else if (err instanceof HavnaiApiError) {
        if (err.code === "nonce_expired") setConvertError("Signature expired. Please try again.");
        else if (err.code === "nonce_used") setConvertError("This signature has already been used. Please try again.");
        else if (err.code === "invalid_signature") setConvertError("Wallet signature verification failed.");
        else if (err.code === "insufficient_credits") setConvertError("Insufficient credits for this conversion amount.");
        else setConvertError(err.message);
      } else {
        setConvertError(typeof err?.message === "string" ? err.message : "Conversion failed.");
      }
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setSuccessMessage("Payment successful! Your credits have been added.");
      window.history.replaceState({}, "", "/pricing");
    } else if (params.get("payment") === "cancelled") {
      setError("Payment was cancelled.");
      window.history.replaceState({}, "", "/pricing");
    }

    async function load() {
      setLoading(true);
      setLoadError(false);

      const [pkgRes, balRes, histRes] = await Promise.allSettled([
        withTimeout(fetchPackages(), 8000),
        withTimeout(fetchCredits(), 8000),
        withTimeout(fetchPaymentHistory(), 8000),
      ]);

      if (pkgRes.status === "fulfilled") {
        setPackages(pkgRes.value.packages);
        setStripeEnabled(pkgRes.value.stripe_enabled);
      } else {
        setLoadError(true);
      }
      if (balRes.status === "fulfilled") setBalance(balRes.value);
      if (histRes.status === "fulfilled") setPayments(histRes.value);

      setLoading(false);
    }
    load();
  }, [connectedWallet]);

  const handleBuy = async (pkg: CreditPackage) => {
    setBuyingId(pkg.id);
    setError(null);
    try {
      const result = await createCheckout(pkg.id);
      if (!result.checkout_url) throw new Error("No checkout URL returned");
      window.location.href = result.checkout_url;
    } catch (err: any) {
      const message =
        err instanceof HavnaiApiError
          ? err.message
          : "Failed to start checkout. Please try again.";
      setError(message);
      setBuyingId(null);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const perCredit = (pkg: CreditPackage) =>
    `$${(pkg.price_cents / 100 / pkg.credits).toFixed(3)}/credit`;

  return (
    <>
      <Head>
        <title>Buy Credits — HavnAI</title>
        <meta name="description" content="Purchase HavnAI credits to generate images and videos on the GPU grid." />
      </Head>

      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Public Beta</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button type="button" className={`nav-toggle ${navOpen ? "nav-open" : ""}`} aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
            <span /><span />
          </button>
          <nav className={`nav-links ${navOpen ? "nav-open" : ""}`} onClick={() => setNavOpen(false)}>
            <a href="/#home">Home</a>
            <a href="/generator">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing" className="nav-active">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="/join" className="nav-primary">Join</a>
            <WalletButton />
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Credits</p>
            <h1 className="hero-title">Buy Credits</h1>
            <p className="hero-subtitle">
              Credits power every generation on the HavnAI grid.
              Pick a package, pay with card, and start creating.
            </p>
          </div>
        </section>

        <section className="page-container">
          {/* Balance bar */}
          {balance && (
            <div className="pricing-balance">
              <span className="pricing-balance-label">Your Balance</span>
              <span className="pricing-balance-value">{balance.balance.toFixed(1)} credits</span>
              {balance.credits_enabled === false && (
                <span className="pricing-balance-note">Credits system is currently in free mode</span>
              )}
            </div>
          )}

          {successMessage && (
            <div className="pricing-alert pricing-alert-success">{successMessage}</div>
          )}
          {error && (
            <div className="pricing-alert pricing-alert-error">{error}</div>
          )}

          {/* Credit packages */}
          {loading ? (
            <div className="pricing-loading">Loading packages...</div>
          ) : loadError && packages.length === 0 ? (
            <div className="pricing-loading" style={{ color: "var(--text-muted)" }}>
              <p>Unable to load packages right now.</p>
              <button
                type="button"
                className="job-action-button"
                style={{ marginTop: "0.75rem" }}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="pricing-grid">
              {packages.map((pkg) => (
                <article key={pkg.id} className={`pricing-card${pkg.id === "creator" ? " pricing-card-featured" : ""}`}>
                  {pkg.id === "creator" && <div className="pricing-card-badge">Best Value</div>}
                  <h3 className="pricing-card-name">{pkg.name}</h3>
                  <div className="pricing-card-price">{formatPrice(pkg.price_cents)}</div>
                  <div className="pricing-card-credits">{pkg.credits} credits</div>
                  <div className="pricing-card-per">{perCredit(pkg)}</div>
                  <p className="pricing-card-desc">{pkg.description}</p>
                  <button
                    type="button"
                    className={`btn ${pkg.id === "creator" ? "primary" : "tertiary"} wide`}
                    disabled={!stripeEnabled || buyingId !== null}
                    onClick={() => handleBuy(pkg)}
                  >
                    {buyingId === pkg.id ? "Redirecting..." : !stripeEnabled ? "Coming Soon" : "Buy Now"}
                  </button>
                </article>
              ))}
            </div>
          )}

          {/* Credit costs reference */}
          <div className="pricing-costs">
            <h3>What Credits Get You</h3>
            <div className="table-wrapper">
              <table className="rewards-table">
                <thead>
                  <tr>
                    <th>Generation Type</th>
                    <th>Credits per Job</th>
                    <th>Starter (50)</th>
                    <th>Creator (150)</th>
                    <th>Pro (500)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>SDXL Image</td>
                    <td>1.0</td>
                    <td>50 images</td>
                    <td>150 images</td>
                    <td>500 images</td>
                  </tr>
                  <tr>
                    <td>Video (LTX / WAN)</td>
                    <td>3.0</td>
                    <td>16 clips</td>
                    <td>50 clips</td>
                    <td>166 clips</td>
                  </tr>
                  <tr>
                    <td>AnimateDiff Video</td>
                    <td>2.0</td>
                    <td>25 clips</td>
                    <td>75 clips</td>
                    <td>250 clips</td>
                  </tr>
                  <tr>
                    <td>Face Swap</td>
                    <td>1.5</td>
                    <td>33 swaps</td>
                    <td>100 swaps</td>
                    <td>333 swaps</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="pricing-history">
              <h3>Payment History</h3>
              <div className="table-wrapper">
                <table className="rewards-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Package</th>
                      <th>Credits</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.session_id}>
                        <td>{new Date(p.created_at * 1000).toLocaleDateString()}</td>
                        <td>{p.package_id}</td>
                        <td>{p.credits}</td>
                        <td>{formatPrice(p.price_cents)}</td>
                        <td className={p.status === "completed" ? "status-done" : ""}>{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Convert credits to $HAI */}
          <div className="pricing-convert">
            <h3>Convert Credits to $HAI</h3>
            <p className="pricing-convert-desc">Trade unused credits for $HAI tokens. Requires a MetaMask signature.</p>
            <div className="convert-row">
              <button
                type="button"
                className="convert-wallet-btn"
                onClick={handleConnectWallet}
                disabled={connectingWallet || converting}
              >
                {connectedWallet
                  ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
                  : connectingWallet
                  ? "Connecting..."
                  : "Connect Wallet"}
              </button>
              <div className="convert-input-group">
                <input
                  type="number"
                  className="convert-input"
                  placeholder="Amount"
                  min="0"
                  value={convertAmount || ""}
                  onChange={(e) => setConvertAmount(parseFloat(e.target.value) || 0)}
                  disabled={!connectedWallet || converting}
                />
                <span className="convert-input-suffix">credits</span>
              </div>
              <button
                type="button"
                className="convert-submit-btn"
                onClick={handleConvert}
                disabled={converting || !connectedWallet || !convertAmount}
              >
                {converting ? "Converting..." : "Convert"}
              </button>
            </div>
            {convertMessage && <p className="convert-message">{convertMessage}</p>}
            {convertError && <p className="convert-error">{convertError}</p>}
          </div>

          {/* Wallet info */}
          <div className="pricing-wallet-info">
            <p>
              Wallet: <code>{connectedWallet || "Not connected"}</code>
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-copy">&copy; 2025 HavnAI Network</p>
        </div>
      </footer>
    </>
  );
};

export default PricingPage;
