import React, { useEffect, useMemo, useState } from "react";
import { JobDetailResponse, ResultResponse, resolveAssetUrl } from "../lib/havnai";
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

  useEffect(() => {
    if (!resolvedId || !open) {
      setIsSaved(false);
      return;
    }
    setIsSaved(isInLibrary(resolvedId));
  }, [resolvedId, open]);

  const createdAt =
    formatUnixSeconds(job?.timestamp) ||
    formatIso(summary?.submitted_at);

  const completedAt =
    formatUnixSeconds(job?.completed_at) ||
    formatIso(summary?.completed_at);

  const promptText = truncateText(jobData.prompt, 500);
  const negativePrompt = truncateText(jobData.negative_prompt, 500);

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
            <h4>Status Timeline</h4>
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
          </section>

          <section className="job-section">
            <h4>Preview</h4>
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
            <h4>Actions</h4>
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
            </div>
            {loading && <p className="job-hint">Loading job details...</p>}
            {error && <p className="job-hint error">{error}</p>}
          </section>

          <section className="job-section">
            <details open>
              <summary>Generation Params</summary>
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
              <summary>Routing / Node</summary>
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
              </div>
            </details>
          </section>

          <section className="job-section">
            <details>
              <summary>Raw Job JSON</summary>
              <pre className="job-raw">
                {JSON.stringify(job?.data || summary || {}, null, 2)}
              </pre>
            </details>
          </section>

          {normalized.isFailed && (
            <section className="job-section job-failure">
              <h4>Failure Details</h4>
              <p>{jobData.error_message || jobData.error || "Unknown error"}</p>
              <ul>
                <li>Retry the job or pick a smaller frame count.</li>
                <li>Lower resolution or switch to a faster model.</li>
                <li>Copy debug info to share with support.</li>
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
};
