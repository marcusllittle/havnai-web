import type { NextPage } from "next";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ChevronDown, Download, FolderOpen, Images, LoaderCircle, MoreHorizontal, Plus, RefreshCw, Search, SlidersHorizontal, Wallet, X } from "lucide-react";
import { CollectionPreview } from "../components/CollectionPreview";
import { SeoHead } from "../components/SeoHead";
import { useWallet } from "../components/WalletProvider";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import { SiteHeader } from "../components/SiteHeader";
import { downloadAsset } from "../lib/download";
import {
  fetchJob,
  fetchMyJobs,
  fetchResult,
  createGalleryListingWithMetaMask,
  formatApiError,
  JobDetailResponse,
  resolveAssetUrl,
  ResultResponse,
} from "../lib/havnai";
import {
  loadLibrary,
  mergeServerJobs,
  removeFromLibrary,
  bulkRemoveFromLibrary,
  LibraryEntry,
  LibraryItemType,
} from "../lib/libraryStore";
import { normalizeJobStatus } from "../lib/jobStatus";
import { getConnectButtonLabel } from "../lib/wallet";
import { getWalletIdentityLabel, getWalletSourceLabel, getWalletStatusCopy } from "../lib/publicAlpha";

type StatusFilter = "all" | "ready" | "running" | "failed";
type TypeFilter = "all" | "image" | "video";
type SortOption = "newest" | "oldest";

type LibraryViewItem = {
  entry: LibraryEntry;
  job?: JobDetailResponse | null;
  result?: ResultResponse | null;
  previewUrl?: string;
  statusLabel: string;
  statusClass: string;
  type: LibraryItemType;
  available: boolean;
  model?: string;
  prompt?: string;
};

const CONCURRENCY_LIMIT = 5;

async function buildViewItem(entry: LibraryEntry, signal?: AbortSignal): Promise<LibraryViewItem> {
  let job: JobDetailResponse | null = null;
  let result: ResultResponse | null = null;
  let available = false;
  let statusLabel = "Unknown";
  let statusClass = "unknown";
  let model: string | undefined;
  let prompt: string | undefined;

  const [jobResponse, resultResponse] = await Promise.allSettled([
    fetchJob(entry.job_id, { signal }),
    fetchResult(entry.job_id, { signal }),
  ]);

  try {
    if (jobResponse.status === "rejected") throw jobResponse.reason;
    job = jobResponse.value;
    const normalized = normalizeJobStatus(job.status);
    statusLabel = normalized.isFailed
      ? "Failed"
      : normalized.pill === "Ready"
      ? "Ready"
      : normalized.label;
    if (normalized.isFailed) {
      statusClass = "failed";
    } else if (normalized.pill === "Ready") {
      statusClass = "ready";
    } else {
      statusClass = "running";
    }
    model = job.model;
    if (job.data) {
      const data = typeof job.data === "string" ? JSON.parse(job.data) : job.data;
      prompt = data?.prompt;
    }
  } catch {
    job = null;
  }

  try {
    if (resultResponse.status === "rejected") throw resultResponse.reason;
    result = resultResponse.value;
    if (result.image_url || result.video_url) {
      available = true;
      if (!job) {
        statusLabel = "Ready";
        statusClass = "ready";
      }
    }
  } catch {
    result = null;
  }

  if (!job && !result) {
    statusLabel = "Unavailable";
    statusClass = "unavailable";
  }

  const previewUrl = resolveAssetUrl(
    result?.video_url || result?.image_url || entry.preview_hint
  );
  let type: LibraryItemType = entry.type || "unknown";
  if (result?.video_url) type = "video";
  else if (result?.image_url) type = "image";

  return {
    entry,
    job,
    result,
    previewUrl,
    statusLabel,
    statusClass,
    type,
    available,
    model,
    prompt,
  };
}

async function fetchLibraryDetails(
  entries: LibraryEntry[],
  signal: AbortSignal,
  onItem: (item: LibraryViewItem) => void
): Promise<void> {
  let index = 0;

  const worker = async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= entries.length || signal.aborted) break;
      onItem(await buildViewItem(entries[current], signal));
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, entries.length) },
    () => worker()
  );
  await Promise.all(workers);
}

const LibraryPage: NextPage = () => {
  const wallet = useWallet();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [items, setItems] = useState<LibraryViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [refreshRevision, setRefreshRevision] = useState(0);

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerJob, setDrawerJob] = useState<JobDetailResponse | null>(null);
  const [drawerResult, setDrawerResult] = useState<ResultResponse | null>(null);
  const [drawerSummary, setDrawerSummary] = useState<JobSummary | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | undefined>();
  const connectLabel = getConnectButtonLabel(wallet);
  const walletSourceLabel = getWalletSourceLabel(wallet.source);
  const walletIdentityLabel = getWalletIdentityLabel(wallet);
  const walletStatusCopy = getWalletStatusCopy(wallet, "library");

  // Sell listing state
  const [sellItem, setSellItem] = useState<LibraryViewItem | null>(null);
  const [sellTitle, setSellTitle] = useState("");
  const [sellPrice, setSellPrice] = useState("1");
  const [sellDesc, setSellDesc] = useState("");
  const [sellCategory, setSellCategory] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellMsg, setSellMsg] = useState("");
  const [sellErr, setSellErr] = useState("");
  const [sellProgress, setSellProgress] = useState("");

  const openSellForm = (item: LibraryViewItem) => {
    setSellItem(item);
    setSellTitle(item.prompt ? item.prompt.slice(0, 60) : `Generation #${item.entry.job_id.slice(0, 8)}`);
    setSellPrice("1");
    setSellDesc("");
    setSellCategory("");
    setSellMsg("");
    setSellErr("");
    setSellProgress("");
  };

  const handleSell = async () => {
    if (!sellItem) return;
    const price = parseFloat(sellPrice);
    if (!price || price <= 0) { setSellErr("Enter a price above 0 credits."); return; }
    setSellLoading(true);
    setSellProgress("Preparing listing signature...");
    setSellErr("");
    try {
      await createGalleryListingWithMetaMask(
        {
          wallet: wallet.activeWallet || undefined,
          job_id: sellItem.entry.job_id,
          title: sellTitle.trim() || `Generation #${sellItem.entry.job_id.slice(0, 8)}`,
          price_credits: price,
          description: sellDesc.trim(),
          category: sellCategory.trim(),
        },
        {
          onProgress: (step) => {
            if (step === "resolving_wallet") setSellProgress("Resolving wallet connection...");
            else if (step === "requesting_nonce") setSellProgress("Preparing secure listing request...");
            else if (step === "awaiting_signature") setSellProgress("Waiting for wallet approval...");
            else if (step === "submitting_listing") setSellProgress("Publishing listing to the marketplace...");
          },
        }
      );
      setSellMsg("Listing is now live in the Public Alpha marketplace.");
      setSellProgress("");
    } catch (err: any) {
      setSellErr(formatApiError(err, "Failed to list."));
    }
    setSellLoading(false);
  };

  // Seed from localStorage immediately so the grid paints without waiting on
  // the network, then reconcile against the wallet's real server-side history.
  // Before this, the Collection was localStorage-only: a cleared browser, a
  // private window, or a second device showed nothing, and generation 201
  // silently evicted the oldest entry.
  useEffect(() => {
    setEntries(loadLibrary());
  }, []);

  const activeWallet = wallet.activeWallet;
  useEffect(() => {
    if (!activeWallet) {
      setSyncing(false);
      setSyncError(false);
      return;
    }
    let active = true;
    setSyncing(true);
    setSyncError(false);
    (async () => {
      try {
        const jobs = await fetchMyJobs(activeWallet, { limit: 500 });
        if (!active) return;
        setEntries(
          mergeServerJobs(
            jobs.map((job) => ({
              job_id: job.job_id,
              created_at: new Date((job.timestamp || 0) * 1000).toISOString(),
              type: job.type,
            }))
          )
        );
      } catch {
        if (active) setSyncError(true);
      } finally {
        if (active) setSyncing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeWallet, refreshRevision]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoading(entries.length > 0);
    setItems(current => {
      const existing = new Map(current.map(item => [item.entry.job_id, item]));
      return entries.map(entry => existing.get(entry.job_id) || {
        entry,
        previewUrl: resolveAssetUrl(entry.preview_hint),
        statusLabel: "Checking",
        statusClass: "checking",
        type: entry.type,
        available: false,
      });
    });
    void fetchLibraryDetails(entries, controller.signal, item => {
      if (active) setItems(current => current.map(previous => previous.entry.job_id === item.entry.job_id ? item : previous));
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) {
        setItems(current => current.map(item => item.statusClass === "checking" ? { ...item, statusLabel: "Unavailable", statusClass: "unavailable" } : item));
        setLoading(false);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [entries, refreshRevision]);

  // Filter + sort logic
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => {
        const jobId = item.entry.job_id.toLowerCase();
        const model = (item.model || "").toLowerCase();
        const prompt = (item.prompt || "").toLowerCase();
        return jobId.includes(q) || model.includes(q) || prompt.includes(q);
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((item) => item.statusClass === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((item) => item.type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.entry.created_at).getTime();
      const dateB = new Date(b.entry.created_at).getTime();
      return sortOption === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [items, searchQuery, statusFilter, typeFilter, sortOption]);

  const emptyState = !loading && !syncing && entries.length === 0;
  const noResults = !loading && entries.length > 0 && filteredItems.length === 0;

  const toggleSelect = useCallback((jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((item) => item.entry.job_id)));
  }, [filteredItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      setTimeout(() => setConfirmBulkDelete(false), 3000);
      return;
    }
    const next = bulkRemoveFromLibrary(selectedIds);
    setEntries(next);
    setSelectedIds(new Set());
    setBulkMode(false);
    setConfirmBulkDelete(false);
  }, [selectedIds, confirmBulkDelete]);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  }, []);

  const openDrawer = async (item: LibraryViewItem) => {
    const completedAt =
      typeof item.job?.completed_at === "number"
        ? new Date(item.job.completed_at * 1000).toISOString()
        : undefined;
    const summary: JobSummary = {
      job_id: item.entry.job_id,
      model: item.job?.model,
      wallet: item.job?.wallet,
      status: item.job?.status,
      task_type: item.job?.task_type,
      submitted_at: item.entry.created_at,
      completed_at: completedAt,
      image_url: item.result?.image_url,
      video_url: item.result?.video_url,
    };
    setDrawerSummary(summary);
    setDrawerJob(item.job || null);
    setDrawerResult(item.result || null);
    setDrawerOpen(true);
    setDrawerLoading(false);
    setDrawerError(item.available ? undefined : "Result not available.");
  };

  const handleRemove = (jobId: string) => {
    const next = removeFromLibrary(jobId);
    setEntries(next);
    setSelectedIds((prev) => {
      const updated = new Set(prev);
      updated.delete(jobId);
      return updated;
    });
  };

  const typeCounts = useMemo(() => {
    const counts = { all: items.length, image: 0, video: 0 };
    for (const item of items) {
      if (item.type === "image") counts.image++;
      else if (item.type === "video") counts.video++;
    }
    return counts;
  }, [items]);

  return (
    <>
      <SeoHead
        title="Collection"
        description="Manage saved outputs, preview owned media, and prepare assets for marketplace flow inside your JoinHavn collection."
        path="/library"
        noindex
      />
      <SiteHeader />

      <main className="collection-page">
        <header className="collection-heading">
          <div>
            <span className="collection-eyebrow"><Images size={14} aria-hidden="true" /> Your creative archive</span>
            <h1>Collection<span>{entries.length}</span></h1>
            <p>A home for the things you make.</p>
          </div>
          <div className="collection-heading-actions">
            <button type="button" className="collection-refresh" onClick={() => setRefreshRevision(value => value + 1)} disabled={loading || syncing} aria-label="Refresh collection"><RefreshCw size={17} aria-hidden="true" /></button>
            <Link href="/create" className="collection-primary"><Plus size={17} aria-hidden="true" /> New creation</Link>
          </div>
        </header>
        <div className="collection-context">
          <details className="collection-account">
            <summary><Wallet size={14} aria-hidden="true" />{walletSourceLabel}<ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="wallet-status-card wallet-status-card-inline">
            <div className="wallet-status-copy-block">
              <div className="wallet-status-heading-row">
                <span className={`wallet-status-pill wallet-source-${wallet.source}`}>{walletSourceLabel}</span>
                {wallet.providerName && <span className="wallet-status-provider">{wallet.providerName}</span>}
              </div>
              <div className="wallet-status-address">
                {walletIdentityLabel}
              </div>
              <p className="wallet-status-note">{walletStatusCopy}</p>
            </div>
            <div className="wallet-status-actions">
              <button
                type="button"
                className="job-action-button secondary"
                onClick={() => { setConnectionError(""); void wallet.connect().catch(reason => setConnectionError(reason instanceof Error ? reason.message : "Wallet connection failed. Please try again.")); }}
                disabled={wallet.connecting}
              >
                {connectLabel}
              </button>
            </div>
          </div>
          </details>
          {connectionError && <p className="collection-sync-note" role="alert">{connectionError}</p>}
          <Link href="/marketplace?tab=gallery&galleryView=my-listings" className="collection-storefront">My storefront <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
        {syncError && <p className="collection-sync-note" role="status">Couldn’t refresh your history. {entries.length ? "Your saved previews are still here." : "You can try again using Refresh collection."}</p>}

        {entries.length > 0 && (
          <section className="library-toolbar">
            <div className="library-toolbar-inner">
              {/* Search */}
              <div className="library-search-wrapper">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search collection"
                  className="library-search"
                  placeholder="Search your creations…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="library-search-clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="collection-filter-row">
                <div className="collection-type-tabs" role="group" aria-label="Media type">
                  {([["all", "All work"], ["image", "Images"], ["video", "Videos"]] as [TypeFilter, string][]).map(([value, label]) => (
                    <button key={value} type="button" className={typeFilter === value ? "is-active" : ""} aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)}>{label}<span>{typeCounts[value]}</span></button>
                  ))}
                </div>
                <div className="collection-filter-options">
                  <label className="collection-select-label"><SlidersHorizontal size={14} aria-hidden="true" /><span className="collection-sr-only">Status</span>
                    <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                      <option value="all">All statuses</option><option value="ready">Ready</option><option value="running">Running</option><option value="failed">Failed</option>
                    </select>
                  </label>
                  <select className="library-sort-select" aria-label="Sort collection" value={sortOption} onChange={event => setSortOption(event.target.value as SortOption)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
                </div>
                {/* Bulk mode toggle */}
                <div className="library-filter-group library-bulk-toggle">
                  {!bulkMode ? (
                    <button
                      type="button"
                      className="library-chip"
                      onClick={() => setBulkMode(true)}
                    >
                      Select
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="library-chip is-active"
                        onClick={selectAll}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="library-chip"
                        onClick={deselectAll}
                      >
                        Deselect all
                      </button>
                      <button
                        type="button"
                        className={`library-chip library-chip-danger ${
                          confirmBulkDelete ? "is-confirm" : ""
                        }`}
                        disabled={selectedIds.size === 0}
                        onClick={handleBulkDelete}
                      >
                        {confirmBulkDelete
                          ? `Remove ${selectedIds.size}?`
                          : `Remove (${selectedIds.size})`}
                      </button>
                      <button
                        type="button"
                        className="library-chip"
                        onClick={exitBulkMode}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Results count */}
              <div className="library-results-count">
                {filteredItems.length} of {items.length} items
                {searchQuery && ` matching "${searchQuery}"`}
              </div>
            </div>
          </section>
        )}

        <section className="library-section">
          {(loading || syncing) && <p className="collection-loading" role="status"><LoaderCircle size={15} aria-hidden="true" /> {entries.length ? "Refreshing your creations…" : "Looking for your saved work…"}</p>}
          {syncing && entries.length === 0 && <div className="collection-skeletons" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div>}
          {emptyState && (
            <div className="collection-empty">
              <div className="collection-empty-art" aria-hidden="true">
                <div><Image src="/create/amber-still-life.webp" alt="" fill sizes="200px" /></div>
                <div><Image src="/create/coastal-light.webp" alt="" fill sizes="260px" /></div>
              </div>
              <div className="collection-empty-copy">
                <span className="collection-eyebrow">Every collection begins with an idea</span>
                <h2>Your next favorite<br />starts here.</h2>
                <p>{syncError ? "Nothing is saved in this browser yet. Refresh to check your full history, or start something new." : "Create an image or a video. Your saved work will be waiting here, ready to revisit, download, or share."}</p>
                <Link href="/create" className="collection-primary">Make your first creation <ArrowUpRight size={16} aria-hidden="true" /></Link>
                <span className="collection-empty-caption">Inspiration imagery · your collection is empty</span>
              </div>
            </div>
          )}
          {noResults && (
            <div className="library-empty">
              <FolderOpen size={28} aria-hidden="true" /><h2>No matches this time.</h2><p>Try another search or clear your filters to see all your work.</p>
              <button
                type="button"
                className="job-action-button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {filteredItems.length > 0 && (
            <div className="library-grid">
              {filteredItems.map((item) => {
                const downloadUrl = resolveAssetUrl(
                  item.result?.video_url ||
                    item.result?.image_url ||
                    item.entry.preview_hint
                );
                const created = new Date(item.entry.created_at);
                const title = item.prompt || (item.type === "video" ? "Untitled video" : "Untitled creation");
                const isSelected = selectedIds.has(item.entry.job_id);
                return (
                  <article key={item.entry.job_id} className={`library-card ${bulkMode && isSelected ? "is-selected" : ""}`}>
                    {bulkMode && <label className="collection-selection"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.entry.job_id)} aria-label={`Select ${title}`} /></label>}
                    <button type="button" className="collection-preview-button" onClick={() => bulkMode ? toggleSelect(item.entry.job_id) : openDrawer(item)} aria-label={`${bulkMode ? "Select" : "View"} ${title}`}>
                      <CollectionPreview src={item.previewUrl} type={item.type} label={title} />
                    </button>
                    <div className="library-body">
                      <h2 className="collection-card-title" title={title}>{title}</h2>
                      <div className="library-meta">
                        <span className={`library-status status-${item.statusClass}`}>{item.statusLabel}</span>
                        <time dateTime={item.entry.created_at} title={created.toLocaleString()}>{created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
                      </div>
                      {!bulkMode && <div className="collection-card-actions">
                        <button type="button" className="collection-download" disabled={!downloadUrl} onClick={() => downloadUrl && downloadAsset(downloadUrl)} aria-label={`Download ${title}`}><Download size={15} aria-hidden="true" /><span>Download</span></button>
                        <details className="collection-more">
                          <summary aria-label={`More actions for ${title}`}><MoreHorizontal size={19} aria-hidden="true" /></summary>
                          <div>
                            <button type="button" onClick={() => openDrawer(item)}>View details</button>
                            {item.available && <button type="button" onClick={() => openSellForm(item)}>List for sale</button>}
                            <button type="button" onClick={() => handleRemove(item.entry.job_id)}>Remove from collection</button>
                          </div>
                        </details>
                      </div>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <JobDetailsDrawer
        open={drawerOpen}
        jobId={drawerSummary?.job_id}
        summary={drawerSummary}
        job={drawerJob}
        result={drawerResult}
        loading={drawerLoading}
        error={drawerError}
        marketplace={{
          wallet: wallet.activeWallet,
          canSign: Boolean(wallet.connectedWallet),
          source: wallet.source,
        }}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Sell listing modal */}
      {sellItem && (
        <div className="job-drawer" onClick={() => setSellItem(null)}>
          <div className="job-drawer-backdrop" />
          <aside className="job-drawer-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="job-drawer-header">
              <div>
                <p className="job-drawer-kicker">Marketplace Listing</p>
                <h3>Publish to Marketplace</h3>
              </div>
              <button type="button" className="job-drawer-close" onClick={() => setSellItem(null)}>Close</button>
            </div>
            <div className="job-drawer-body">
              {sellItem.previewUrl && (
                <section className="job-section">
                  <div style={{ borderRadius: "12px", overflow: "hidden", background: "var(--bg-elevated)" }}>
                    {sellItem.type === "video" ? (
                      <video src={sellItem.previewUrl} muted playsInline style={{ width: "100%", display: "block" }} />
                    ) : (
                      <img src={sellItem.previewUrl} alt="preview" style={{ width: "100%", display: "block" }} />
                    )}
                  </div>
                </section>
              )}
                <section className="job-section">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                    <p className="job-hint" style={{ marginTop: 0 }}>
                      Publishing a listing requires one wallet approval. Once confirmed, the piece
                      appears in the Public Alpha marketplace.
                    </p>
                    <label>
                    <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Title</span>
                    <input type="text" className="library-search" value={sellTitle} onChange={(e) => setSellTitle(e.target.value)} />
                  </label>
                  <label>
                    <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Price (credits)</span>
                    <input type="number" className="library-search" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} min="0.1" step="0.5" />
                  </label>
                  <label>
                    <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Description (optional)</span>
                    <textarea className="library-search" style={{ minHeight: "50px", resize: "vertical" }} value={sellDesc} onChange={(e) => setSellDesc(e.target.value)} />
                  </label>
                  <label>
                    <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Category (optional)</span>
                    <input type="text" className="library-search" value={sellCategory} onChange={(e) => setSellCategory(e.target.value)} placeholder="Portrait, Landscape, etc." />
                  </label>
                  {sellErr && <p className="job-hint error">{sellErr}</p>}
                  {sellLoading && sellProgress && <p className="job-hint">{sellProgress}</p>}
                  {sellMsg ? (
                    <p style={{ color: "#8ff0b6", textAlign: "center" }}>{sellMsg}</p>
                  ) : (
                    <button type="button" className="job-action-button" disabled={sellLoading} onClick={handleSell}>
                      {sellLoading ? "Publishing..." : "Publish Listing"}
                    </button>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default LibraryPage;
