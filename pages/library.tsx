import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import { downloadAsset } from "../lib/download";
import {
  fetchJob,
  fetchResult,
  JobDetailResponse,
  resolveAssetUrl,
  ResultResponse,
} from "../lib/havnai";
import { loadLibrary, removeFromLibrary, LibraryEntry, LibraryItemType } from "../lib/libraryStore";
import { normalizeJobStatus } from "../lib/jobStatus";

type LibraryViewItem = {
  entry: LibraryEntry;
  job?: JobDetailResponse | null;
  result?: ResultResponse | null;
  previewUrl?: string;
  statusLabel: string;
  statusClass: string;
  type: LibraryItemType;
  available: boolean;
};

const CONCURRENCY_LIMIT = 5;

async function buildViewItem(entry: LibraryEntry): Promise<LibraryViewItem> {
  let job: JobDetailResponse | null = null;
  let result: ResultResponse | null = null;
  let available = false;
  let statusLabel = "Unknown";
  let statusClass = "unknown";

  try {
    job = await fetchJob(entry.job_id);
    const normalized = normalizeJobStatus(job.status);
    statusLabel = normalized.isFailed ? "Failed" : normalized.pill === "Ready" ? "Ready" : normalized.label;
    if (normalized.isFailed) {
      statusClass = "failed";
    } else if (normalized.pill === "Ready") {
      statusClass = "ready";
    } else {
      statusClass = "running";
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
  };
}

async function fetchLibraryDetails(entries: LibraryEntry[]): Promise<LibraryViewItem[]> {
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

  const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, entries.length) }, () => worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}

const LibraryPage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [items, setItems] = useState<LibraryViewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerJob, setDrawerJob] = useState<JobDetailResponse | null>(null);
  const [drawerResult, setDrawerResult] = useState<ResultResponse | null>(null);
  const [drawerSummary, setDrawerSummary] = useState<JobSummary | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | undefined>();

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

  const emptyState = !loading && entries.length === 0;

  const openDrawer = async (item: LibraryViewItem) => {
    const completedAt =
      typeof item.job?.completed_at === "number"
        ? new Date(item.job.completed_at * 1000).toISOString()
        : undefined;
    const summary: JobSummary = {
      job_id: item.entry.job_id,
      model: item.job?.model,
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
  };

  const renderItems = useMemo(() => {
    return items.map((item) => {
      const downloadUrl = resolveAssetUrl(
        item.result?.video_url || item.result?.image_url || item.entry.preview_hint
      );
      const createdLabel = new Date(item.entry.created_at).toLocaleString();
      return (
        <article key={item.entry.job_id} className="library-card">
          <div className="library-preview">
            {item.previewUrl ? (
              item.type === "video" ? (
                <video src={item.previewUrl} muted playsInline />
              ) : (
                <img src={item.previewUrl} alt={item.entry.job_id} />
              )
            ) : (
              <div className="library-preview-empty">No preview</div>
            )}
            <span className={`library-badge library-type-${item.type}`}>{item.type}</span>
          </div>
          <div className="library-body">
            <div className="library-meta">
              <span className={`library-status status-${item.statusClass}`}>{item.statusLabel}</span>
              <span className="library-date">{createdLabel}</span>
            </div>
            <code className="library-id">{item.entry.job_id}</code>
            <div className="library-actions">
              <button type="button" className="job-action-button" onClick={() => openDrawer(item)}>
                View
              </button>
              <button
                type="button"
                className="job-action-button secondary"
                disabled={!downloadUrl}
                onClick={() => downloadUrl && downloadAsset(downloadUrl)}
              >
                Download
              </button>
              <button
                type="button"
                className="job-action-button secondary"
                onClick={() => handleRemove(item.entry.job_id)}
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      );
    });
  }, [items]);

  return (
    <>
      <Head>
        <title>HavnAI Library</title>
      </Head>
      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Stage 6 + 7 Alpha</span>
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
            <a href="/#how">How It Works</a>
            <a href="/#smart-routing">Smart Routing</a>
            <a href="/#rewards">Rewards</a>
            <a href="/#models">Models</a>
            <a href="/test">Generator</a>
            <a href="/library" className="nav-active">
              My Library
            </a>
            <a href="/pricing">Buy Credits</a>
            <a href="http://api.joinhavn.io:5001/dashboard" target="_blank" rel="noreferrer">
              Dashboard
            </a>
            <a href="#join">Join Alpha</a>
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="library-hero">
          <div className="library-hero-inner">
            <p className="hero-kicker">My Library</p>
            <h1 className="hero-title">Saved creations</h1>
            <p className="hero-subtitle">
              Your completed jobs are stored locally in this browser. Nothing is saved on the server.
            </p>
          </div>
        </section>

        <section className="library-section">
          {loading && <p className="library-loading">Loading library...</p>}
          {emptyState && (
            <div className="library-empty">
              <p>No saved items yet. Create something in Generator and it will appear here.</p>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="library-grid">{renderItems}</div>
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
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default LibraryPage;
