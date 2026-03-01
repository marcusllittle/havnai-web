import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../components/WalletProvider";
import {
  createWorkflow,
  fetchCredits,
  fetchGalleryBrowse,
  fetchGalleryPurchases,
  fetchMarketplace,
  fetchMyGalleryListings,
  GalleryListing,
  GalleryPurchaseRecord,
  HavnaiApiError,
  delistGalleryListing,
  purchaseGalleryListing,
  Workflow,
} from "../lib/havnai";
import { getConnectButtonLabel, isUsableWallet } from "../lib/wallet";

type MarketplaceTab = "gallery" | "workflows";
type GalleryView = "browse" | "my-listings" | "purchases";
type GalleryAssetFilter = "all" | "image" | "video";
type WorkflowView = "browse" | "create";

const WORKFLOW_CATEGORIES = [
  "All",
  "Image Generation",
  "Video Generation",
  "Face Swap",
  "Upscaling",
  "Style Transfer",
  "Other",
];

const GALLERY_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_low", label: "Price low" },
  { value: "price_high", label: "Price high" },
];

function describeWalletSource(source: "connected" | "env" | "none"): string {
  if (source === "connected") return "Connected wallet";
  if (source === "env") return "Fallback site wallet";
  return "No wallet";
}

function formatWallet(wallet?: string | null): string {
  if (!wallet) return "--";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatCredits(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toFixed(1);
}

function formatTimestamp(value?: number | null): string {
  if (!value) return "--";
  const date = new Date(value * 1000);
  if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  const millisDate = new Date(value);
  if (!Number.isNaN(millisDate.getTime())) return millisDate.toLocaleString();
  return "--";
}

function purchaseToListing(purchase: GalleryPurchaseRecord): GalleryListing {
  return {
    id: purchase.listing_id,
    job_id: purchase.job_id,
    seller_wallet: purchase.seller_wallet,
    title: purchase.title,
    description: "",
    price_credits: purchase.price_paid,
    category: undefined,
    asset_type: purchase.asset_type,
    model: purchase.model,
    prompt: purchase.prompt,
    listed: false,
    sold: true,
    status: "sold",
    image_url: purchase.image_url,
    video_url: purchase.video_url,
    preview_url: purchase.preview_url,
    created_at: purchase.created_at,
    updated_at: purchase.created_at,
  };
}

const MarketplacePage: NextPage = () => {
  const wallet = useWallet();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const [tab, setTab] = useState<MarketplaceTab>("gallery");
  const [galleryView, setGalleryView] = useState<GalleryView>("browse");
  const [workflowView, setWorkflowView] = useState<WorkflowView>("browse");

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryAssetType, setGalleryAssetType] = useState<GalleryAssetFilter>("all");
  const [gallerySort, setGallerySort] = useState("newest");
  const [galleryPage, setGalleryPage] = useState(0);
  const [galleryListings, setGalleryListings] = useState<GalleryListing[]>([]);
  const [galleryTotal, setGalleryTotal] = useState(0);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);

  const [myListings, setMyListings] = useState<GalleryListing[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsError, setMyListingsError] = useState<string | null>(null);

  const [purchases, setPurchases] = useState<GalleryPurchaseRecord[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);

  const [selectedListing, setSelectedListing] = useState<GalleryListing | null>(null);
  const [selectedListingReadonly, setSelectedListingReadonly] = useState(false);
  const [galleryActionLoading, setGalleryActionLoading] = useState(false);
  const [galleryActionError, setGalleryActionError] = useState<string | null>(null);
  const [galleryActionSuccess, setGalleryActionSuccess] = useState<string | null>(null);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowTotal, setWorkflowTotal] = useState(0);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowCategory, setWorkflowCategory] = useState("All");
  const [workflowPage, setWorkflowPage] = useState(0);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("Image Generation");
  const [formModel, setFormModel] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formNeg, setFormNeg] = useState("");
  const [formSteps, setFormSteps] = useState(28);
  const [formGuidance, setFormGuidance] = useState(6);
  const [workflowCreating, setWorkflowCreating] = useState(false);
  const [workflowCreateError, setWorkflowCreateError] = useState("");
  const [workflowCreateSuccess, setWorkflowCreateSuccess] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const workflowLimit = 20;
  const galleryLimit = 24;
  const activeWallet = wallet.activeWallet;
  const connectedWallet = wallet.connectedWallet;
  const walletSourceLabel = describeWalletSource(wallet.source);
  const connectLabel = getConnectButtonLabel(wallet);
  const galleryTotalPages = Math.max(1, Math.ceil(galleryTotal / galleryLimit));
  const workflowTotalPages = Math.max(1, Math.ceil(workflowTotal / workflowLimit));

  useEffect(() => {
    if (!router.isReady) return;
    const rawTab = typeof router.query.tab === "string" ? router.query.tab : "gallery";
    const rawGalleryView =
      typeof router.query.galleryView === "string" ? router.query.galleryView : "browse";

    setTab(rawTab === "workflows" ? "workflows" : "gallery");
    if (rawGalleryView === "my-listings" || rawGalleryView === "purchases") {
      setGalleryView(rawGalleryView);
    } else {
      setGalleryView("browse");
    }
  }, [router.isReady, router.query.tab, router.query.galleryView]);

  useEffect(() => {
    if (!router.isReady) return;
    const currentTab = typeof router.query.tab === "string" ? router.query.tab : undefined;
    const currentGalleryView =
      typeof router.query.galleryView === "string" ? router.query.galleryView : undefined;
    const nextQuery =
      tab === "gallery"
        ? { tab, galleryView }
        : { tab };
    const shouldReplace =
      currentTab !== tab ||
      (tab === "gallery" && currentGalleryView !== galleryView) ||
      (tab === "workflows" && currentGalleryView != null);
    if (!shouldReplace) return;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  }, [galleryView, router, tab]);

  useEffect(() => {
    let active = true;
    if (!activeWallet) {
      setCreditBalance(null);
      return () => {
        active = false;
      };
    }
    const loadCredits = async () => {
      setCreditLoading(true);
      try {
        const res = await fetchCredits(activeWallet);
        if (active) setCreditBalance(res.balance);
      } catch {
        if (active) setCreditBalance(null);
      } finally {
        if (active) setCreditLoading(false);
      }
    };
    loadCredits();
    return () => {
      active = false;
    };
  }, [activeWallet, galleryRefreshKey]);

  useEffect(() => {
    let active = true;
    const loadGallery = async () => {
      setGalleryLoading(true);
      setGalleryError(null);
      try {
        const res = await fetchGalleryBrowse({
          search: gallerySearch || undefined,
          asset_type: galleryAssetType === "all" ? undefined : galleryAssetType,
          sort: gallerySort,
          offset: galleryPage * galleryLimit,
          limit: galleryLimit,
        });
        if (!active) return;
        setGalleryListings(res.listings);
        setGalleryTotal(res.total);
      } catch (err: any) {
        if (!active) return;
        setGalleryListings([]);
        setGalleryTotal(0);
        setGalleryError(err?.message || "Failed to load gallery listings.");
      } finally {
        if (active) setGalleryLoading(false);
      }
    };
    loadGallery();
    return () => {
      active = false;
    };
  }, [galleryAssetType, galleryPage, galleryRefreshKey, gallerySearch, gallerySort]);

  useEffect(() => {
    let active = true;
    if (!activeWallet) {
      setMyListings([]);
      setMyListingsError(null);
      return () => {
        active = false;
      };
    }
    const loadMyListings = async () => {
      setMyListingsLoading(true);
      setMyListingsError(null);
      try {
        const items = await fetchMyGalleryListings(activeWallet);
        if (active) setMyListings(items);
      } catch (err: any) {
        if (active) {
          setMyListings([]);
          setMyListingsError(err?.message || "Failed to load your listings.");
        }
      } finally {
        if (active) setMyListingsLoading(false);
      }
    };
    loadMyListings();
    return () => {
      active = false;
    };
  }, [activeWallet, galleryRefreshKey]);

  useEffect(() => {
    let active = true;
    if (!activeWallet) {
      setPurchases([]);
      setPurchasesError(null);
      return () => {
        active = false;
      };
    }
    const loadPurchases = async () => {
      setPurchasesLoading(true);
      setPurchasesError(null);
      try {
        const items = await fetchGalleryPurchases(activeWallet);
        if (active) setPurchases(items);
      } catch (err: any) {
        if (active) {
          setPurchases([]);
          setPurchasesError(err?.message || "Failed to load purchases.");
        }
      } finally {
        if (active) setPurchasesLoading(false);
      }
    };
    loadPurchases();
    return () => {
      active = false;
    };
  }, [activeWallet, galleryRefreshKey]);

  useEffect(() => {
    let active = true;
    const loadWorkflows = async () => {
      setWorkflowLoading(true);
      try {
        const category = workflowCategory === "All" ? undefined : workflowCategory;
        const res = await fetchMarketplace({
          search: workflowSearch || undefined,
          category,
          offset: workflowPage * workflowLimit,
          limit: workflowLimit,
        });
        if (!active) return;
        setWorkflows(res.workflows);
        setWorkflowTotal(res.total);
      } catch {
        if (active) {
          setWorkflows([]);
          setWorkflowTotal(0);
        }
      } finally {
        if (active) setWorkflowLoading(false);
      }
    };
    loadWorkflows();
    return () => {
      active = false;
    };
  }, [workflowCategory, workflowPage, workflowSearch]);

  const galleryCards = useMemo(() => galleryListings, [galleryListings]);

  const handleConnectWallet = async () => {
    try {
      await wallet.connect();
      setGalleryRefreshKey((value) => value + 1);
    } catch (err: any) {
      setGalleryActionError(
        err instanceof HavnaiApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : typeof err?.message === "string"
          ? err.message
          : "Wallet connection failed."
      );
    }
  };

  const handleCreateWorkflow = async () => {
    if (!formName.trim()) {
      setWorkflowCreateError("Name is required.");
      return;
    }
    setWorkflowCreating(true);
    setWorkflowCreateError("");
    setWorkflowCreateSuccess("");
    try {
      const workflow = await createWorkflow({
        wallet: activeWallet || undefined,
        name: formName.trim(),
        description: formDesc.trim(),
        category: formCategory,
        config: {
          model: formModel.trim() || "auto",
          prompt_template: formPrompt.trim(),
          negative_prompt: formNeg.trim(),
          steps: formSteps,
          guidance: formGuidance,
        },
      });
      setWorkflowCreateSuccess(
        `Workflow "${workflow.name}" created. Marketplace publishing is not exposed in the web UI yet.`
      );
      setFormName("");
      setFormDesc("");
      setFormPrompt("");
      setFormNeg("");
    } catch (err: any) {
      setWorkflowCreateError(err?.message || "Failed to create workflow.");
    } finally {
      setWorkflowCreating(false);
    }
  };

  const openBrowseListing = (listing: GalleryListing) => {
    setSelectedListing(listing);
    setSelectedListingReadonly(false);
    setGalleryActionError(null);
    setGalleryActionSuccess(null);
  };

  const openPurchaseListing = (purchase: GalleryPurchaseRecord) => {
    setSelectedListing(purchaseToListing(purchase));
    setSelectedListingReadonly(true);
    setGalleryActionError(null);
    setGalleryActionSuccess(null);
  };

  const closeListingDrawer = () => {
    setSelectedListing(null);
    setSelectedListingReadonly(false);
    setGalleryActionError(null);
  };

  const handlePurchase = async () => {
    if (!selectedListing || !connectedWallet || !isUsableWallet(connectedWallet)) return;
    setGalleryActionLoading(true);
    setGalleryActionError(null);
    setGalleryActionSuccess(null);
    try {
      await purchaseGalleryListing(selectedListing.id, connectedWallet, selectedListing.price_credits);
      setGalleryActionSuccess("Purchase complete.");
      setGalleryRefreshKey((value) => value + 1);
      closeListingDrawer();
    } catch (err: any) {
      const message =
        err instanceof HavnaiApiError
          ? err.message
          : typeof err?.message === "string"
          ? err.message
          : "Purchase failed.";
      setGalleryActionError(message);
    } finally {
      setGalleryActionLoading(false);
    }
  };

  const handleDelist = async () => {
    if (!selectedListing || !activeWallet || !isUsableWallet(activeWallet)) return;
    setGalleryActionLoading(true);
    setGalleryActionError(null);
    setGalleryActionSuccess(null);
    try {
      await delistGalleryListing(selectedListing.id, activeWallet);
      setGalleryActionSuccess("Listing removed.");
      setGalleryRefreshKey((value) => value + 1);
      closeListingDrawer();
    } catch (err: any) {
      const message =
        err instanceof HavnaiApiError
          ? err.message
          : typeof err?.message === "string"
          ? err.message
          : "Failed to remove listing.";
      setGalleryActionError(message);
    } finally {
      setGalleryActionLoading(false);
    }
  };

  const userOwnsSelectedListing =
    selectedListing && activeWallet
      ? selectedListing.seller_wallet.toLowerCase() === activeWallet.toLowerCase()
      : false;

  const galleryPrimaryActionDisabled =
    !selectedListing ||
    selectedListingReadonly ||
    !connectedWallet ||
    userOwnsSelectedListing ||
    selectedListing.status !== "active";

  const galleryPrimaryActionLabel = !selectedListing
    ? "Unavailable"
    : selectedListingReadonly
    ? "Purchased"
    : !connectedWallet
    ? "Connect MetaMask to buy"
    : userOwnsSelectedListing
    ? "Your listing"
    : selectedListing.status !== "active"
    ? "Unavailable"
    : `Buy for ${selectedListing.price_credits.toFixed(1)} credits`;

  return (
    <>
      <Head>
        <title>HavnAI Marketplace</title>
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
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace" className="nav-active">
              Marketplace
            </a>
            <a href="#join">Join Alpha</a>
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Marketplace</p>
            <h1 className="hero-title">Gallery and workflows</h1>
            <p className="hero-subtitle">
              Buy generated assets with credits, manage your listings, and browse reusable workflows.
            </p>
          </div>
        </section>

        <section className="page-container">
          <div className="marketplace-tabs">
            <button
              type="button"
              className={`marketplace-tab ${tab === "gallery" ? "is-active" : ""}`}
              onClick={() => setTab("gallery")}
            >
              Gallery
            </button>
            <button
              type="button"
              className={`marketplace-tab ${tab === "workflows" ? "is-active" : ""}`}
              onClick={() => setTab("workflows")}
            >
              Workflows
            </button>
          </div>

          {tab === "gallery" && (
            <>
              <div className="marketplace-wallet-strip">
                <div className="wallet-status-copy-block">
                  <div className="wallet-status-heading-row">
                    <span className={`wallet-status-pill wallet-source-${wallet.source}`}>{walletSourceLabel}</span>
                    {wallet.providerName && <span className="wallet-status-provider">{wallet.providerName}</span>}
                    {wallet.chainName && (
                      <span className={`wallet-status-provider${wallet.chainAllowed ? "" : " is-warning"}`}>
                        {wallet.chainName}
                      </span>
                    )}
                  </div>
                  <div className="marketplace-wallet-label">Active wallet</div>
                  <div className="marketplace-wallet-value">
                    {activeWallet ? activeWallet : "Browse-only mode"}
                  </div>
                  <p className="wallet-status-note">
                    {wallet.error?.message ||
                      wallet.message ||
                      (wallet.source === "connected"
                        ? "Gallery purchases use your connected wallet for signatures. Generator outputs may still belong to the env submission wallet."
                        : wallet.source === "env"
                        ? "Browsing and wallet views can use the fallback site wallet, but purchases and new gallery listings still require MetaMask signatures."
                        : "Browse without a wallet. Connect MetaMask to buy listings or create signed gallery actions.")}
                  </p>
                </div>
                <div>
                  <div className="marketplace-wallet-label">Credits</div>
                  <div className="marketplace-wallet-value">
                    {creditLoading ? "Loading..." : `${formatCredits(creditBalance)} credits`}
                  </div>
                </div>
                <div className="marketplace-wallet-actions">
                  <button
                    type="button"
                    className="job-action-button secondary"
                    onClick={handleConnectWallet}
                    disabled={wallet.connecting}
                  >
                    {connectLabel}
                  </button>
                  {!activeWallet && (
                    <span className="marketplace-wallet-note">
                      Browsing works without a wallet. Buying and seller tools require one.
                    </span>
                  )}
                </div>
              </div>

              {galleryActionSuccess && <p className="job-hint" style={{ color: "#8ff0b6" }}>{galleryActionSuccess}</p>}

              <div className="marketplace-subtabs">
                <button
                  type="button"
                  className={`library-chip ${galleryView === "browse" ? "is-active" : ""}`}
                  onClick={() => setGalleryView("browse")}
                >
                  Browse
                </button>
                <button
                  type="button"
                  className={`library-chip ${galleryView === "my-listings" ? "is-active" : ""}`}
                  onClick={() => activeWallet && setGalleryView("my-listings")}
                  disabled={!activeWallet}
                >
                  My Listings
                </button>
                <button
                  type="button"
                  className={`library-chip ${galleryView === "purchases" ? "is-active" : ""}`}
                  onClick={() => activeWallet && setGalleryView("purchases")}
                  disabled={!activeWallet}
                >
                  Purchases
                </button>
              </div>

              {galleryView === "browse" && (
                <>
                  <div className="library-toolbar-inner marketplace-toolbar">
                    <div className="library-search-wrapper">
                      <input
                        type="text"
                        className="library-search"
                        placeholder="Search listings by title, prompt, or model..."
                        value={gallerySearch}
                        onChange={(event) => {
                          setGallerySearch(event.target.value);
                          setGalleryPage(0);
                        }}
                      />
                    </div>
                    <div className="library-filters">
                      <div className="library-filter-group">
                        <span className="library-filter-label">Asset type</span>
                        {(["all", "image", "video"] as GalleryAssetFilter[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`library-chip ${galleryAssetType === value ? "is-active" : ""}`}
                            onClick={() => {
                              setGalleryAssetType(value);
                              setGalleryPage(0);
                            }}
                          >
                            {value === "all" ? "All" : value === "image" ? "Image" : "Video"}
                          </button>
                        ))}
                      </div>
                      <div className="library-filter-group">
                        <span className="library-filter-label">Sort</span>
                        <select
                          className="library-sort-select"
                          value={gallerySort}
                          onChange={(event) => {
                            setGallerySort(event.target.value);
                            setGalleryPage(0);
                          }}
                        >
                          {GALLERY_SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {galleryLoading && <p className="library-loading">Loading gallery...</p>}
                  {galleryError && <p className="job-hint error">{galleryError}</p>}
                  {!galleryLoading && galleryCards.length === 0 && (
                    <div className="library-empty">
                      <p>No listings found yet.</p>
                    </div>
                  )}
                  {!galleryLoading && galleryCards.length > 0 && (
                    <>
                      <div className="marketplace-gallery-grid">
                        {galleryCards.map((listing) => (
                          <article
                            key={listing.id}
                            className="marketplace-gallery-card"
                            onClick={() => openBrowseListing(listing)}
                          >
                            <div className="marketplace-gallery-media">
                              {listing.video_url ? (
                                <video src={listing.video_url} muted playsInline preload="metadata" />
                              ) : listing.image_url ? (
                                <img src={listing.image_url} alt={listing.title} loading="lazy" />
                              ) : (
                                <div className="library-preview-empty">No preview</div>
                              )}
                              <span className={`marketplace-status-badge status-${listing.status}`}>
                                {listing.status}
                              </span>
                            </div>
                            <div className="marketplace-gallery-body">
                              <div className="marketplace-gallery-header">
                                <h3>{listing.title}</h3>
                                <span className="marketplace-gallery-price">
                                  {listing.price_credits.toFixed(1)} credits
                                </span>
                              </div>
                              <div className="marketplace-gallery-meta">
                                <span>{listing.asset_type}</span>
                                {listing.category && <span>{listing.category}</span>}
                                {listing.model && <span>{listing.model}</span>}
                              </div>
                              <div className="marketplace-gallery-footer">
                                <span>{formatWallet(listing.seller_wallet)}</span>
                                <span>{formatTimestamp(listing.created_at)}</span>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>

                      {galleryTotalPages > 1 && (
                        <div className="marketplace-pagination">
                          <button
                            type="button"
                            className="library-chip"
                            disabled={galleryPage === 0}
                            onClick={() => setGalleryPage((page) => Math.max(0, page - 1))}
                          >
                            Prev
                          </button>
                          <span>
                            {galleryPage + 1} / {galleryTotalPages}
                          </span>
                          <button
                            type="button"
                            className="library-chip"
                            disabled={galleryPage >= galleryTotalPages - 1}
                            onClick={() => setGalleryPage((page) => page + 1)}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {galleryView === "my-listings" && (
                <div className="chart-section marketplace-panel">
                  <div className="chart-header">
                    <h3 className="chart-title">My Listings</h3>
                  </div>
                    {!activeWallet && (
                      <p className="job-hint">Connect a wallet or configure `NEXT_PUBLIC_HAVNAI_WALLET` to manage listings.</p>
                    )}
                  {activeWallet && myListingsLoading && <p className="library-loading">Loading your listings...</p>}
                  {activeWallet && myListingsError && <p className="job-hint error">{myListingsError}</p>}
                  {activeWallet && !myListingsLoading && myListings.length === 0 && (
                    <div className="library-empty">
                      <p>No listings yet. Create one from a completed job in Generator or Library.</p>
                    </div>
                  )}
                  {activeWallet && !myListingsLoading && myListings.length > 0 && (
                    <div className="marketplace-owned-list">
                      {myListings.map((listing) => (
                        <button
                          key={listing.id}
                          type="button"
                          className="marketplace-owned-row"
                          onClick={() => openBrowseListing(listing)}
                        >
                          <div className="marketplace-owned-preview">
                            {listing.video_url ? (
                              <video src={listing.video_url} muted playsInline preload="metadata" />
                            ) : listing.image_url ? (
                              <img src={listing.image_url} alt={listing.title} loading="lazy" />
                            ) : (
                              <div className="library-preview-empty">No preview</div>
                            )}
                          </div>
                          <div className="marketplace-owned-copy">
                            <strong>{listing.title}</strong>
                            <span>{listing.price_credits.toFixed(1)} credits</span>
                            <span>{formatTimestamp(listing.created_at)}</span>
                          </div>
                          <span className={`marketplace-status-badge status-${listing.status}`}>
                            {listing.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {galleryView === "purchases" && (
                <div className="chart-section marketplace-panel">
                  <div className="chart-header">
                    <h3 className="chart-title">Purchases</h3>
                  </div>
                    {!activeWallet && (
                      <p className="job-hint">Connect a wallet or configure `NEXT_PUBLIC_HAVNAI_WALLET` to view purchases.</p>
                    )}
                  {activeWallet && purchasesLoading && <p className="library-loading">Loading purchases...</p>}
                  {activeWallet && purchasesError && <p className="job-hint error">{purchasesError}</p>}
                  {activeWallet && !purchasesLoading && purchases.length === 0 && (
                    <div className="library-empty">
                      <p>No purchases yet.</p>
                    </div>
                  )}
                  {activeWallet && !purchasesLoading && purchases.length > 0 && (
                    <div className="marketplace-owned-list">
                      {purchases.map((purchase) => (
                        <button
                          key={`${purchase.listing_id}-${purchase.created_at}`}
                          type="button"
                          className="marketplace-owned-row"
                          onClick={() => openPurchaseListing(purchase)}
                        >
                          <div className="marketplace-owned-preview">
                            {purchase.video_url ? (
                              <video src={purchase.video_url} muted playsInline preload="metadata" />
                            ) : purchase.image_url ? (
                              <img src={purchase.image_url} alt={purchase.title} loading="lazy" />
                            ) : (
                              <div className="library-preview-empty">No preview</div>
                            )}
                          </div>
                          <div className="marketplace-owned-copy">
                            <strong>{purchase.title}</strong>
                            <span>Seller: {formatWallet(purchase.seller_wallet)}</span>
                            <span>Paid: {purchase.price_paid.toFixed(1)} credits</span>
                            <span>{formatTimestamp(purchase.created_at)}</span>
                          </div>
                          <span className="marketplace-status-badge status-sold">purchased</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "workflows" && (
            <>
              <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
                <div className="library-filters">
                  <div className="library-filter-group">
                    <span className="library-filter-label">View</span>
                    <button
                      type="button"
                      className={`library-chip ${workflowView === "browse" ? "is-active" : ""}`}
                      onClick={() => setWorkflowView("browse")}
                    >
                      Browse
                    </button>
                    <button
                      type="button"
                      className={`library-chip ${workflowView === "create" ? "is-active" : ""}`}
                      onClick={() => setWorkflowView("create")}
                    >
                      Create Workflow
                    </button>
                  </div>
                </div>
              </div>

              {workflowView === "browse" && (
                <>
                  <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
                    <div className="library-search-wrapper">
                      <input
                        type="text"
                        className="library-search"
                        placeholder="Search workflows..."
                        value={workflowSearch}
                        onChange={(event) => {
                          setWorkflowSearch(event.target.value);
                          setWorkflowPage(0);
                        }}
                      />
                    </div>
                    <div className="library-filters">
                      <div className="library-filter-group" style={{ flexWrap: "wrap" }}>
                        <span className="library-filter-label">Category</span>
                        {WORKFLOW_CATEGORIES.map((category) => (
                          <button
                            key={category}
                            type="button"
                            className={`library-chip ${workflowCategory === category ? "is-active" : ""}`}
                            onClick={() => {
                              setWorkflowCategory(category);
                              setWorkflowPage(0);
                            }}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {workflowLoading && <p className="library-loading">Loading workflows...</p>}
                  {!workflowLoading && workflows.length === 0 && (
                    <div className="library-empty">
                      <p>No published workflows found.</p>
                    </div>
                  )}
                  {!workflowLoading && workflows.length > 0 && (
                    <>
                      <div className="marketplace-grid">
                        {workflows.map((workflow) => (
                          <div
                            key={workflow.id}
                            className="workflow-card"
                            onClick={() => setSelectedWorkflow(workflow)}
                          >
                            <div className="workflow-name">{workflow.name}</div>
                            <div className="workflow-desc">{workflow.description || "No description"}</div>
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {workflow.category && <span className="workflow-tag">{workflow.category}</span>}
                              {workflow.config?.model && <span className="workflow-tag">{workflow.config.model}</span>}
                            </div>
                            <div className="workflow-meta">
                              <span>{workflow.usage_count} uses</span>
                              <span>{new Date(workflow.created_at).toLocaleDateString()}</span>
                              <span style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
                                {formatWallet(workflow.creator_wallet)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {workflowTotalPages > 1 && (
                        <div className="marketplace-pagination">
                          <button
                            type="button"
                            className="library-chip"
                            disabled={workflowPage === 0}
                            onClick={() => setWorkflowPage((page) => Math.max(0, page - 1))}
                          >
                            Prev
                          </button>
                          <span>
                            {workflowPage + 1} / {workflowTotalPages}
                          </span>
                          <button
                            type="button"
                            className="library-chip"
                            disabled={workflowPage >= workflowTotalPages - 1}
                            onClick={() => setWorkflowPage((page) => page + 1)}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {workflowView === "create" && (
                <div className="chart-section marketplace-panel">
                  <div className="chart-header">
                    <h3 className="chart-title">Create a Workflow</h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                    <label>
                      <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Name</span>
                      <input
                        type="text"
                        className="library-search"
                        value={formName}
                        onChange={(event) => setFormName(event.target.value)}
                        placeholder="My Awesome Workflow"
                      />
                    </label>
                    <label>
                      <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Description</span>
                      <textarea
                        className="library-search"
                        value={formDesc}
                        onChange={(event) => setFormDesc(event.target.value)}
                        placeholder="What does this workflow do?"
                        style={{ minHeight: "60px", resize: "vertical" }}
                      />
                    </label>
                    <label>
                      <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Category</span>
                      <select
                        className="library-sort-select"
                        value={formCategory}
                        onChange={(event) => setFormCategory(event.target.value)}
                      >
                        {WORKFLOW_CATEGORIES.filter((item) => item !== "All").map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Model</span>
                      <input
                        type="text"
                        className="library-search"
                        value={formModel}
                        onChange={(event) => setFormModel(event.target.value)}
                        placeholder="auto"
                      />
                    </label>
                    <label>
                      <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Prompt Template</span>
                      <textarea
                        className="library-search"
                        value={formPrompt}
                        onChange={(event) => setFormPrompt(event.target.value)}
                        placeholder="A cinematic portrait of {subject}"
                        style={{ minHeight: "80px", resize: "vertical" }}
                      />
                    </label>
                    <label>
                      <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Negative Prompt</span>
                      <textarea
                        className="library-search"
                        value={formNeg}
                        onChange={(event) => setFormNeg(event.target.value)}
                        placeholder="blurry, low quality"
                        style={{ minHeight: "50px", resize: "vertical" }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <label style={{ flex: 1 }}>
                        <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Steps</span>
                        <input
                          type="number"
                          className="library-search"
                          value={formSteps}
                          onChange={(event) => setFormSteps(Number(event.target.value))}
                          min={1}
                          max={100}
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Guidance</span>
                        <input
                          type="number"
                          className="library-search"
                          value={formGuidance}
                          onChange={(event) => setFormGuidance(Number(event.target.value))}
                          min={1}
                          max={30}
                          step={0.5}
                        />
                      </label>
                    </div>
                    {workflowCreateError && <p className="job-hint error">{workflowCreateError}</p>}
                    {workflowCreateSuccess && (
                      <p className="job-hint" style={{ color: "#8ff0b6" }}>
                        {workflowCreateSuccess}
                      </p>
                    )}
                    <button
                      type="button"
                      className="job-action-button"
                      disabled={workflowCreating}
                      onClick={handleCreateWorkflow}
                      style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
                    >
                      {workflowCreating ? "Creating..." : "Create Workflow"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {selectedListing && (
            <div className="job-drawer" onClick={closeListingDrawer}>
              <div className="job-drawer-backdrop" />
              <aside
                className="job-drawer-panel"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="job-drawer-header">
                  <div>
                    <p className="job-drawer-kicker">Gallery Listing</p>
                    <h3>{selectedListing.title}</h3>
                    <div className="job-meta-row">
                      <span className={`marketplace-status-badge status-${selectedListing.status}`}>
                        {selectedListing.status}
                      </span>
                      <span>{selectedListing.price_credits.toFixed(1)} credits</span>
                    </div>
                  </div>
                  <button type="button" className="job-drawer-close" onClick={closeListingDrawer}>
                    Close
                  </button>
                </div>
                <div className="job-drawer-body">
                  <section className="job-section">
                    <h4>Preview</h4>
                    <div className="job-preview">
                      {selectedListing.video_url ? (
                        <video src={selectedListing.video_url} controls playsInline />
                      ) : selectedListing.image_url ? (
                        <img src={selectedListing.image_url} alt={selectedListing.title} />
                      ) : (
                        <div className="job-preview-empty">Preview not available</div>
                      )}
                    </div>
                  </section>
                  <section className="job-section">
                    <h4>Description</h4>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedListing.description || "No description provided."}
                    </p>
                  </section>
                  <section className="job-section">
                    <h4>Details</h4>
                    <div className="job-details-grid">
                      <div><span className="job-label">seller</span><span>{selectedListing.seller_wallet}</span></div>
                      <div><span className="job-label">job_id</span><span>{selectedListing.job_id}</span></div>
                      <div><span className="job-label">asset_type</span><span>{selectedListing.asset_type}</span></div>
                      <div><span className="job-label">created</span><span>{formatTimestamp(selectedListing.created_at)}</span></div>
                      <div><span className="job-label">model</span><span>{selectedListing.model || "--"}</span></div>
                      <div><span className="job-label">category</span><span>{selectedListing.category || "--"}</span></div>
                    </div>
                  </section>
                  {selectedListing.prompt && (
                    <section className="job-section">
                      <h4>Prompt</h4>
                      <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {selectedListing.prompt}
                      </p>
                    </section>
                  )}
                  <section className="job-section">
                    <div className="job-actions">
                      <button
                        type="button"
                        className="job-action-button"
                        disabled={galleryPrimaryActionDisabled || galleryActionLoading}
                        onClick={handlePurchase}
                      >
                        {galleryActionLoading ? "Processing..." : galleryPrimaryActionLabel}
                      </button>
                      {userOwnsSelectedListing && selectedListing.status === "active" && !selectedListingReadonly && (
                        <button
                          type="button"
                          className="job-action-button secondary"
                          disabled={galleryActionLoading}
                          onClick={handleDelist}
                        >
                          Delist
                        </button>
                      )}
                      {galleryActionError && galleryActionError.toLowerCase().includes("credits") && (
                        <a
                          href="/pricing"
                          className="job-action-button secondary"
                          style={{ textDecoration: "none" }}
                        >
                          Buy Credits
                        </a>
                      )}
                    </div>
                    {!connectedWallet && (
                      <p className="job-hint">
                        Connect MetaMask to sign gallery purchases. Fallback env wallets can browse but cannot sign buys.
                      </p>
                    )}
                    {galleryActionError && <p className="job-hint error">{galleryActionError}</p>}
                  </section>
                </div>
              </aside>
            </div>
          )}

          {selectedWorkflow && (
            <div className="job-drawer" onClick={() => setSelectedWorkflow(null)}>
              <div className="job-drawer-backdrop" />
              <aside
                className="job-drawer-panel"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="job-drawer-header">
                  <div>
                    <p className="job-drawer-kicker">Workflow</p>
                    <h3>{selectedWorkflow.name}</h3>
                    <div className="job-meta-row">
                      {selectedWorkflow.category && <span className="workflow-tag">{selectedWorkflow.category}</span>}
                      <span>{selectedWorkflow.usage_count} uses</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="job-drawer-close"
                    onClick={() => setSelectedWorkflow(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="job-drawer-body">
                  <section className="job-section">
                    <h4>Description</h4>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedWorkflow.description || "No description provided."}
                    </p>
                  </section>
                  <section className="job-section">
                    <h4>Configuration</h4>
                    <div className="job-details-grid">
                      {selectedWorkflow.config?.model && (
                        <div><span className="job-label">Model</span><span>{selectedWorkflow.config.model}</span></div>
                      )}
                      {selectedWorkflow.config?.steps && (
                        <div><span className="job-label">Steps</span><span>{selectedWorkflow.config.steps}</span></div>
                      )}
                      {selectedWorkflow.config?.guidance && (
                        <div><span className="job-label">Guidance</span><span>{selectedWorkflow.config.guidance}</span></div>
                      )}
                    </div>
                  </section>
                  {selectedWorkflow.config?.prompt_template && (
                    <section className="job-section">
                      <h4>Prompt Template</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                        {selectedWorkflow.config.prompt_template}
                      </p>
                    </section>
                  )}
                  <section className="job-section">
                    <h4>Creator</h4>
                    <p className="wallet-address">{selectedWorkflow.creator_wallet}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.3rem" }}>
                      Created {new Date(selectedWorkflow.created_at).toLocaleDateString()}
                    </p>
                  </section>
                  <section className="job-section">
                    <div className="job-actions">
                      <a
                        href={`/test?workflow=${selectedWorkflow.id}`}
                        className="job-action-button"
                        style={{ textDecoration: "none", textAlign: "center" }}
                      >
                        Use This Workflow
                      </a>
                    </div>
                  </section>
                </div>
              </aside>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default MarketplacePage;
