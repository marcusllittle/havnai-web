import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { AlphaDisclaimer } from "../components/AlphaDisclaimer";

const HomePage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const installCommand =
    "curl -fsSL http://api.joinhavn.io:5001/installers/install-node.sh \\\n  | bash -s -- --server http://api.joinhavn.io:5001";

  const handleCopyInstall = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(installCommand);
        return;
      } catch {
        // fallback below
      }
    }
    if (typeof document === "undefined") return;
    const textarea = document.createElement("textarea");
    textarea.value = installCommand;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch {
      // no-op
    }
    document.body.removeChild(textarea);
  };

  // Client-side behavior for stats, models, jobs, and previews.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const API_BASE =
      (window as any).NEXT_PUBLIC_API_BASE_URL && String((window as any).NEXT_PUBLIC_API_BASE_URL).length > 0
        ? (window as any).NEXT_PUBLIC_API_BASE_URL
        : "/api";

    const heroActiveNodes = document.getElementById("heroActiveNodes");
    const heroJobs24h = document.getElementById("heroJobs24h");
    const heroSuccessRate = document.getElementById("heroSuccessRate");
    const heroTopModel = document.getElementById("heroTopModel");

    const liveActiveNodes = document.getElementById("liveActiveNodes");
    const liveJobs24h = document.getElementById("liveJobs24h");
    const liveSuccessRate = document.getElementById("liveSuccessRate");

    const modelGrid = document.getElementById("modelGrid");
    const jobsTableBody = document.getElementById("jobsTableBody");
    const jobsTableHead = document.getElementById("jobsTableHead");

    if (
      !heroActiveNodes ||
      !heroJobs24h ||
      !heroSuccessRate ||
      !heroTopModel ||
      !liveActiveNodes ||
      !liveJobs24h ||
      !liveSuccessRate ||
      !modelGrid ||
      !jobsTableBody ||
      !jobsTableHead
    ) {
      return;
    }

    const sampleStats = {
      active_nodes: 0,
      jobs_completed_24h: 0,
      success_rate: 0,
      top_model: "—",
      model_registry: [] as any[],
      recent_jobs: [] as any[],
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

    function resolveAssetUrl(path: string | undefined | null): string | undefined {
      if (!path) return undefined;
      if (/^https?:\/\//i.test(path)) return path;
      return `${API_BASE}${path}`;
    }

    function renderModels(registry: any[]) {
      const models = safeArray(registry);
      if (!models.length) {
        modelGrid.innerHTML =
          '<div class="model-card placeholder"><p class="model-name">No models registered yet.</p><p class="model-weight">Weight —</p><p class="model-desc">Once the coordinator exposes the registry, models will appear here automatically.</p></div>';
        return;
      }

      const cards = models
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, 12)
        .map((entry) => {
          const name = entry.name || entry.model || "unnamed-model";
          const weight = entry.weight ?? entry.reward_weight ?? 0;
          const tags = safeArray(entry.tags);
          const description =
            entry.description ||
            (tags.length ? "Tagged: " + tags.join(", ") : "Creator model registered on the grid.");
          const preview = resolveAssetUrl(entry.preview_url) || "/HavnAI-logo.png";
          return `
                <article class="model-card">
                  <div class="model-preview">
                    <img src="${preview}" alt="${name} preview" loading="lazy" />
                  </div>
                  <div class="model-body">
                    <h3 class="model-name">${name}</h3>
                    <p class="model-weight">Weight: <strong>${weight}</strong></p>
                    <p class="model-desc">${description}</p>
                    ${
                      tags.length
                        ? `<div class="model-tags">${tags
                            .slice(0, 4)
                            .map((t: string) => `<span class="tag">${t}</span>`)
                            .join("")}</div>`
                        : ""
                    }
                  </div>
                </article>
              `;
        })
        .join("");

      modelGrid.innerHTML = cards;
    }

    function getPreviewInfo(job: any) {
      const rawVideoUrl = job.video_url || job.videoUrl || "";
      const rawImageUrl =
        job.image_url ||
        job.imageUrl ||
        job.preview_url ||
        job.output_url ||
        job.thumb_url ||
        "";
      const videoUrl = resolveAssetUrl(rawVideoUrl) || "";
      const imageUrl = resolveAssetUrl(rawImageUrl) || "";
      const previewUrl = videoUrl || imageUrl;
      const previewType = videoUrl ? "video" : imageUrl ? "image" : "none";
      return { previewUrl, previewType };
    }

    function getOutputLabel(job: any) {
      if (job.video_url) return "Video";
      if (job.image_url || job.preview_url) return "Image";
      const status = (job.status || "").toString().toUpperCase();
      if (status === "SUCCESS" || status === "COMPLETED") return "Ready";
      return "N/A";
    }

    function renderJobs(jobs: any[]) {
      const list = safeArray(jobs);
      if (!list.length) {
        jobsTableBody.innerHTML =
          '<tr><td colspan="5">No public jobs yet. Create something in the Generator to see it here.</td></tr>';
        jobsTableHead.innerHTML = `
            <tr>
              <th>Job</th>
              <th>Model</th>
              <th>Reward (Simulated)</th>
              <th>Status</th>
              <th>Output</th>
            </tr>
          `;
        return;
      }

      const hasPreview = list.some((job) => Boolean(getPreviewInfo(job).previewUrl));
      jobsTableHead.innerHTML = hasPreview
        ? `
            <tr>
              <th>Job</th>
              <th>Model</th>
              <th>Reward (Simulated)</th>
              <th>Status</th>
              <th>Preview</th>
            </tr>
          `
        : `
            <tr>
              <th>Job</th>
              <th>Model</th>
              <th>Reward (Simulated)</th>
              <th>Status</th>
              <th>Output</th>
            </tr>
          `;

      const rows = list
        .slice(0, 10)
        .map((job) => {
          const id = job.job_id || job.id || "—";
          const model = job.model || "—";
          const reward =
            typeof job.reward_hai === "number"
              ? job.reward_hai.toFixed(6)
              : typeof job.reward === "number"
              ? job.reward.toFixed(6)
              : "—";
          const status = (job.status || "UNKNOWN").toString().toUpperCase();
          const { previewUrl, previewType } = getPreviewInfo(job);
          const preview = hasPreview
            ? `<button class="preview-thumb${previewUrl ? "" : " is-empty"}" data-preview="${previewUrl}" data-preview-type="${previewType}" aria-label="Open preview for ${id}">
                    ${
                      previewUrl
                        ? previewType === "video"
                          ? `<video src="${previewUrl}" muted playsinline preload="metadata" onerror="this.closest('.preview-thumb').setAttribute('data-missing','1'); this.remove();"></video>`
                          : `<img src="${previewUrl}" alt="${id} preview" loading="lazy" onerror="this.closest('.preview-thumb').setAttribute('data-missing','1'); this.remove();" />`
                        : ""
                    }
                    <div class="preview-empty"><span>⧗</span><small>No preview</small></div>
                  </button>`
            : getOutputLabel(job);
          return `
                <tr>
                  <td><code>${id}</code></td>
                  <td>${model}</td>
                  <td>${reward || "—"}</td>
                  <td>${status}</td>
                  <td>${preview}</td>
                </tr>
              `;
        })
        .join("");

      jobsTableBody.innerHTML = rows;
    }

    async function loadStats() {
      try {
        const res = await fetch(`${API_BASE}/models/stats`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("stats HTTP " + res.status);
        const data = await res.json();
        renderStats(data);
        renderModels(data.model_registry || data.models || []);
        renderJobs(data.recent_jobs || []);
      } catch (err) {
        console.error("Failed to load /models/stats", err);
        renderStats(sampleStats);
        renderModels(sampleStats.model_registry);
        renderJobs(sampleStats.recent_jobs);
      }
    }

    loadStats();
    const intervalId = window.setInterval(loadStats, 15000);

    const body = document.body;

    function ensureLightbox(): HTMLElement {
      let lb = document.getElementById("lightbox") as HTMLElement | null;
      if (!lb) {
        lb = document.createElement("div");
        lb.id = "lightbox";
        lb.className = "lightbox hidden";
        lb.innerHTML =
          '<div class="lightbox-backdrop"></div><div class="lightbox-content"><img alt="Preview" /><video controls playsinline></video><button class="lightbox-close" aria-label="Close preview">×</button></div>';
        body.appendChild(lb);
        lb.addEventListener("click", (evt) => {
          const target = evt.target as HTMLElement | null;
          if (!target) return;
          if (
            target === lb ||
            target.classList.contains("lightbox-backdrop") ||
            target.classList.contains("lightbox-close")
          ) {
            const video = lb!.querySelector("video") as HTMLVideoElement | null;
            if (video) {
              video.pause();
              video.removeAttribute("src");
              video.load();
            }
            lb!.classList.add("hidden");
          }
        });
      }
      return lb;
    }

    const jobsClickHandler = (evt: Event) => {
      const target = evt.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest(".preview-thumb") as HTMLElement | null;
      if (!btn) return;
      if (btn.getAttribute("data-missing") === "1") return;
      const src = btn.getAttribute("data-preview");
      if (!src) return;
      const previewType = btn.getAttribute("data-preview-type") || "";
      const lb = ensureLightbox();
      const img = lb.querySelector("img");
      const video = lb.querySelector("video");
      if (!img || !video) return;
      if (previewType === "video" || src.toLowerCase().endsWith(".mp4")) {
        (video as HTMLVideoElement).src = src;
        (video as HTMLVideoElement).style.display = "block";
        (img as HTMLImageElement).style.display = "none";
      } else {
        (img as HTMLImageElement).src = src;
        (img as HTMLImageElement).style.display = "block";
        (video as HTMLVideoElement).pause();
        (video as HTMLVideoElement).removeAttribute("src");
        (video as HTMLVideoElement).load();
        (video as HTMLVideoElement).style.display = "none";
      }
      lb.classList.remove("hidden");
    };

    jobsTableBody.addEventListener("click", jobsClickHandler);

    return () => {
      jobsTableBody.removeEventListener("click", jobsClickHandler);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <Head>
        <title>HavnAI Network — Own Your Intelligence</title>
        <meta
          name="description"
          content="Create images and videos on the HavnAI grid. Stage 7 Alpha for creators."
        />
        <meta property="og:title" content="HavnAI Network — Own Your Intelligence" />
        <meta
          property="og:description"
          content="Create images and videos on the HavnAI grid. Creator-first Stage 7 Alpha."
        />
        <meta property="og:type" content="website" />
      </Head>

      <header className="site-header">
        <div className="header-inner">
          <a href="#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Stage 7 — Alpha</span>
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
            <a href="/generator" className="nav-primary">Generator</a>
            <a href="#home">Home</a>
            <a href="#how">How It Works</a>
            <a href="#models">Models</a>
            <a href="#smart-routing" className="nav-secondary">Smart Routing</a>
            <a href="#rewards" className="nav-secondary">Rewards</a>
            <a href="http://api.joinhavn.io:5001/dashboard" target="_blank" rel="noreferrer">
              Network Dashboard (Alpha)
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
              <span className="stage-badge">Stage 7 — Alpha</span>
              <p className="hero-kicker">Creator-first grid</p>
              <h1 className="hero-title">Create images &amp; videos on the HavnAI grid.</h1>
              <p className="hero-subtitle">
                Prompt → Generate → Preview → Download. Ship visuals fast while the network quietly
                handles routing, scheduling, and GPU execution behind the scenes.
              </p>
              <div className="hero-cta">
                <a className="btn primary btn-lg" href="/generator">
                  Create Now
                </a>
                <a className="btn secondary btn-lg" href="#join">
                  Run a Node (Alpha)
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
                Backed by <code>/api/models/stats</code> from the live coordinator.
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="section">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>From prompt to output in four creator-friendly steps.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <div className="step-icon">1</div>
              <h3>Write a prompt</h3>
              <p>
                Pick Image, Face Swap, or Video. Add advanced settings if you want full control.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">2</div>
              <h3>Generate on the grid</h3>
              <p>
                The coordinator routes your job to healthy GPU nodes and tracks progress in real time.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">3</div>
              <h3>Preview instantly</h3>
              <p>
                Watch status updates, then preview your output and download when it’s ready.
              </p>
            </article>
            <article className="step-card">
              <div className="step-icon">4</div>
              <h3>Network economics (Alpha)</h3>
              <p>
                Routing weights and rewards are simulated during Stage 7 Alpha to validate the network
                design.
              </p>
            </article>
          </div>
        </section>

        {/* SMART ROUTING */}
        <section id="smart-routing" className="section section-alt">
          <div className="section-header">
            <h2>Network Details · Smart Routing</h2>
            <p>
              Identical prompts, benchmark scores, and a registry-backed weight for every creator model.
            </p>
            <AlphaDisclaimer />
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
            <h2>Rewards (Simulated — Alpha)</h2>
            <p>Weight tiers drive multipliers in Alpha simulations.</p>
            <AlphaDisclaimer />
          </div>
          <div className="table-wrapper">
            <table className="rewards-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Weight (Simulated)</th>
                  <th>Reward Multiplier</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>5</td>
                  <td>77</td>
                  <td>2.0×</td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>70</td>
                  <td>1.7×</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>55</td>
                  <td>1.3×</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>50</td>
                  <td>1.1×</td>
                </tr>
                <tr>
                  <td>1</td>
                  <td>45</td>
                  <td>1.0×</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* MODEL SHOWCASE */}
        <section id="models" className="section section-alt">
          <div className="section-header">
            <h2>Live Model Catalog</h2>
            <p>
              Models, weights, and tags pulled directly from the coordinator via{" "}
              <code>/api/models/stats</code>.
            </p>
            <AlphaDisclaimer message="Model weights are simulated in Alpha; payouts are not active yet." />
          </div>
          <div className="model-grid" id="modelGrid">
            <div className="model-card placeholder">
              <p className="model-name">Loading models…</p>
              <p className="model-weight">Weight —</p>
              <p className="model-desc">
                Once the coordinator responds, you’ll see the live registry here.
              </p>
            </div>
          </div>
        </section>

        {/* LIVE JOBS SNAPSHOT */}
        <section className="section live-section">
          <div className="section-header">
            <h2>Live Jobs Snapshot</h2>
            <p>Recent public jobs, straight from the grid.</p>
            <AlphaDisclaimer message="Reward totals are simulated in Alpha and are informational only." />
          </div>
          <div className="live-layout">
            <div className="table-wrapper">
              <table className="jobs-table">
                <thead id="jobsTableHead">
                  <tr>
                    <th>Job</th>
                    <th>Model</th>
                    <th>Reward (Simulated)</th>
                    <th>Status</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody id="jobsTableBody">
                  <tr>
                    <td colSpan={5}>Waiting for recent jobs from /api/models/stats…</td>
                  </tr>
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
              <h2>Join Stage 7 — Alpha</h2>
              <p>
                We are validating creator workflows, weighted routing, and the reward engine across a
                small set of GPUs before opening the grid. If you are comfortable running bleeding-edge AI
                infra, we want you in the loop.
              </p>
              <ul>
                <li>Linux (Ubuntu/Debian/RHEL) or macOS 12+ with Python 3.10+ and curl.</li>
                <li>NVIDIA GPU + drivers; 12&nbsp;GB+ recommended for creator/video workloads.</li>
                <li>EVM wallet address (simulated rewards in Alpha).</li>
                <li>Solid upstream bandwidth and willingness to iterate on configs.</li>
              </ul>
            </div>
            <div className="join-actions">
              <a href="https://joinhavn.io/alpha" className="btn primary wide">
                Join Alpha (Typeform)
              </a>
              <a href="http://api.joinhavn.io:5001/dashboard" className="btn tertiary wide">
                View Network Dashboard (Alpha)
              </a>
              <p className="join-note">
                After joining, you’ll receive updated install + config steps tailored to your GPU and OS.
              </p>
              <details className="operator-panel" id="run-node">
                <summary>
                  <span className="operator-title">Operator Setup (Alpha)</span>
                  <span className="operator-subtitle">
                    Advanced users only. Run a GPU node to help process jobs and test the network.
                  </span>
                </summary>
                <div className="operator-body">
                  <p>Run this on your GPU machine to install the node:</p>
                  <pre>
                    <code>{installCommand}</code>
                  </pre>
                  <p className="operator-hint">
                    If you have a join token, append <code>--token &lt;TOKEN&gt;</code>. To prefill a wallet,
                    add <code>--wallet 0x...</code>.
                  </p>
                  <button
                    type="button"
                    className="btn secondary wide operator-copy"
                    onClick={handleCopyInstall}
                  >
                    Copy command
                  </button>
                  <p className="operator-warning">Early access software. Expect breaking changes.</p>
                  <p>
                    Full prerequisites, systemd steps, and troubleshooting live on the coordinator’s
                    install guide.
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
              </details>
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
            <p className="footer-copy">© 2025 HavnAI Network</p>
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
    </>
  );
};

export default HomePage;
