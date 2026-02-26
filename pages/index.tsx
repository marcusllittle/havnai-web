import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import { fetchJobWithResult, JobDetailResponse, ResultResponse, resolveAssetUrl } from "../lib/havnai";
import { getApiBase } from "../lib/apiBase";

const HomePage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
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
        <title>HavnAI Network — Own Your Intelligence</title>
        <meta
          name="description"
          content="HavnAI is a decentralized GPU network for AI image generation, face swap, and video jobs when video-capable nodes are online."
        />
        <meta property="og:title" content="HavnAI Network — Own Your Intelligence" />
        <meta
          property="og:description"
          content="A decentralized GPU network for AI image generation, face swap, and video jobs when video-capable nodes are online."
        />
        <meta property="og:type" content="website" />
      </Head>

      <header className="site-header">
        <div className="header-inner">
          <a href="#home" className="brand">
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
            <a href="#home">Home</a>
            <a href="#how">How It Works</a>
            <a href="#smart-routing">Models</a>
            <a href="#rewards">Rewards</a>
            <a href="/test">Generator</a>
            <a href="/library">My Library</a>
            <a href={`${apiBase}/dashboard`} target="_blank" rel="noreferrer">
              Dashboard
            </a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="#join">Join Alpha</a>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section id="home" className="hero">
          <div className="hero-inner">
            <div className="hero-content">
              <p className="hero-kicker">Decentralized GPU Intelligence</p>
              <h1 className="hero-title">OWN YOUR INTELLIGENCE</h1>
              <p className="hero-subtitle">
                A decentralized GPU network for AI creation. Node operators earn{" "}
                <strong>$HAI</strong> by serving SDXL image jobs, SDXL face-swap jobs, and video jobs
                whenever video-capable nodes are online.
              </p>
              <div className="hero-install-note">
                <h3>Join the HavnAI GPU Grid</h3>
                <p>Run this on your GPU machine to install the node:</p>
                <pre>
                  <code>{`curl -fsSL ${installBase}/installers/install-node.sh \n  | bash -s -- --server ${installBase}`}</code>
                </pre>
                <p>
                  Full prerequisites, WAN I2V setup, systemd steps, and troubleshooting live on the
                  coordinator’s install guide.
                </p>
                <a
                  href={`${apiBase}/join`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn tertiary wide"
                >
                  Open full node install guide
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
            <p>From GPU to $HAI rewards in four steps.</p>
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
                Users submit prompts through the Generator. The coordinator picks the best available
                model and sends the job to a healthy node.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">3</div>
              <h3>Your GPU Generates</h3>
              <p>
                Your node runs available models from the live registry and returns outputs. The
                current MVP focuses on SDXL image + face swap, with video jobs routed when LTX2
                capacity is online.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">4</div>
              <h3>Earn $HAI</h3>
              <p>
                Every completed job earns $HAI rewards. Payouts scale with model tier, pipeline cost,
                and runtime.
              </p>
            </article>
          </div>
        </section>

        {/* SMART ROUTING */}
        <section id="smart-routing" className="section section-alt">
          <div className="section-header">
            <h2>Smart Routing · Weighted Models</h2>
            <p>
              Models in the live registry are assigned routing weights. Higher-weight models get
              picked more often and earn bigger rewards.
            </p>
          </div>
          <div className="routing-layout">
            <div className="routing-copy">
              <p>
                When you generate with <strong>auto mode</strong>, the coordinator picks a model using
                weighted random selection. Weights come from our benchmark and scoring pipeline:
              </p>
              <ul>
                <li>Each model is scored on realism, detail, and consistency.</li>
                <li>Scores map to tiers (S, A, B, C, D) with assigned weights.</li>
                <li>Higher-tier models are selected more often and earn more $HAI per job.</li>
              </ul>
              <p>
                The result: the best models get used the most and node operators running them earn the
                highest rewards.
              </p>
            </div>
            <div className="json-card">
              <div className="json-card-label">Live routing weights (from registry)</div>
              <pre>
                <code>
                  {`{
  "top_tier_sdxl_model": 20,
  "mid_tier_sdxl_model": 8,
  "ltx2 (video)": 20
}`}
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
              Rewards scale with model tier, pipeline cost, and runtime. Better models earn more per
              job.
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
            SDXL pipelines earn an additional 1.5× compute bonus. Video (LTX2) earns 2.0×. Longer
            runtimes also scale rewards proportionally.
          </p>
        </section>

        {/* LIVE JOBS SNAPSHOT */}
        <section className="section live-section">
          <div className="section-header">
            <h2>Live Jobs Snapshot</h2>
            <p>Recent public jobs, straight from the grid.</p>
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
                      <td colSpan={5}>No recent public jobs reported yet.</td>
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
              <h2>Join Stage 6 → 7 Alpha</h2>
              <p>
                We are running SDXL image + face-swap workloads and video when compatible nodes are online.
                If you have a capable NVIDIA GPU and want to earn $HAI by powering generation, join the alpha.
              </p>
              <ul>
                <li>12&nbsp;GB+ NVIDIA GPU (3060 / 3080 / 4090 class).</li>
                <li>Solid upstream bandwidth and uptime.</li>
                <li>Willingness to iterate on configs and report issues.</li>
              </ul>
            </div>
            <div className="join-actions">
              <a href="https://joinhavn.io/alpha" className="btn primary wide">
                Join Alpha (Typeform)
              </a>
              <a href={`${apiBase}/dashboard`} className="btn tertiary wide">
                View Live Dashboard
              </a>
              <p className="join-note">
                After joining, you’ll receive updated install + config steps tailored to your GPU and OS.
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
                <p className="footer-tagline">Decentralized GPU network for AI creators.</p>
              </div>
            </div>
            <p className="footer-copy">© 2026 HavnAI Network</p>
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
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default HomePage;
