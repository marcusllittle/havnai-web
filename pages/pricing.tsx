import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPackages,
  fetchCredits,
  fetchPaymentHistory,
  createCheckout,
  connectWallet,
  getConnectedWallet,
  convertCreditsWithMetaMask,
  fetchCreditReference,
  CreditPackage,
  CreditBalance,
  PaymentRecord,
  CreditReferenceRow,
  HavnaiApiError,
  isUsableWallet,
  WALLET,
} from "../lib/havnai";

const FALLBACK_PACKAGES: CreditPackage[] = [
  { id: "starter", name: "Starter Pack", credits: 50, price_cents: 500, description: "50 credits" },
  { id: "creator", name: "Creator Pack", credits: 150, price_cents: 1200, description: "150 credits – 20% bonus" },
  { id: "pro", name: "Pro Pack", credits: 500, price_cents: 3500, description: "500 credits – 30% bonus" },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPerCredit(pkg: CreditPackage): string {
  return `$${(pkg.price_cents / 100 / pkg.credits).toFixed(3)}/credit`;
}

function formatOutputCount(referenceId: string, credits: number, cost: number): string {
  const count = Math.floor(credits / cost);
  const withGrouping = count.toLocaleString();
  switch (referenceId) {
    case "face_swap":
      return `${withGrouping} ${count === 1 ? "swap" : "swaps"}`;
    case "animatediff_video":
    case "ltx2_video":
      return `${withGrouping} ${count === 1 ? "clip" : "clips"}`;
    default:
      return `${withGrouping} ${count === 1 ? "image" : "images"}`;
  }
}

const PricingPage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  const [creditReference, setCreditReference] = useState<CreditReferenceRow[]>([]);
  const [creditReferenceLoading, setCreditReferenceLoading] = useState(true);
  const [creditReferenceError, setCreditReferenceError] = useState<string | null>(null);

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [convertAmount, setConvertAmount] = useState("0");
  const [convertMessage, setConvertMessage] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);

  const envWallet = isUsableWallet(WALLET) ? WALLET : null;
  const activeWallet = isUsableWallet(connectedWallet) ? connectedWallet : envWallet;
  const referencePackages = packages.length > 0 ? packages : FALLBACK_PACKAGES;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setSuccessMessage("Payment successful. Your credits will appear after the Stripe webhook confirms the purchase.");
      window.history.replaceState({}, "", "/pricing");
    } else if (params.get("payment") === "cancelled") {
      setError("Payment was cancelled.");
      window.history.replaceState({}, "", "/pricing");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const detectWallet = async () => {
      try {
        const wallet = await getConnectedWallet();
        if (active) {
          setConnectedWallet(isUsableWallet(wallet) ? wallet : null);
        }
      } catch {
        if (active) {
          setConnectedWallet(null);
        }
      }
    };
    detectWallet();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPackages = async () => {
      setPackagesLoading(true);
      setPackagesError(null);
      try {
        const res = await fetchPackages();
        if (!active) return;
        setPackages(res.packages);
        setStripeEnabled(res.stripe_enabled);
      } catch (err: any) {
        if (!active) return;
        const message =
          err instanceof HavnaiApiError
            ? err.message
            : typeof err?.message === "string"
            ? err.message
            : "Failed to load credit packages.";
        setPackagesError(message);
      } finally {
        if (active) setPackagesLoading(false);
      }
    };

    const loadReference = async () => {
      setCreditReferenceLoading(true);
      setCreditReferenceError(null);
      try {
        const res = await fetchCreditReference();
        if (!active) return;
        setCreditReference(res.reference);
      } catch (err: any) {
        if (!active) return;
        const message =
          err instanceof HavnaiApiError
            ? err.message
            : typeof err?.message === "string"
            ? err.message
            : "Failed to load credit cost reference.";
        setCreditReferenceError(message);
      } finally {
        if (active) setCreditReferenceLoading(false);
      }
    };

    loadPackages();
    loadReference();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadWalletData = async () => {
      setWalletLoading(true);
      if (!activeWallet) {
        setBalance(null);
        setPayments([]);
        setWalletLoading(false);
        return;
      }
      try {
        const [balRes, histRes] = await Promise.allSettled([
          fetchCredits(activeWallet),
          fetchPaymentHistory(activeWallet),
        ]);
        if (!active) return;
        if (balRes.status === "fulfilled") {
          setBalance(balRes.value);
        } else {
          setBalance(null);
        }
        if (histRes.status === "fulfilled") {
          setPayments(histRes.value);
        } else {
          setPayments([]);
        }
      } finally {
        if (active) setWalletLoading(false);
      }
    };
    loadWalletData();
    return () => {
      active = false;
    };
  }, [activeWallet, successMessage]);

  const handleConnectWallet = async () => {
    setConnectingWallet(true);
    setConvertError(null);
    setError(null);
    try {
      const wallet = await connectWallet();
      setConnectedWallet(wallet);
    } catch (err: any) {
      const message =
        err instanceof HavnaiApiError
          ? err.message
          : typeof err?.message === "string"
          ? err.message
          : "Wallet connection failed.";
      setConvertError(message);
    } finally {
      setConnectingWallet(false);
    }
  };

  const handleConvert = async () => {
    const amount = Number.parseFloat(convertAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setConvertError("Please enter a valid amount of credits to convert.");
      return;
    }
    if (!connectedWallet) {
      setConvertError("Connect your MetaMask wallet before converting credits.");
      return;
    }
    setConverting(true);
    try {
      const res = await convertCreditsWithMetaMask(amount, connectedWallet);
      setConvertMessage(res.message || `Converted ${res.converted} credits to HAI.`);
      setConvertError(null);
      const updated = await fetchCredits(connectedWallet);
      setBalance(updated);
    } catch (err: any) {
      setConvertMessage(null);
      if (err?.code === 4001 || /user rejected/i.test(String(err?.message || ""))) {
        setConvertError("Signature request was rejected in MetaMask.");
      } else if (err instanceof HavnaiApiError) {
        if (err.code === "nonce_expired") {
          setConvertError("Signature expired. Please try again.");
        } else if (err.code === "nonce_used") {
          setConvertError("This signature has already been used. Please try again.");
        } else if (err.code === "invalid_signature") {
          setConvertError("Wallet signature verification failed.");
        } else if (err.code === "insufficient_credits") {
          setConvertError("Insufficient credits for this conversion amount.");
        } else {
          setConvertError(err.message);
        }
      } else {
        setConvertError(typeof err?.message === "string" ? err.message : "Conversion failed.");
      }
    } finally {
      setConverting(false);
    }
  };

  const handleBuy = async (pkg: CreditPackage) => {
    setError(null);
    if (!activeWallet) {
      setError("Connect a wallet or configure NEXT_PUBLIC_HAVNAI_WALLET before buying credits.");
      return;
    }
    setBuyingId(pkg.id);
    try {
      const result = await createCheckout(pkg.id, activeWallet);
      if (!result.checkout_url) {
        throw new Error("No checkout URL returned");
      }
      window.location.href = result.checkout_url;
    } catch (err: any) {
      const message =
        err instanceof HavnaiApiError
          ? err.message
          : typeof err?.message === "string"
          ? err.message
          : "Failed to start checkout. Please try again.";
      setError(message);
      setBuyingId(null);
    }
  };

  const packageDestination = activeWallet || "No active wallet configured";

  const referenceRows = useMemo(() => {
    if (creditReference.length > 0) return creditReference;
    return [
      { id: "sdxl_image", label: "SDXL Image", credits_per_job: 1.0 },
      { id: "sd15_image", label: "SD1.5 Image", credits_per_job: 0.5 },
      { id: "face_swap", label: "Face Swap", credits_per_job: 1.5 },
      { id: "animatediff_video", label: "AnimateDiff Video", credits_per_job: 2.0 },
      { id: "ltx2_video", label: "LTX2 Video", credits_per_job: 3.0 },
    ];
  }, [creditReference]);

  return (
    <>
      <Head>
        <title>Buy Credits — HavnAI</title>
        <meta
          name="description"
          content="Purchase HavnAI credits to generate images and videos on the GPU grid."
        />
      </Head>

      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Stage 6 → 7 Alpha</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button
            type="button"
            className={`nav-toggle ${navOpen ? "nav-open" : ""}`}
            id="navToggle"
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
          <nav
            className={`nav-links ${navOpen ? "nav-open" : ""}`}
            id="primaryNav"
            aria-label="Primary navigation"
          >
            <a href="/#home">Home</a>
            <a href="/test">Generator</a>
            <a href="/library">My Library</a>
            <a href="/api/dashboard" target="_blank" rel="noreferrer">
              Dashboard
            </a>
            <a href="/pricing" className="nav-active">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="#join">Join Alpha</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="section pricing-section">
          <div className="section-header">
            <h2>Buy Credits</h2>
            <p>
              Credits power every generation on the HavnAI grid. Package pricing loads independently from wallet
              history so store availability is visible even if account lookups fail.
            </p>
          </div>

          {balance && (
            <div className="pricing-balance">
              <span className="pricing-balance-label">Your Balance</span>
              <span className="pricing-balance-value">{balance.balance.toFixed(1)} credits</span>
              {balance.credits_enabled === false && (
                <span className="pricing-balance-note">Credits are currently running in free mode.</span>
              )}
            </div>
          )}

          {walletLoading && activeWallet && <div className="pricing-loading">Loading wallet data...</div>}
          {successMessage && <div className="pricing-alert pricing-alert-success">{successMessage}</div>}
          {error && <div className="pricing-alert pricing-alert-error">{error}</div>}

          <div className="pricing-wallet-info">
            <p>
              Purchase destination: <code>{packageDestination}</code>
            </p>
            <p className="pricing-wallet-note">
              Credit purchases and balance/history use the active wallet above. Generator submissions still use{" "}
              <code>NEXT_PUBLIC_HAVNAI_WALLET</code>.
            </p>
          </div>

          {packagesLoading ? (
            <div className="pricing-loading">Loading packages...</div>
          ) : packagesError ? (
            <div className="pricing-alert pricing-alert-error">{packagesError}</div>
          ) : packages.length === 0 ? (
            <div className="pricing-alert pricing-alert-error">No credit packages are currently configured.</div>
          ) : (
            <div className="pricing-grid">
              {packages.map((pkg) => (
                <article
                  key={pkg.id}
                  className={`pricing-card${pkg.id === "creator" ? " pricing-card-featured" : ""}`}
                >
                  {pkg.id === "creator" && <div className="pricing-card-badge">Best Value</div>}
                  <h3 className="pricing-card-name">{pkg.name}</h3>
                  <div className="pricing-card-price">{formatPrice(pkg.price_cents)}</div>
                  <div className="pricing-card-credits">{pkg.credits} credits</div>
                  <div className="pricing-card-per">{formatPerCredit(pkg)}</div>
                  <p className="pricing-card-desc">{pkg.description}</p>
                  <button
                    type="button"
                    className={`btn ${pkg.id === "creator" ? "primary" : "tertiary"} wide`}
                    disabled={!stripeEnabled || buyingId !== null || !activeWallet}
                    onClick={() => handleBuy(pkg)}
                  >
                    {buyingId === pkg.id
                      ? "Redirecting..."
                      : !activeWallet
                      ? "Set Wallet"
                      : !stripeEnabled
                      ? "Payments Disabled"
                      : "Buy Now"}
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="pricing-costs">
            <h3>What Credits Get You</h3>
            <p className="pricing-wallet-note" style={{ marginBottom: "0.9rem" }}>
              This table is derived from the coordinator&apos;s current default credit costs.
            </p>
            {creditReferenceLoading ? (
              <div className="pricing-loading">Loading credit cost reference...</div>
            ) : creditReferenceError ? (
              <div className="pricing-alert pricing-alert-error">{creditReferenceError}</div>
            ) : (
              <div className="table-wrapper">
                <table className="rewards-table">
                  <thead>
                    <tr>
                      <th>Generation Type</th>
                      <th>Credits per Job</th>
                      {referencePackages.map((pkg) => (
                        <th key={`pkg-col-${pkg.id}`}>
                          {pkg.name.replace(" Pack", "")} ({pkg.credits})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referenceRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        <td>{row.credits_per_job.toFixed(1)}</td>
                        {referencePackages.map((pkg) => (
                          <td key={`${row.id}-${pkg.id}`}>
                            {formatOutputCount(row.id, pkg.credits, row.credits_per_job)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
                    {payments.map((payment) => (
                      <tr key={payment.session_id}>
                        <td>{new Date(payment.created_at * 1000).toLocaleDateString()}</td>
                        <td>{payment.package_id}</td>
                        <td>{payment.credits}</td>
                        <td>{formatPrice(payment.price_cents)}</td>
                        <td className={payment.status === "completed" ? "status-done" : ""}>
                          {payment.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pricing-convert">
            <h3>Convert credits to $HAI</h3>
            <p>Convert your unused credits into $HAI tokens.</p>
            <div className="convert-wallet-row">
              <button type="button" onClick={handleConnectWallet} disabled={connectingWallet || converting}>
                {connectedWallet
                  ? `Connected: ${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
                  : connectingWallet
                  ? "Connecting..."
                  : "Connect Wallet"}
              </button>
            </div>
            <div className="convert-controls">
              <input
                type="number"
                min="0"
                step="0.1"
                value={convertAmount}
                onChange={(event) => setConvertAmount(event.target.value)}
                disabled={!connectedWallet || converting}
              />
              <button type="button" onClick={handleConvert} disabled={converting || !connectedWallet}>
                {converting ? "Converting..." : "Convert"}
              </button>
            </div>
            {!connectedWallet && (
              <p className="convert-note">Connect MetaMask to sign conversion requests.</p>
            )}
            {convertMessage && <p className="convert-message">{convertMessage}</p>}
            {convertError && <p className="convert-error">{convertError}</p>}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-copy">© 2026 HavnAI Network</p>
        </div>
      </footer>
    </>
  );
};

export default PricingPage;
