import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  JobDetailResponse,
  JobLoraEntry,
  ResultResponse,
  createGalleryListing,
  resolveAssetUrl,
  cancelJob,
  getJobStuckWarning,
  isUsableWallet,
} from "../lib/havnai";
import { downloadAsset } from "../lib/download";
import { getTimelineSteps, normalizeJobStatus, shortJobId } from "../lib/jobStatus";
import { addToLibrary, isInLibrary, removeFromLibrary, LibraryItemType } from "../lib/libraryStore";

export interface JobSummary {
  job_id?: string;
  id?: string;
  model?: string;
  status?: string;
  task_type?: string;
  submitted_at?: string;
  completed_at?: string;
  image_url?: string;
  video_url?: string;
  output_path?: string;
}

interface JobDetailsDrawerProps {
  open: boolean;
  jobId?: string;
  summary?: JobSummary | null;
  job?: JobDetailResponse | null;
  result?: ResultResponse | null;
  loading?: boolean;
  error?: string;
  marketplace?: {
    wallet?: string | null;
    onListingCreated?: (listingId: number) => void;
  };
  onClose: () => void;
}

function parseJobData(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return raw as Record<string, any>;
  }
  return {};
}

function normalizeLoraEntries(raw: any): JobLoraEntry[] {
  if (!Array.isArray(raw)) return [];
  const normalized: JobLoraEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const parsed: JobLoraEntry = { name: trimmed };
      if (trimmed.includes(":")) {
        const pieces = trimmed.split(":");
        const maybeWeight = pieces[pieces.length - 1];
        const maybeName = pieces.slice(0, pieces.length - 1).join(":").trim();
        const numeric = Number.parseFloat(maybeWeight);
        if (Number.isFinite(numeric)) parsed.applied_weight = numeric;
        if (maybeName) parsed.name = maybeName;
      }
      normalized.push(parsed);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const name = String((item as any).name || (item as any).adapter || (item as any).filename || "").trim();
    if (!name) continue;
    const entry: JobLoraEntry = { name };
    const weight = Number.parseFloat((item as any).weight);
    const requested = Number.parseFloat((item as any).requested_weight);
    const applied = Number.parseFloat((item as any).applied_weight);
    if (Number.isFinite(weight)) entry.weight = weight;
    if (Number.isFinite(requested)) entry.requested_weight = requested;
    if (Number.isFinite(applied)) entry.applied_weight = applied;
    if ((item as any).path) entry.path = String((item as any).path);
    if ((item as any).filename) entry.filename = String((item as any).filename);
    normalized.push(entry);
  }
  return normalized;
}

function formatLoraWeight(entry: JobLoraEntry): string {
  const requested = entry.requested_weight ?? entry.weight;
  const applied = entry.applied_weight;
  if (requested != null && applied != null) {
    return `${requested.toFixed(2)} → ${applied.toFixed(2)}`;
  }
  if (requested != null) return requested.toFixed(2);
  if (applied != null) return applied.toFixed(2);
  return "--";
}

function truncateText(value: string | undefined, limit = 500): string | undefined {
  if (!value) return value;
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
}

function formatUnixSeconds(value?: number | null): string | undefined {
  if (!value || typeof value !== "number") return undefined;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

function formatIso(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

function resolveCreatedAtIso(
  timestamp?: number | null,
  submittedAt?: string | null
): string {
  if (typeof timestamp === "number") {
    return new Date(timestamp * 1000).toISOString();
  }
  if (submittedAt) {
    const date = new Date(submittedAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

export const JobDetailsDrawer: React.FC<JobDetailsDrawerProps> = ({
  open,
  jobId,
  summary,
  job,
  result,
  loading,
  error,
  marketplace,
  onClose,
}) => {
  const resolvedId = job?.id || summary?.job_id || summary?.id || jobId;
  const statusValue = job?.status || summary?.status || "unknown";
  const normalized = normalizeJobStatus(statusValue);
  const timelineSteps = getTimelineSteps(normalized);
  const jobData = useMemo(() => parseJobData(job?.data), [job?.data]);

  const previewImage =
    resolveAssetUrl(result?.image_url) ||
    resolveAssetUrl(summary?.image_url);
  const previewVideo =
    resolveAssetUrl(result?.video_url) ||
    resolveAssetUrl(summary?.video_url);
  const [isSaved, setIsSaved] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingCategory, setListingCategory] = useState("");
  const [listingPrice, setListingPrice] = useState("10");
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [listingError, setListingError] = useState<string | undefined>();
  const [listingSuccess, setListingSuccess] = useState<string | undefined>();

  useEffect(() => {
    if (!resolvedId || !open) {
      setIsSaved(false);
      return;
    }
    setIsSaved(isInLibrary(resolvedId));
  }, [resolvedId, open]);

  useEffect(() => {
    if (!open) {
      setListingOpen(false);
      setListingError(undefined);
      setListingSuccess(undefined);
      return;
    }
    const defaultTitle = resolvedId ? `Generation #${resolvedId.slice(0, 8)}` : "Generation";
    setListingTitle(defaultTitle);
    setListingDescription("");
    setListingCategory("");
    setListingPrice("10");
    setListingError(undefined);
    setListingSuccess(undefined);
    setListingOpen(false);
  }, [open, resolvedId]);

  const createdAt =
    formatUnixSeconds(job?.timestamp) ||
    formatIso(summary?.submitted_at);

  const completedAt =
    formatUnixSeconds(job?.completed_at) ||
    formatIso(summary?.completed_at);

  const promptText = truncateText(jobData.prompt, 500);
  const negativePrompt = truncateText(jobData.negative_prompt, 500);
  const requestedLoras = useMemo(
    () => normalizeLoraEntries(job?.requested_loras || jobData.requested_loras || jobData.loras),
    [job?.requested_loras, jobData.requested_loras, jobData.loras]
  );
  const appliedLoras = useMemo(
    () => normalizeLoraEntries(job?.applied_loras || jobData.applied_loras),
    [job?.applied_loras, jobData.applied_loras]
  );
  const statusReason =
    (typeof job?.status_reason === "string" && job.status_reason.trim()) ||
    (typeof jobData.status_reason === "string" && jobData.status_reason.trim()) ||
    (typeof jobData.error === "string" && jobData.error.trim()) ||
    undefined;

  const params = {
    seed: jobData.seed ?? jobData.overrides?.seed,
    steps: jobData.steps ?? jobData.num_steps ?? jobData.overrides?.steps,
    guidance: jobData.guidance ?? jobData.overrides?.guidance,
    width: jobData.width ?? jobData.overrides?.width,
    height: jobData.height ?? jobData.overrides?.height,
    fps: jobData.fps,
    frames: jobData.frames,
    sampler: jobData.sampler ?? jobData.overrides?.sampler,
  };

  const debugPayload = useMemo(() => {
    return {
      job_id: resolvedId,
      status: statusValue,
      timestamps: {
        created_at: createdAt,
        completed_at: completedAt,
      },
      model: job?.model || summary?.model,
      engine: jobData.engine || job?.task_type || summary?.task_type,
      node_id: job?.node_id || jobData.node_id || jobData.worker_id,
      worker_id: jobData.worker_id || job?.node_id,
      params,
      prompt: promptText,
      negative_prompt: negativePrompt,
      output_urls: {
        image_url: previewImage,
        video_url: previewVideo,
      },
      preview_url: previewImage || previewVideo,
      status_reason: statusReason,
      requested_loras: requestedLoras,
      applied_loras: appliedLoras,
      error_message:
        jobData.error_message || jobData.error || jobData.failure_reason || undefined,
    };
  }, [
    resolvedId,
    statusValue,
    createdAt,
    completedAt,
    job,
    summary,
    jobData,
    params,
    promptText,
    negativePrompt,
    previewImage,
    previewVideo,
    statusReason,
    requestedLoras,
    appliedLoras,
  ]);

  const handleCopy = async (text: string) => {
    if (!text || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // noop
    }
  };

  const handleDownload = async () => {
    const url = previewVideo || previewImage;
    if (!url) return;
    await downloadAsset(url);
  };

  const handleSave = () => {
    if (!resolvedId) return;
    const createdAtIso = resolveCreatedAtIso(job?.timestamp, summary?.submitted_at);
    let type: LibraryItemType = "unknown";
    if (result?.video_url || previewVideo) type = "video";
    else if (result?.image_url || previewImage) type = "image";
    const previewHint = result?.video_url || result?.image_url || summary?.video_url || summary?.image_url;
    addToLibrary({
      job_id: resolvedId,
      created_at: createdAtIso,
      type,
      preview_hint: previewHint || undefined,
    });
    setIsSaved(true);
  };

  const handleRemove = () => {
    if (!resolvedId) return;
    removeFromLibrary(resolvedId);
    setIsSaved(false);
  };

  const canListInMarketplace = Boolean(
    resolvedId &&
      isUsableWallet(marketplace?.wallet) &&
      (previewImage || previewVideo)
  );

  const handleCreateListing = async () => {
    if (!resolvedId || !isUsableWallet(marketplace?.wallet)) return;
    if (!listingTitle.trim()) {
      setListingError("Title is required.");
      return;
    }
    const parsedPrice = Number.parseFloat(listingPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setListingError("Price must be greater than 0.");
      return;
    }

    setListingSubmitting(true);
    setListingError(undefined);
    setListingSuccess(undefined);
    try {
      const listing = await createGalleryListing({
        wallet: marketplace.wallet,
        job_id: resolvedId,
        title: listingTitle.trim(),
        description: listingDescription.trim(),
        category: listingCategory.trim(),
        price_credits: parsedPrice,
      });
      setListingSuccess(
        listing.already_listed
          ? "Already listed. View it in My Listings."
          : "Listed successfully. View it in My Listings."
      );
      setListingOpen(false);
      marketplace?.onListingCreated?.(listing.id);
    } catch (err: any) {
      setListingError(err?.message || "Failed to create listing.");
    } finally {
      setListingSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="job-drawer">
      <button
        type="button"
        className="job-drawer-backdrop"
        aria-label="Close job details"
        onClick={onClose}
      />
      <aside className="job-drawer-panel" role="dialog" aria-modal="true">
        <div className="job-drawer-header">
          <div>
            <p className="job-drawer-kicker">Job Details</p>
            <h3>
              {shortJobId(resolvedId)}
              {resolvedId && (
                <button
                  type="button"
                  className="job-inline-button"
                  onClick={() => handleCopy(resolvedId)}
                >
                  Copy full ID
                </button>
              )}
            </h3>
            <div className="job-meta-row">
              <span className={`status-pill status-${normalized.pill.toLowerCase()}`}>
                {normalized.pill}
              </span>
              {createdAt && <span>Created {createdAt}</span>}
            </div>
          </div>
          <button type="button" className="job-drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="job-drawer-body">
          <section className="job-section">
            <h4>Progress</h4>
            <div className="status-timeline">
              {timelineSteps.map((step, index) => {
                const isActive = index === normalized.activeIndex;
                const isComplete = index < normalized.activeIndex;
                const isFailed = normalized.isFailed && step.key === "failed";
                return (
                  <div
                    key={step.key}
                    className={`timeline-step${isActive ? " is-active" : ""}${
                      isComplete ? " is-complete" : ""
                    }${isFailed ? " is-failed" : ""}`}
                  >
                    <span className="timeline-dot" />
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
            {job && (() => {
              const warning = getJobStuckWarning(job);
              if (!warning) return null;
              return (
                <div className="job-stuck-warning" style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "rgba(255, 180, 50, 0.12)",
                  border: "1px solid rgba(255, 180, 50, 0.3)",
                  fontSize: "0.85rem",
                  color: "#ffb432",
                }}>
                  <p style={{ margin: "0 0 0.5rem 0" }}>{warning}</p>
                  <button
                    type="button"
                    style={{
                      background: "rgba(255, 80, 80, 0.15)",
                      border: "1px solid rgba(255, 80, 80, 0.4)",
                      color: "#ff6b6b",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                    onClick={async () => {
                      if (!resolvedId) return;
                      try {
                        await cancelJob(resolvedId);
                        onClose();
                      } catch {
                        // ignore — job may already be completed
                      }
                    }}
                  >
                    Cancel job
                  </button>
                </div>
              );
            })()}
          </section>

          <section className="job-section">
            <h4>Result</h4>
            <div className="job-preview">
              {previewVideo ? (
                <video src={previewVideo} controls playsInline />
              ) : previewImage ? (
                <img
                  src={previewImage}
                  alt={resolvedId || "Job preview"}
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).src = "/HavnAI-logo.png";
                  }}
                />
              ) : (
                <div className="job-preview-empty">Preview not available</div>
              )}
            </div>
          </section>

          <section className="job-section">
            <h4>Quick actions</h4>
            <div className="job-actions">
              <button
                type="button"
                className="job-action-button"
                onClick={handleDownload}
                disabled={!previewImage && !previewVideo}
              >
                Download output
              </button>
              <button
                type="button"
                className="job-action-button secondary"
                onClick={() => handleCopy(JSON.stringify(debugPayload, null, 2))}
              >
                Copy debug info
              </button>
              {!isSaved ? (
                <button
                  type="button"
                  className="job-action-button secondary"
                  onClick={handleSave}
                  disabled={!resolvedId}
                >
                  Save to Library
                </button>
              ) : (
                <div className="job-saved">
                  <span>Saved ✓</span>
                  <button type="button" className="job-inline-button" onClick={handleRemove}>
                    Remove
                  </button>
                </div>
              )}
              {canListInMarketplace && (
                <button
                  type="button"
                  className="job-action-button secondary"
                  onClick={() => setListingOpen((value) => !value)}
                >
                  {listingOpen ? "Close listing form" : "List on Marketplace"}
                </button>
              )}
            </div>
            {loading && <p className="job-hint">Loading job details...</p>}
            {error && <p className="job-hint error">{error}</p>}
            {listingSuccess && (
              <p className="job-hint" style={{ color: "#8ff0b6" }}>
                {listingSuccess}{" "}
                <a href="/marketplace?tab=gallery&galleryView=my-listings">My Listings</a>
              </p>
            )}
            {canListInMarketplace && listingOpen && (
              <div className="marketplace-listing-form">
                <label>
                  <span className="job-label">title</span>
                  <input
                    type="text"
                    className="library-search"
                    value={listingTitle}
                    onChange={(event) => setListingTitle(event.target.value)}
                    placeholder="Generation title"
                  />
                </label>
                <label>
                  <span className="job-label">description</span>
                  <textarea
                    className="library-search"
                    value={listingDescription}
                    onChange={(event) => setListingDescription(event.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                </label>
                <div className="marketplace-listing-form-grid">
                  <label>
                    <span className="job-label">price_credits</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      className="library-search"
                      value={listingPrice}
                      onChange={(event) => setListingPrice(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="job-label">category</span>
                    <input
                      type="text"
                      className="library-search"
                      value={listingCategory}
                      onChange={(event) => setListingCategory(event.target.value)}
                      placeholder="Optional category"
                    />
                  </label>
                </div>
                {listingError && <p className="job-hint error">{listingError}</p>}
                <div className="job-actions">
                  <button
                    type="button"
                    className="job-action-button"
                    disabled={listingSubmitting}
                    onClick={handleCreateListing}
                  >
                    {listingSubmitting ? "Listing..." : "Create Listing"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="job-section">
            <details open>
              <summary>Settings used</summary>
              <div className="job-details-grid">
                {Object.entries(params).map(([key, value]) =>
                  value != null ? (
                    <div key={key}>
                      <span className="job-label">{key}</span>
                      <span>{String(value)}</span>
                    </div>
                  ) : null
                )}
                {job?.model && (
                  <div>
                    <span className="job-label">model</span>
                    <span>{job.model}</span>
                  </div>
                )}
                {job?.task_type && (
                  <div>
                    <span className="job-label">engine</span>
                    <span>{job.task_type}</span>
                  </div>
                )}
              </div>
            </details>
          </section>

          <section className="job-section">
            <details>
              <summary>Prompt</summary>
              <div className="job-details-stack">
                <div>
                  <span className="job-label">prompt</span>
                  <p>{promptText || "--"}</p>
                </div>
                <div>
                  <span className="job-label">negative_prompt</span>
                  <p>{negativePrompt || "--"}</p>
                </div>
              </div>
            </details>
          </section>

          <section className="job-section">
            <details>
              <summary>Routing info</summary>
              <div className="job-details-grid">
                <div>
                  <span className="job-label">node_id</span>
                  <span>{job?.node_id || "--"}</span>
                </div>
                <div>
                  <span className="job-label">engine</span>
                  <span>{job?.task_type || summary?.task_type || "--"}</span>
                </div>
                <div>
                  <span className="job-label">model</span>
                  <span>{job?.model || summary?.model || "--"}</span>
                </div>
                <div>
                  <span className="job-label">status_reason</span>
                  <span>{statusReason || "--"}</span>
                </div>
              </div>
            </details>
          </section>

          <section className="job-section">
            <details>
              <summary>LoRA trace</summary>
              <div className="job-details-stack">
                <div>
                  <span className="job-label">requested_loras</span>
                  {requestedLoras.length > 0 ? (
                    <ul>
                      {requestedLoras.map((entry, index) => (
                        <li key={`requested-lora-${index}`}>
                          <code>{entry.name}</code> · {formatLoraWeight(entry)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>--</p>
                  )}
                </div>
                <div>
                  <span className="job-label">applied_loras</span>
                  {appliedLoras.length > 0 ? (
                    <ul>
                      {appliedLoras.map((entry, index) => (
                        <li key={`applied-lora-${index}`}>
                          <code>{entry.name}</code> · {formatLoraWeight(entry)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>--</p>
                  )}
                </div>
              </div>
            </details>
          </section>

          <section className="job-section">
            <details>
              <summary>Debug JSON</summary>
              <div className="job-raw-wrapper">
                <button
                  type="button"
                  className="job-raw-copy"
                  onClick={() => handleCopy(JSON.stringify(job?.data || summary || {}, null, 2))}
                >
                  Copy
                </button>
                <pre className="job-raw">
                  {JSON.stringify(job?.data || summary || {}, null, 2)}
                </pre>
              </div>
            </details>
          </section>

          {normalized.isFailed && (() => {
            const errText = statusReason || jobData.error_message || jobData.error || "Unknown error";
            const isOOM = /out of memory/i.test(errText);
            return (
              <section className="job-section job-failure">
                <h4>Something went wrong</h4>
                <p>{errText}</p>
                {isOOM ? (
                  <ul>
                    <li>Your GPU ran out of memory during generation.</li>
                    <li>Try reducing resolution (e.g. 384x384) or frame count.</li>
                    <li>Switch to LTX2 which uses less VRAM than AnimateDiff.</li>
                    <li>Close other GPU-heavy apps before retrying.</li>
                  </ul>
                ) : (
                  <ul>
                    <li>Retry the job or pick a smaller frame count.</li>
                    <li>Lower resolution or switch to a faster model.</li>
                    <li>Copy debug info to share with support.</li>
                  </ul>
                )}
              </section>
            );
          })()}
        </div>
      </aside>
    </div>
  );
};
