import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import { SiteHeader } from "../components/SiteHeader";
import { useWallet } from "../components/WalletProvider";
import { fetchJobWithResult, JobDetailResponse, ResultResponse, resolveAssetUrl } from "../lib/havnai";
import { getApiBase } from "../lib/apiBase";
import { PUBLIC_ALPHA_LABEL } from "../lib/publicAlpha";

const HomePage: NextPage = () => {
  const wallet = useWallet();
  const [liveJobs, setLiveJobs] = useState<any[]>([]);
  const [liveJobsLoading, setLiveJobsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerJob, setDrawerJob] = useState<JobDetailResponse | null>(null);
  const [drawerResult, setDrawerResult] = useState<ResultResponse | null>(null);
  const [drawerSummary, setDrawerSummary] = useState<JobSummary | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | undefined>();

  const getInstallBase = (): string => {
    const configuredBase = getApiBase();
    if (/^https?:\/\//i.test(configuredBase)) {
      return configuredBase;
    }
    return `https://joinhavn.io${configuredBase.startsWith("/") ? "" : "/"}${configuredBase}`;
  };

  const apiBase = getApiBase();
  const installBase = getInstallBase();

  // Client-side behavior for stats, models, jobs, and previews.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const API_BASE = getApiBase();

    const heroActiveNodes = document.getElementById("heroActiveNodes");
    const heroJobs24h = document.getElementById("heroJobs24h");
    const heroSuccessRate = document.getElementById("heroSuccessRate");
    const heroTopModel = document.getElementById("heroTopModel");

    const liveActiveNodes = document.getElementById("liveActiveNodes");
    const liveJobs24h = document.getElementById("liveJobs24h");
    const liveSuccessRate = document.getElementById("liveSuccessRate");

    if (
      !heroActiveNodes ||
      !heroJobs24h ||
      !heroSuccessRate ||
      !heroTopModel ||
      !liveActiveNodes ||
      !liveJobs24h ||
      !liveSuccessRate
    ) {
      return;
    }

    const sampleStats = {
      active_nodes: 0,
      jobs_completed_24h: 0,
      success_rate: 0,
      top_model: "—",
    };

    function safeArray(value: any): any[] {
      return Array.isArray(value) ? value : [];
    }

    function renderStats(data: any) {
      const nodes = data.active_nodes ?? sampleStats.active_nodes;
      const jobs = data.jobs_completed_24h ?? sampleStats.jobs_completed_24h;
      const success = data.success_rate ?? sampleStats.success_rate;
      const topModel = data.top_model ?? sampleStats.top_model;

      heroActiveNodes.textContent = String(nodes);
      heroJobs24h.textContent = String(jobs);
      heroSuccessRate.textContent =
        typeof success === "number" ? success.toFixed(1) + "%" : String(success);
      heroTopModel.textContent = topModel || "—";

      liveActiveNodes.textContent = String(nodes);
      liveJobs24h.textContent = String(jobs);
      liveSuccessRate.textContent =
        typeof success === "number" ? success.toFixed(1) + "%" : String(success);
    }

    async function loadStats() {
      try {
        const res = await fetch(`${API_BASE}/models/stats`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("stats HTTP " + res.status);
        const data = await res.json();
        renderStats(data);
      } catch (err) {
        console.error("Failed to load /models/stats", err);
        renderStats(sampleStats);
      }
    }

    async function loadJobs() {
      try {
        setLiveJobsLoading(true);
        const res = await fetch(`${API_BASE}/jobs/recent?limit=10`, {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("jobs HTTP " + res.status);
        const data = await res.json();
        setLiveJobs(safeArray(data.jobs || data.feed || []));
      } catch (err) {
        console.error("Failed to load /jobs/recent", err);
        setLiveJobs([]);
      } finally {
        setLiveJobsLoading(false);
      }
    }

    loadStats();
    loadJobs();
    const intervalId = window.setInterval(loadStats, 15000);
    const jobsIntervalId = window.setInterval(loadJobs, 15000);

    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(jobsIntervalId);
    };
  }, []);

  const openJobDetails = async (summary: JobSummary) => {
    const id = summary.job_id || summary.id;
    if (!id) return;
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(undefined);
    setDrawerSummary(summary);
    try {
      const { job, result } = await fetchJobWithResult(id);
      setDrawerJob(job);
      setDrawerResult(result || null);
    } catch (err: any) {
      setDrawerError(err?.message || "Failed to load job details.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const showLivePreview = liveJobs.some(
    (job) => job.image_url || job.preview_url || job.video_url
  );

  return (
    <>
      <Head>
        <title>HavnAI Network Public Alpha — Own Your Intelligence</title>
        <meta
          name="description"
          content="HavnAI Public Alpha is a decentralized GPU network for AI image generation, face swap, and video jobs when video-capable nodes are online."
        />
        <meta property="og:title" content="HavnAI Network Public Alpha — Own Your Intelligence" />
        <meta
          property="og:description"
          content="HavnAI Public Alpha is a decentralized GPU network for AI image generation, face swap, and video jobs when video-capable nodes are online."
        />
        <meta property="og:type" content="website" />
      </Head>

      <SiteHeader />

      <main>
        {/* HERO */}
        <section id="home" className="hero">
          <div className="hero-inner">
            <div className="hero-content">
              <p className="hero-kicker">{PUBLIC_ALPHA_LABEL} • Decentralized GPU Intelligence</p>
              <h1 className="hero-title">OWN YOUR INTELLIGENCE</h1>
              <p className="hero-subtitle">
                HavnAI is a decentralized GPU network for creators and GPU operators in Public Alpha.
                Generate images, face swaps, and video when compatible capacity is online, or connect
                a GPU and earn tracked HAI rewards for serving live jobs.
              </p>
              <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "1.4rem" }}>
                <a href="/generator" className="btn primary">
                  Start Generating
                </a>
                <a href="/pricing" className="btn tertiary">
                  Buy Credits
                </a>
              </div>
              <div className="hero-install-note">
                <h3>Run a HavnAI Node</h3>
                <p>Run this on your GPU machine to install the node:</p>
                <pre>
                  <code>{`curl -fsSL ${installBase}/installers/install-node.sh \n  | bash -s -- --server ${installBase}`}</code>
                </pre>
                <p>
                  Full prerequisites, wallet setup, video capacity guidance, service management, and
                  troubleshooting live in the node install guide.
                </p>
                <a
                  href="/join"
                  className="btn tertiary wide"
                >
                  Open Node Install Guide
                </a>
              </div>
            </div>
            <div className="hero-panel">
              <div className="stat-grid">
                <div className="stat-card">
                  <span className="stat-label">Active Nodes</span>
                  <span className="stat-value" id="heroActiveNodes">
                    --
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Jobs (24h)</span>
                  <span className="stat-value" id="heroJobs24h">
                    --
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Success Rate</span>
                  <span className="stat-value" id="heroSuccessRate">
                    --%
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Top Model</span>
                  <span className="stat-value small" id="heroTopModel">
                    --
                  </span>
                </div>
              </div>
              <div className="stat-footnote">
                Live data from the HavnAI coordinator.
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="section">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>From creator prompt to tracked operator rewards in four steps.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <div className="step-icon">1</div>
              <h3>Connect Your GPU</h3>
              <p>
                Run the one-line installer on your GPU machine. It registers your node with the
                coordinator and starts accepting image and video generation jobs.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">2</div>
              <h3>Jobs Get Routed</h3>
              <p>
                Creators submit prompts through the Generator. The coordinator matches each request
                to a healthy node with compatible live capacity.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">3</div>
              <h3>Your GPU Generates</h3>
              <p>
                Your node runs the assigned model, returns the output, and helps keep creator jobs
                moving. Public Alpha currently centers on SDXL image and face swap, with video jobs
                routed whenever LTX2 capacity is online.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">4</div>
              <h3>Earn $HAI</h3>
              <p>
                Completed jobs add tracked HAI rewards to the operator identity behind that node.
                Reward weighting scales with model tier, pipeline cost, and runtime throughout Public Alpha.
              </p>
            </article>
          </div>
        </section>

        {/* SMART ROUTING */}
        <section id="smart-routing" className="section section-alt">
          <div className="section-header">
            <h2>Smart Routing · Weighted Models</h2>
            <p>
              Every generation request goes through the coordinator, which picks a healthy node and
              a compatible live model in real time.
            </p>
          </div>
          <div className="routing-layout">
            <div className="routing-copy">
              <p>
                When a user submits a prompt, the coordinator checks which GPU nodes are online,
                what models they have loaded, and routes the job accordingly:
              </p>
              <ul>
                <li>
                  <strong>Image jobs</strong> — routed to nodes running SDXL models. The coordinator
                  uses weighted random selection so higher-quality models get picked more often.
                </li>
                <li>
                  <strong>Face swap jobs</strong> — sent to nodes with the face-swap pipeline ready,
                  combining SDXL generation with InsightFace.
                </li>
                <li>
                  <strong>Video jobs</strong> — routed to nodes with LTX-Video loaded. These require
                  more VRAM and earn a 2× reward bonus.
                </li>
              </ul>
              <p>
                Models are tiered (S through D) based on output quality. Higher-tier models get
                selected more often and node operators running them earn bigger $HAI rewards per job.
              </p>
            </div>
            <div className="json-card">
              <div className="json-card-label">How routing works</div>
              <pre>
                <code>
                  {`User submits prompt
  → Coordinator checks online nodes
  → Matches job type to capable nodes
  → Picks model by weighted selection
  → Routes job to healthiest node
  → Node generates, returns result
  → Node earns $HAI reward`}
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* REWARDS */}
        <section id="rewards" className="section">
          <div className="section-header">
            <h2>Dynamic $HAI Rewards</h2>
            <p>
              Reward tracking scales with model tier, pipeline cost, and runtime. Better models earn
              more per job.
            </p>
          </div>
          <div className="table-wrapper">
            <table className="rewards-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Weight</th>
                  <th>Multiplier</th>
                  <th>Example Models</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>S</td>
                  <td>20</td>
                  <td>2.0×</td>
                  <td>Top SDXL production models</td>
                </tr>
                <tr>
                  <td>A</td>
                  <td>10</td>
                  <td>1.0×</td>
                  <td>Strong general-purpose models</td>
                </tr>
                <tr>
                  <td>B</td>
                  <td>8</td>
                  <td>0.8×</td>
                  <td>Balanced speed/quality models</td>
                </tr>
                <tr>
                  <td>C</td>
                  <td>5</td>
                  <td>0.5×</td>
                  <td>Specialized or stylized models</td>
                </tr>
                <tr>
                  <td>D</td>
                  <td>3</td>
                  <td>0.3×</td>
                  <td>Experimental/low-priority models</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            SDXL pipelines earn an additional 1.5× compute bonus. Video (LTX2) earns 2.0×. Public
            Alpha reward tracking may continue to evolve as settlement rails mature.
          </p>
        </section>

        {/* LIVE JOBS SNAPSHOT */}
        <section className="section live-section">
          <div className="section-header">
            <h2>Live Jobs Snapshot</h2>
            <p>Recent public jobs flowing through the grid as they complete.</p>
          </div>
          <div className="live-layout">
            <div className="table-wrapper">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Model</th>
                    <th>Reward</th>
                    <th>Status</th>
                    {showLivePreview ? (
                      <th>Preview</th>
                    ) : (
                      <th>Output Type</th>
                    )}
                  </tr>
                </thead>
                <tbody id="jobsTableBody">
                  {liveJobsLoading ? (
                    <tr>
                      <td colSpan={5}>Loading recent jobs…</td>
                    </tr>
                  ) : liveJobs.length ? (
                    liveJobs.slice(0, 10).map((job) => {
                      const id = job.job_id || job.id || "";
                      const model = job.model || "--";
                      const reward =
                        typeof job.reward_hai === "number"
                          ? job.reward_hai.toFixed(6)
                          : typeof job.reward === "number"
                          ? job.reward.toFixed(6)
                          : "--";
                      const status = (job.status || "UNKNOWN").toString().toUpperCase();
                      const previewUrl = resolveAssetUrl(
                        job.image_url || job.preview_url || job.video_url
                      );
                      const outputType =
                        typeof job.task_type === "string" &&
                        job.task_type.toUpperCase().includes("VIDEO")
                          ? "Video"
                          : "Image";
                      const summary: JobSummary = {
                        job_id: job.job_id || job.id,
                        model: job.model,
                        status: job.status,
                        task_type: job.task_type,
                        submitted_at: job.submitted_at,
                        completed_at: job.completed_at,
                        image_url: job.image_url,
                        video_url: job.video_url,
                      };
                      return (
                        <tr
                          key={id}
                          className="jobs-row-clickable"
                          tabIndex={0}
                          role="button"
                          onClick={() => openJobDetails(summary)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openJobDetails(summary);
                            }
                          }}
                        >
                          <td>
                            <code>{id}</code>
                          </td>
                          <td>{model}</td>
                          <td>{reward}</td>
                          <td>{status}</td>
                          {showLivePreview ? (
                            <td>
                              {previewUrl ? (
                                <img
                                  src={previewUrl}
                                  alt={`${id} preview`}
                                  className="jobs-preview-tile"
                                />
                              ) : (
                                <div className="jobs-preview-tile">No preview</div>
                              )}
                            </td>
                          ) : (
                            <td>{outputType}</td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5}>No public jobs are visible yet. This feed updates automatically as new work completes.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="live-summary">
              <h3>Network Pulse</h3>
              <ul>
                <li>
                  <span>Active nodes</span>
                  <strong id="liveActiveNodes">--</strong>
                </li>
                <li>
                  <span>Jobs (24h)</span>
                  <strong id="liveJobs24h">--</strong>
                </li>
                <li>
                  <span>Success rate</span>
                  <strong id="liveSuccessRate">--%</strong>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* JOIN / ALPHA */}
        <section id="join" className="section join-section">
          <div className="join-inner">
            <div className="join-copy">
              <h2>Join Public Alpha</h2>
              <p>
                HavnAI Public Alpha is live for SDXL image generation, face swap, and video whenever
                compatible nodes are online. If you have a capable NVIDIA GPU, you can serve live
                creator traffic, appear on the network dashboard, and build tracked reward history now.
              </p>
              <ul>
                <li>12&nbsp;GB+ NVIDIA GPU (3060 / 3080 / 4090 class).</li>
                <li>Solid upstream bandwidth and uptime.</li>
                <li>Willingness to iterate on configs and report issues.</li>
              </ul>
            </div>
            <div className="join-actions">
              <a href="/join" className="btn primary wide">
                Join the Grid
              </a>
              <a href={`${apiBase}/dashboard`} className="btn tertiary wide">
                View Live Dashboard
              </a>
              <p className="join-note">
                The install guide covers prerequisites, wallet setup, optional operator access
                tokens, video requirements, and service management.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner footer-layout">
          <div className="footer-col footer-col-left">
            <div className="footer-brand">
              <img src="/HavnAI-logo.png" alt="HavnAI" className="footer-logo" />
              <div>
                <div className="footer-brand-name">HavnAI</div>
                <p className="footer-tagline">Public Alpha decentralized GPU network for creators and GPU operators.</p>
              </div>
            </div>
            <p className="footer-copy">&copy; 2025 HavnAI Network</p>
          </div>

          <div className="footer-col footer-col-center">
            <h4>Docs &amp; Code</h4>
            <ul>
              <li>
                <a
                  href="https://github.com/marcusllittle/havnai-core"
                  target="_blank"
                  rel="noreferrer"
                >
                  havnai-core
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/marcusllittle/havnai-node"
                  target="_blank"
                  rel="noreferrer"
                >
                  havnai-node
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/marcusllittle/havnai-web"
                  target="_blank"
                  rel="noreferrer"
                >
                  havnai-web
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col footer-col-right">
            <h4>Contact</h4>
            <a className="footer-email" href="mailto:support@joinhavn.io">
              support@joinhavn.io
            </a>
            <a
              className="footer-patreon-btn"
              href="https://www.patreon.com/cw/u38989793"
              target="_blank"
              rel="noreferrer"
            >
              Exclusive Drops on Patreon
            </a>
          </div>
        </div>
      </footer>
      <JobDetailsDrawer
        open={drawerOpen}
        jobId={drawerJob?.id || drawerSummary?.job_id}
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
    </>
  );
};

export default HomePage;
