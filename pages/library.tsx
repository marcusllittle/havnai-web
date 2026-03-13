import type { NextPage } from "next";
import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "../components/WalletProvider";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import { SiteHeader } from "../components/SiteHeader";
import { downloadAsset } from "../lib/download";
import {
  fetchJob,
  fetchResult,
  createGalleryListingWithMetaMask,
  formatApiError,
  JobDetailResponse,
  resolveAssetUrl,
  ResultResponse,
} from "../lib/havnai";
import {
  loadLibrary,
  removeFromLibrary,
  bulkRemoveFromLibrary,
  LibraryEntry,
  LibraryItemType,
} from "../lib/libraryStore";
import { normalizeJobStatus } from "../lib/jobStatus";
import { getConnectButtonLabel } from "../lib/wallet";
import { getWalletIdentityLabel, getWalletSourceLabel, getWalletStatusCopy, PUBLIC_ALPHA_LABEL } from "../lib/publicAlpha";

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

async function buildViewItem(entry: LibraryEntry): Promise<LibraryViewItem> {
  let job: JobDetailResponse | null = null;
  let result: ResultResponse | null = null;
  let available = false;
  let statusLabel = "Unknown";
  let statusClass = "unknown";
  let model: string | undefined;
  let prompt: string | undefined;

  try {
    job = await fetchJob(entry.job_id);
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
    result = await fetchResult(entry.job_id);
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
  entries: LibraryEntry[]
): Promise<LibraryViewItem[]> {
  const results: LibraryViewItem[] = new Array(entries.length);
  let index = 0;

  const worker = async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= entries.length) break;
      results[current] = await buildViewItem(entries[current]);
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, entries.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results.filter(Boolean);
}

const LibraryPage: NextPage = () => {
  const wallet = useWallet();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [items, setItems] = useState<LibraryViewItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const stored = loadLibrary();
    setEntries(stored);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const next = await fetchLibraryDetails(entries);
      if (active) {
        setItems(next);
        setLoading(false);
      }
    };
    if (entries.length) {
      load();
    } else {
      setItems([]);
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [entries]);

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

  const emptyState = !loading && entries.length === 0;
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

  // Status counts for filter chips
  const statusCounts = useMemo(() => {
    const counts = { all: items.length, ready: 0, running: 0, failed: 0 };
    for (const item of items) {
      if (item.statusClass === "ready") counts.ready++;
      else if (item.statusClass === "running") counts.running++;
      else if (item.statusClass === "failed") counts.failed++;
    }
    return counts;
  }, [items]);

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
      <Head>
        <title>HavnAI Library</title>
      </Head>
      <SiteHeader />

      <main className="library-page">
        <section className="library-hero">
          <div className="library-hero-inner">
            <p className="hero-kicker">My Library</p>
            <h1 className="hero-title">Saved creations</h1>
            <p className="hero-subtitle">
              Saved outputs from this browser stay local until you choose to publish them to the
              Public Alpha marketplace.
            </p>
          </div>
        </section>

        <section className="page-container">
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
                onClick={() => void wallet.connect()}
                disabled={wallet.connecting}
              >
                {connectLabel}
              </button>
            </div>
          </div>
        </section>

        {!emptyState && (
          <section className="library-toolbar">
            <div className="library-toolbar-inner">
              {/* Search */}
              <div className="library-search-wrapper">
                <input
                  type="text"
                  className="library-search"
                  placeholder="Search by prompt, model, or job ID..."
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
                    x
                  </button>
                )}
              </div>

              {/* Filter row */}
              <div className="library-filters">
                <div className="library-filter-group">
                  <span className="library-filter-label">Status</span>
                  {(
                    [
                      ["all", "All"],
                      ["ready", "Ready"],
                      ["running", "Running"],
                      ["failed", "Failed"],
                    ] as [StatusFilter, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`library-chip ${
                        statusFilter === value ? "is-active" : ""
                      }`}
                      onClick={() => setStatusFilter(value)}
                    >
                      {label}
                      <span className="library-chip-count">
                        {statusCounts[value]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="library-filter-group">
                  <span className="library-filter-label">Type</span>
                  {(
                    [
                      ["all", "All"],
                      ["image", "Image"],
                      ["video", "Video"],
                    ] as [TypeFilter, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`library-chip ${
                        typeFilter === value ? "is-active" : ""
                      }`}
                      onClick={() => setTypeFilter(value)}
                    >
                      {label}
                      <span className="library-chip-count">
                        {typeCounts[value]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="library-filter-group">
                  <span className="library-filter-label">Sort</span>
                  <select
                    className="library-sort-select"
                    value={sortOption}
                    onChange={(e) =>
                      setSortOption(e.target.value as SortOption)
                    }
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
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
                        All
                      </button>
                      <button
                        type="button"
                        className="library-chip"
                        onClick={deselectAll}
                      >
                        None
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
                          ? `Delete ${selectedIds.size}?`
                          : `Delete (${selectedIds.size})`}
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
          {loading && <p className="library-loading">Loading library...</p>}
          {emptyState && (
            <div className="library-empty">
              <p>
                No saved items yet. Render something in Public Alpha, then save the results you want
                to revisit or publish later.
              </p>
            </div>
          )}
          {noResults && (
            <div className="library-empty">
              <p>No saved items match this view. Clear the filters to return to your full library.</p>
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
          {!loading && filteredItems.length > 0 && (
            <div className="library-grid">
              {filteredItems.map((item) => {
                const downloadUrl = resolveAssetUrl(
                  item.result?.video_url ||
                    item.result?.image_url ||
                    item.entry.preview_hint
                );
                const createdLabel = new Date(
                  item.entry.created_at
                ).toLocaleString();
                const isSelected = selectedIds.has(item.entry.job_id);
                return (
                  <article
                    key={item.entry.job_id}
                    className={`library-card ${
                      bulkMode && isSelected ? "is-selected" : ""
                    }`}
                    onClick={
                      bulkMode
                        ? () => toggleSelect(item.entry.job_id)
                        : undefined
                    }
                  >
                    {bulkMode && (
                      <div className="library-select-overlay">
                        <span
                          className={`library-checkbox ${
                            isSelected ? "is-checked" : ""
                          }`}
                        />
                      </div>
                    )}
                    <div className="library-preview">
                      {item.previewUrl ? (
                        item.type === "video" ? (
                          <video src={item.previewUrl} muted playsInline />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt={item.entry.job_id}
                            loading="lazy"
                          />
                        )
                      ) : (
                        <div className="library-preview-empty">Preview unavailable</div>
                      )}
                      <span
                        className={`library-badge library-type-${item.type}`}
                      >
                        {item.type}
                      </span>
                    </div>
                    <div className="library-body">
                      {item.model && (
                        <div className="library-model">{item.model}</div>
                      )}
                      {item.prompt && (
                        <div className="library-prompt" title={item.prompt}>
                          {item.prompt.length > 60
                            ? item.prompt.slice(0, 60) + "..."
                            : item.prompt}
                        </div>
                      )}
                      <div className="library-meta">
                        <span
                          className={`library-status status-${item.statusClass}`}
                        >
                          {item.statusLabel}
                        </span>
                        <span className="library-date">{createdLabel}</span>
                      </div>
                      <code className="library-id">{item.entry.job_id}</code>
                      {!bulkMode && (
                        <div className="library-actions">
                          <button
                            type="button"
                            className="job-action-button"
                            onClick={() => openDrawer(item)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="job-action-button secondary"
                            disabled={!downloadUrl}
                            onClick={() =>
                              downloadUrl && downloadAsset(downloadUrl)
                            }
                          >
                            Download
                          </button>
                          {item.available && (
                            <button
                              type="button"
                              className="job-action-button secondary"
                              onClick={() => openSellForm(item)}
                            >
                              List for Sale
                            </button>
                          )}
                          <button
                            type="button"
                            className="job-action-button secondary"
                            onClick={() => handleRemove(item.entry.job_id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
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
