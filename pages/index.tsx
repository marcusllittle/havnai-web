import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import { fetchJobWithResult, JobDetailResponse, ResultResponse } from "../lib/havnai";

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

  const getApiBase = (): string => {
    if (typeof window !== "undefined") {
      const runtimeBase = (window as any).NEXT_PUBLIC_API_BASE_URL;
      if (runtimeBase && String(runtimeBase).length > 0) {
        return runtimeBase;
      }
    }
    return "/api";
  };

  const resolveAssetUrl = (path: string | undefined | null): string | undefined => {
    if (!path) return undefined;
    if (/^https?:\/\//i.test(path)) return path;
    return `${getApiBase()}${path}`;
  };

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
          content="HavnAI is a decentralized GPU network where creators earn $HAI running AI models."
        />
        <meta property="og:title" content="HavnAI Network — Own Your Intelligence" />
        <meta
          property="og:description"
          content="A decentralized GPU network with weighted model routing and dynamic $HAI rewards."
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
            <a href="#smart-routing">Smart Routing</a>
            <a href="#rewards">Rewards</a>
            <a href="/test">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing">Buy Credits</a>
            <a href="http://api.joinhavn.io:5001/dashboard" target="_blank" rel="noreferrer">
              Dashboard
            </a>
            <a href="#join">Join Alpha</a>
            <a
              href="https://www.patreon.com/cw/u38989793"
              target="_blank"
              rel="noreferrer"
              className="nav-patreon"
            >
              Patreon
            </a>
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
                A decentralized GPU network where creators earn <strong>$HAI</strong> running AI models.
                Weighted routing, benchmark-driven model tiers, and live rewards.
              </p>
              <div className="hero-install-note">
                <h3>Join the HavnAI GPU Grid</h3>
                <p>Run this on your GPU machine to install the node:</p>
                <pre>
                  <code>
                    curl -fsSL http://api.joinhavn.io:5001/installers/install-node.sh \
                    {`\n  | bash -s -- --server http://api.joinhavn.io:5001`}
                  </code>
                </pre>
                <p>
                  Full prerequisites, WAN I2V setup, systemd steps, and troubleshooting live on the
                  coordinator’s install guide.
                </p>
                <a
                  href="http://api.joinhavn.io:5001/join"
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
            <p>From GPU to $HAI rewards in four concrete steps.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <div className="step-icon">1</div>
              <h3>Connect Your GPU Node</h3>
              <p>
                Point the HavnAI node client at the coordinator, set your wallet, and enable{" "}
                <code>CREATOR_MODE</code> to accept image/video jobs.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">2</div>
              <h3>Receive AI Jobs</h3>
              <p>
                The coordinator queues jobs submitted to <code>/submit-job</code> and assigns them only to
                compatible, healthy nodes.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">3</div>
              <h3>Run Models with Weighted Routing</h3>
              <p>
                Models are chosen with weighted random routing, favoring higher-tier, benchmarked
                checkpoints.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">4</div>
              <h3>Earn $HAI Automatically</h3>
              <p>
                Each completed job records runtime, model weight, and quality tier to scale your $HAI
                rewards.
              </p>
            </article>
          </div>
        </section>

        {/* SMART ROUTING */}
        <section id="smart-routing" className="section section-alt">
          <div className="section-header">
            <h2>Smart Routing · Weighted Models</h2>
            <p>
              Identical prompts, benchmark scores, and a registry-backed weight for every creator model.
            </p>
          </div>
          <div className="routing-layout">
            <div className="routing-copy">
              <p>
                When a user hits <code>/submit-job</code> with <code>"model": "auto"</code>, the coordinator
                selects a model using weighted random routing. Weights are derived from a benchmark →
                scoring → registry workflow:
              </p>
              <ul>
                <li>Standardized prompts per domain (realism, anime, motion, text).</li>
                <li>Rubric scoring → tier assignment (Tier 5 → Tier 1).</li>
                <li>Tier ↔ target weight ↔ reward multiplier.</li>
              </ul>
              <p>
                The result: more reliable, higher-quality models are chosen more often and rewarded more
                aggressively in $HAI.
              </p>
            </div>
            <div className="json-card">
              <div className="json-card-label">Example routing weights</div>
              <pre>
                <code>
                  {`{
  "juggernautxl_ragnarokby": 77,
  "majicmixRealistic_v7": 70,
  "lazymixRealAmateur_v40": 55,
  "perfectdeliberate_v5SD15": 50,
  "epicrealismxl_vxviicrystalclear": 45
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
            <p>Weight tiers drive multipliers. Better models, bigger payouts.</p>
          </div>
          <div className="table-wrapper">
            <table className="rewards-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Routing Weight</th>
                  <th>Reward Multiplier</th>
                  <th>Example Model</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>5</td>
                  <td>77</td>
                  <td>2.0×</td>
                  <td>juggernautXL</td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>70</td>
                  <td>1.7×</td>
                  <td>majicmix</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>55</td>
                  <td>1.3×</td>
                  <td>lazymix</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>50</td>
                  <td>1.1×</td>
                  <td>deliberate</td>
                </tr>
                <tr>
                  <td>1</td>
                  <td>45</td>
                  <td>1.0×</td>
                  <td>epicrealism</td>
                </tr>
              </tbody>
            </table>
          </div>
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
                      <td colSpan={5}>Waiting for recent jobs from /jobs/recent…</td>
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
                We are validating weighted routing, benchmark-driven tiers, and the reward engine across a
                small set of GPUs before opening the grid. If you are comfortable running bleeding-edge AI
                infra, we want you in the loop.
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
              <a href="http://api.joinhavn.io:5001/dashboard" className="btn tertiary wide">
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
