import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import {
  fetchPackages,
  fetchCredits,
  fetchPaymentHistory,
  createCheckout,
  CreditPackage,
  CreditBalance,
  PaymentRecord,
  HavnaiApiError,
  WALLET,
} from "../lib/havnai";

const PricingPage: NextPage = () => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      try {
        const [pkgRes, balRes, histRes] = await Promise.allSettled([
          fetchPackages(),
          fetchCredits(),
          fetchPaymentHistory(),
        ]);
        if (pkgRes.status === "fulfilled") {
          setPackages(pkgRes.value.packages);
          setStripeEnabled(pkgRes.value.stripe_enabled);
        }
        if (balRes.status === "fulfilled") {
          setBalance(balRes.value);
        }
        if (histRes.status === "fulfilled") {
          setPayments(histRes.value);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleBuy = async (pkg: CreditPackage) => {
    setBuyingId(pkg.id);
    setError(null);
    try {
      const result = await createCheckout(pkg.id);
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
          <a href="/" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <nav className="nav-links" aria-label="Primary navigation">
            <a href="/">Home</a>
            <a href="/test">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing" className="nav-active">Buy Credits</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="section pricing-section">
          <div className="section-header">
            <h2>Buy Credits</h2>
            <p>Credits power every generation on the HavnAI grid. Pick a package, pay with card, and start creating.</p>
          </div>

          {/* Current balance */}
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

          {/* Packages */}
          {loading ? (
            <div className="pricing-loading">Loading packages...</div>
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
                    <td>SD1.5 Image</td>
                    <td>0.5</td>
                    <td>100 images</td>
                    <td>300 images</td>
                    <td>1,000 images</td>
                  </tr>
                  <tr>
                    <td>Face Swap</td>
                    <td>1.5</td>
                    <td>33 swaps</td>
                    <td>100 swaps</td>
                    <td>333 swaps</td>
                  </tr>
                  <tr>
                    <td>AnimateDiff Video</td>
                    <td>2.0</td>
                    <td>25 clips</td>
                    <td>75 clips</td>
                    <td>250 clips</td>
                  </tr>
                  <tr>
                    <td>LTX2 Video</td>
                    <td>3.0</td>
                    <td>16 clips</td>
                    <td>50 clips</td>
                    <td>166 clips</td>
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

          {/* Wallet info */}
          <div className="pricing-wallet-info">
            <p>
              Wallet: <code>{WALLET}</code>
            </p>
            <p className="pricing-wallet-note">
              Credits are tied to your wallet address. Set <code>NEXT_PUBLIC_HAVNAI_WALLET</code> in
              your environment to use a different wallet.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-copy">© 2025 HavnAI Network</p>
        </div>
      </footer>
    </>
  );
};

export default PricingPage;
