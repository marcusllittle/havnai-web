import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../components/WalletProvider";
import { SiteHeader } from "../components/SiteHeader";
import { getApiBase } from "../lib/apiBase";
import {
  createWorkflow,
  fetchCredits,
  fetchGalleryBrowse,
  fetchGalleryCollection,
  fetchGalleryPurchases,
  fetchMarketplace,
  fetchMyGalleryListings,
  fetchOwnershipHistory,
  GalleryListing,
  GalleryOwnershipEvent,
  GalleryPurchaseRecord,
  HavnaiApiError,
  delistGalleryListing,
  getGalleryDownloadUrl,
  purchaseGalleryListing,
  relistGalleryAsset,
  Workflow,
} from "../lib/havnai";
import { downloadAsset } from "../lib/download";
import { getConnectButtonLabel, isUsableWallet } from "../lib/wallet";
import { getWalletIdentityLabel, getWalletSourceLabel, getWalletStatusCopy, PUBLIC_ALPHA_LABEL } from "../lib/publicAlpha";

type MarketplaceTab = "gallery" | "workflows";
type GalleryView = "browse" | "my-listings" | "collection";
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

function formatListingModel(listing: Pick<GalleryListing, "model" | "model_tier">): string {
  const model = String(listing?.model || "").trim();
  if (!model) return "--";
  const tier = String(listing?.model_tier || "").trim().toUpperCase();
  if (!tier) return model;
  return `${model} · Tier ${tier}`;
}

function purchaseToListing(purchase: GalleryPurchaseRecord): GalleryListing {
  return {
    id: purchase.listing_id,
    job_id: purchase.job_id,
    seller_wallet: purchase.seller_wallet,
    owner_wallet: purchase.buyer_wallet,
    title: purchase.title,
    description: "",
    price_credits: purchase.price_paid,
    category: undefined,
    asset_type: purchase.asset_type,
    model: purchase.model,
    model_key: purchase.model_key,
    model_tier: purchase.model_tier,
    model_reward_weight: purchase.model_reward_weight,
    model_credit_cost: purchase.model_credit_cost,
    model_pipeline: purchase.model_pipeline,
    model_task_type: purchase.model_task_type,
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
  const apiBase = getApiBase();

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

  const [collection, setCollection] = useState<GalleryListing[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const [selectedListing, setSelectedListing] = useState<GalleryListing | null>(null);
  const [selectedListingReadonly, setSelectedListingReadonly] = useState(false);
  const [ownershipHistory, setOwnershipHistory] = useState<GalleryOwnershipEvent[]>([]);
  const [relistModalOpen, setRelistModalOpen] = useState(false);
  const [relistPrice, setRelistPrice] = useState("");
  const [relistTitle, setRelistTitle] = useState("");
  const [relistDescription, setRelistDescription] = useState("");
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
  const walletSourceLabel = getWalletSourceLabel(wallet.source);
  const walletIdentityLabel = getWalletIdentityLabel(wallet);
  const walletStatusCopy = getWalletStatusCopy(wallet, "marketplace");
  const connectLabel = getConnectButtonLabel(wallet);
  const galleryTotalPages = Math.max(1, Math.ceil(galleryTotal / galleryLimit));
  const workflowTotalPages = Math.max(1, Math.ceil(workflowTotal / workflowLimit));

  useEffect(() => {
    if (!router.isReady) return;
    const rawTab = typeof router.query.tab === "string" ? router.query.tab : "gallery";
    const rawGalleryView =
      typeof router.query.galleryView === "string" ? router.query.galleryView : "browse";

    setTab(rawTab === "workflows" ? "workflows" : "gallery");
    if (rawGalleryView === "my-listings" || rawGalleryView === "collection") {
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
      setCollection([]);
      setCollectionError(null);
      return () => {
        active = false;
      };
    }
    const loadCollection = async () => {
      setCollectionLoading(true);
      setCollectionError(null);
      try {
        const items = await fetchGalleryCollection(activeWallet);
        if (active) setCollection(items);
      } catch (err: any) {
        if (active) {
          setCollection([]);
          setCollectionError(err?.message || "Failed to load collection.");
        }
      } finally {
        if (active) setCollectionLoading(false);
      }
    };
    loadCollection();
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
        `Workflow "${workflow.name}" saved. Shared workflow publishing is still limited in the Public Alpha web UI.`
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
    setOwnershipHistory([]);
    setRelistModalOpen(false);
    if (listing.job_id) {
      fetchOwnershipHistory(listing.job_id)
        .then(setOwnershipHistory)
        .catch(() => setOwnershipHistory([]));
    }
  };

  const openCollectionListing = (listing: GalleryListing) => {
    setSelectedListing(listing);
    setSelectedListingReadonly(true);
    setGalleryActionError(null);
    setGalleryActionSuccess(null);
    setOwnershipHistory([]);
    setRelistModalOpen(false);
    if (listing.job_id) {
      fetchOwnershipHistory(listing.job_id)
        .then(setOwnershipHistory)
        .catch(() => setOwnershipHistory([]));
    }
  };

  const closeListingDrawer = () => {
    setSelectedListing(null);
    setSelectedListingReadonly(false);
    setGalleryActionError(null);
    setOwnershipHistory([]);
    setRelistModalOpen(false);
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

  const handleRelist = async () => {
    if (!selectedListing || !connectedWallet || !isUsableWallet(connectedWallet)) return;
    const price = parseFloat(relistPrice);
    if (!price || price <= 0) {
      setGalleryActionError("Price must be greater than 0.");
      return;
    }
    setGalleryActionLoading(true);
    setGalleryActionError(null);
    setGalleryActionSuccess(null);
    try {
      await relistGalleryAsset({
        wallet: connectedWallet,
        job_id: selectedListing.job_id,
        title: relistTitle.trim() || selectedListing.title,
        description: relistDescription.trim(),
        price_credits: price,
      });
      setGalleryActionSuccess("Asset re-listed on marketplace.");
      setGalleryRefreshKey((value) => value + 1);
      setRelistModalOpen(false);
      closeListingDrawer();
    } catch (err: any) {
      const message =
        err instanceof HavnaiApiError
          ? err.message
          : typeof err?.message === "string"
          ? err.message
          : "Re-listing failed.";
      setGalleryActionError(message);
    } finally {
      setGalleryActionLoading(false);
    }
  };

  const userOwnsSelectedListing =
    selectedListing && activeWallet
      ? (selectedListing.owner_wallet || selectedListing.seller_wallet).toLowerCase() === activeWallet.toLowerCase()
      : false;

  const userIsCurrentOwner =
    selectedListing && activeWallet
      ? (selectedListing.owner_wallet || "").toLowerCase() === activeWallet.toLowerCase()
      : false;

  const galleryPrimaryActionDisabled =
    !selectedListing ||
    (selectedListingReadonly && !userIsCurrentOwner) ||
    !connectedWallet ||
    userOwnsSelectedListing ||
    selectedListing.status !== "active";

  const galleryPrimaryActionLabel = !selectedListing
    ? "Unavailable"
    : userIsCurrentOwner && selectedListing.status !== "active"
    ? "Owned"
    : !connectedWallet
    ? "Connect wallet to buy"
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

      <SiteHeader />

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Marketplace</p>
            <h1 className="hero-title">Gallery and workflows</h1>
            <p className="hero-subtitle">
              The {PUBLIC_ALPHA_LABEL.toLowerCase()} marketplace for generated assets with exclusive ownership transfer, collectible outputs, and reusable workflows.
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
                  <div className="marketplace-wallet-label">Active identity</div>
                  <div className="marketplace-wallet-value">
                    {walletIdentityLabel}
                  </div>
                  <p className="wallet-status-note">{walletStatusCopy}</p>
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
                  {wallet.source === "none" && (
                    <span className="marketplace-wallet-note">
                      Gallery browsing is open without a wallet. Buying and new listing actions require wallet approval.
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
                  className={`library-chip ${galleryView === "collection" ? "is-active" : ""}`}
                  onClick={() => activeWallet && setGalleryView("collection")}
                  disabled={!activeWallet}
                >
                  My Collection
                </button>
              </div>
              {!activeWallet && (
                <p className="job-hint" style={{ marginTop: "-0.35rem", marginBottom: "1rem" }}>
                  Connect your wallet to unlock My Listings and My Collection. Public browsing stays open without a wallet.
                </p>
              )}

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
                      <p>No gallery listings are live yet. Published Public Alpha creations will appear here as creators list work from Generator or My Library.</p>
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
                                {listing.model && <span>{formatListingModel(listing)}</span>}
                              </div>
                              <div className="marketplace-gallery-footer">
                                <span>{formatWallet(listing.owner_wallet || listing.seller_wallet)}</span>
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
                      <p className="job-hint">Connect your wallet to view wallet-linked listings. Guest sessions can browse the public gallery only.</p>
                    )}
                  {activeWallet && myListingsLoading && <p className="library-loading">Loading your listings...</p>}
                  {activeWallet && myListingsError && <p className="job-hint error">{myListingsError}</p>}
                  {activeWallet && !myListingsLoading && myListings.length === 0 && (
                    <div className="library-empty">
                      <p>No active listings yet. Publish a finished result from Generator or My Library to start your storefront.</p>
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

              {galleryView === "collection" && (
                <div className="chart-section marketplace-panel">
                  <div className="chart-header">
                    <h3 className="chart-title">My Collection</h3>
                  </div>
                    {!activeWallet && (
                      <p className="job-hint">Connect your wallet to view your owned assets. Purchased items transfer exclusive ownership to you.</p>
                    )}
                  {activeWallet && collectionLoading && <p className="library-loading">Loading collection...</p>}
                  {activeWallet && collectionError && <p className="job-hint error">{collectionError}</p>}
                  {activeWallet && !collectionLoading && collection.length === 0 && (
                    <div className="library-empty">
                      <p>No assets owned yet. When you buy a gallery piece, exclusive ownership transfers to you and it appears here.</p>
                    </div>
                  )}
                  {activeWallet && !collectionLoading && collection.length > 0 && (
                    <div className="marketplace-owned-list">
                      {collection.map((asset) => {
                        const isListed = asset.listed && !asset.sold;
                        return (
                          <button
                            key={`${asset.id}-${asset.job_id}`}
                            type="button"
                            className="marketplace-owned-row"
                            onClick={() => openCollectionListing(asset)}
                          >
                            <div className="marketplace-owned-preview">
                              {asset.video_url ? (
                                <video src={asset.video_url} muted playsInline preload="metadata" />
                              ) : asset.image_url ? (
                                <img src={asset.image_url} alt={asset.title} loading="lazy" />
                              ) : (
                                <div className="library-preview-empty">No preview</div>
                              )}
                            </div>
                            <div className="marketplace-owned-copy">
                              <strong>{asset.title}</strong>
                              <span>{formatListingModel(asset)}</span>
                              <span>{formatTimestamp(asset.created_at)}</span>
                            </div>
                            <span className={`marketplace-status-badge ${isListed ? "status-active" : "status-sold"}`}>
                              {isListed ? "listed" : "owned"}
                            </span>
                          </button>
                        );
                      })}
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
                      <p>Shared workflows are still early in Public Alpha. Check back as the catalog grows, or save your own reusable workflow below.</p>
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
                  <p className="job-hint" style={{ marginTop: 0 }}>
                    Save a reusable setup for your own account now. Shared workflow publishing is still limited in the Public Alpha web UI.
                  </p>
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
                        placeholder="Optional model slug"
                      />
                    </label>
                    <p className="job-hint" style={{ marginTop: "-0.1rem" }}>
                      Leave the model field blank if you want routing to choose from compatible live capacity.
                    </p>
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
                        <div className="job-preview-empty">Preview unavailable</div>
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
                      <div><span className="job-label">Owner</span><span>{selectedListing.owner_wallet || selectedListing.seller_wallet}</span></div>
                      <div><span className="job-label">Creator</span><span>{selectedListing.seller_wallet}</span></div>
                      <div><span className="job-label">Asset type</span><span>{selectedListing.asset_type}</span></div>
                      <div><span className="job-label">Created</span><span>{formatTimestamp(selectedListing.created_at)}</span></div>
                      <div><span className="job-label">Model</span><span>{formatListingModel(selectedListing)}</span></div>
                      <div><span className="job-label">Category</span><span>{selectedListing.category || "--"}</span></div>
                    </div>
                  </section>
                  {selectedListing.prompt && userIsCurrentOwner && (
                    <section className="job-section">
                      <h4>Prompt</h4>
                      <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {selectedListing.prompt}
                      </p>
                    </section>
                  )}
                  {!userIsCurrentOwner && (
                    <section className="job-section">
                      <p className="job-hint" style={{ margin: 0, fontStyle: "italic" }}>
                        Prompt is only visible to the current owner.
                      </p>
                    </section>
                  )}
                  {ownershipHistory.length > 0 && (
                    <section className="job-section">
                      <h4>Provenance</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {ownershipHistory.map((event, idx) => (
                          <div key={event.id || idx} style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--text-default)" }}>
                              {event.event_type}
                            </span>
                            {event.event_type === "mint" && (
                              <span> — Created by {formatWallet(event.to_wallet)}</span>
                            )}
                            {event.event_type === "sale" && (
                              <span> — {formatWallet(event.from_wallet)} → {formatWallet(event.to_wallet)} for {event.price_credits.toFixed(1)} credits</span>
                            )}
                            {event.event_type === "relist" && (
                              <span> — Re-listed by {formatWallet(event.to_wallet)} at {event.price_credits.toFixed(1)} credits</span>
                            )}
                            <span style={{ marginLeft: "0.5rem", opacity: 0.6 }}>{formatTimestamp(event.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="job-section">
                    <div className="job-actions">
                      {selectedListing.status === "active" && !userOwnsSelectedListing && (
                        <button
                          type="button"
                          className="job-action-button"
                          disabled={galleryPrimaryActionDisabled || galleryActionLoading}
                          onClick={handlePurchase}
                        >
                          {galleryActionLoading ? "Processing..." : galleryPrimaryActionLabel}
                        </button>
                      )}
                      {userIsCurrentOwner && selectedListing.status === "active" && (
                        <button
                          type="button"
                          className="job-action-button secondary"
                          disabled={galleryActionLoading}
                          onClick={handleDelist}
                        >
                          Delist
                        </button>
                      )}
                      {userIsCurrentOwner && !selectedListing.listed && (
                        <button
                          type="button"
                          className="job-action-button"
                          disabled={galleryActionLoading}
                          onClick={() => {
                            setRelistTitle(selectedListing.title);
                            setRelistDescription(selectedListing.description || "");
                            setRelistPrice("");
                            setRelistModalOpen(true);
                          }}
                        >
                          Re-list on Marketplace
                        </button>
                      )}
                      {userIsCurrentOwner && (
                        <button
                          type="button"
                          className="job-action-button secondary"
                          onClick={() => {
                            const url = getGalleryDownloadUrl(selectedListing.id, activeWallet || "");
                            downloadAsset(url, `havnai-${selectedListing.job_id.slice(0, 8)}.${selectedListing.asset_type === "video" ? "mp4" : "png"}`);
                          }}
                        >
                          &#x2913; Download
                        </button>
                      )}
                      {userIsCurrentOwner && selectedListing.status !== "active" && !relistModalOpen && (
                        <span className="marketplace-status-badge status-sold" style={{ padding: "0.4rem 0.8rem" }}>
                          Owned by you
                        </span>
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
                    {relistModalOpen && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.8rem" }}>
                        <label>
                          <span className="library-filter-label" style={{ display: "block", marginBottom: "0.2rem" }}>Title</span>
                          <input
                            type="text"
                            className="library-search"
                            value={relistTitle}
                            onChange={(event) => setRelistTitle(event.target.value)}
                            placeholder="Listing title"
                          />
                        </label>
                        <label>
                          <span className="library-filter-label" style={{ display: "block", marginBottom: "0.2rem" }}>Description</span>
                          <textarea
                            className="library-search"
                            value={relistDescription}
                            onChange={(event) => setRelistDescription(event.target.value)}
                            placeholder="Optional description"
                            style={{ minHeight: "50px", resize: "vertical" }}
                          />
                        </label>
                        <label>
                          <span className="library-filter-label" style={{ display: "block", marginBottom: "0.2rem" }}>Price (credits)</span>
                          <input
                            type="number"
                            className="library-search"
                            value={relistPrice}
                            onChange={(event) => setRelistPrice(event.target.value)}
                            placeholder="e.g. 50"
                            min={0.1}
                            step={0.1}
                          />
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="job-action-button"
                            disabled={galleryActionLoading}
                            onClick={handleRelist}
                          >
                            {galleryActionLoading ? "Processing..." : "Publish Re-listing"}
                          </button>
                          <button
                            type="button"
                            className="job-action-button secondary"
                            onClick={() => setRelistModalOpen(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!connectedWallet && (
                      <p className="job-hint">
                        Connect your wallet to interact. Buying transfers exclusive ownership to you.
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
                        href={`/generator?workflow=${selectedWorkflow.id}`}
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
