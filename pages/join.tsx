import type { NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import { getApiBase } from "../lib/apiBase";

const JoinPage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const apiBase = getApiBase();

  const getInstallBase = (): string => {
    const configuredBase = getApiBase();
    if (/^https?:\/\//i.test(configuredBase)) return configuredBase;
    return `https://joinhavn.io${configuredBase.startsWith("/") ? "" : "/"}${configuredBase}`;
  };
  const installBase = getInstallBase();
  const installCmd = `curl -fsSL ${installBase}/installers/install-node.sh | bash -s -- --server ${installBase}`;

  const copyCmd = () => {
    navigator.clipboard.writeText(installCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <Head>
        <title>Join the HavnAI GPU Grid</title>
        <meta name="description" content="Full install guide for joining the HavnAI decentralized GPU network. Prerequisites, setup, and troubleshooting." />
      </Head>

      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Public Beta</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button type="button" className={`nav-toggle ${navOpen ? "nav-open" : ""}`} aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
            <span /><span />
          </button>
          <nav className={`nav-links ${navOpen ? "nav-open" : ""}`} onClick={() => setNavOpen(false)}>
            <a href="/#home">Home</a>
            <a href="/generator">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="/join" className="nav-active">Join</a>
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Join the Grid</p>
            <h1 className="hero-title">Install a HavnAI Node</h1>
            <p className="hero-subtitle">
              Connect your GPU to the decentralized network and start earning $HAI for every
              generation job you complete.
            </p>
          </div>
        </section>

        <section className="page-container">
          {/* Quick install */}
          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Quick Install</h3>
            </div>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.6 }}>
              Run this single command on your GPU machine. It downloads the installer, sets up a
              Python virtual environment, and registers your node with the coordinator.
            </p>
            <div style={{ position: "relative" }}>
              <pre style={{ padding: "1rem", borderRadius: "12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.85rem", lineHeight: 1.5 }}>
                <code>{installCmd}</code>
              </pre>
              <button
                type="button"
                onClick={copyCmd}
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                  color: copied ? "#8ff0b6" : "var(--text-muted)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
              Optional flags: <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>--token TOKEN</code> if
              your coordinator requires one, and <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>--wallet 0x...</code> to
              pre-fill your reward address.
            </p>
          </div>

          {/* Prerequisites */}
          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Prerequisites</h3>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Requirement</th><th>Details</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Operating System</td>
                    <td>64-bit Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+) or macOS 12+</td>
                  </tr>
                  <tr>
                    <td>Python</td>
                    <td>Python 3.10 or newer</td>
                  </tr>
                  <tr>
                    <td>GPU (recommended)</td>
                    <td>NVIDIA GPU with 12 GB+ VRAM (RTX 3060, 3080, 4090 class). CUDA drivers must be installed. CPU-only nodes are supported but earn less.</td>
                  </tr>
                  <tr>
                    <td>Disk Space</td>
                    <td>~20 GB free for models, venv, and cache</td>
                  </tr>
                  <tr>
                    <td>Network</td>
                    <td>Stable internet with decent upstream bandwidth. The node pulls jobs from and pushes results to the coordinator.</td>
                  </tr>
                  <tr>
                    <td>Wallet</td>
                    <td>An EVM-compatible wallet address (e.g. MetaMask). Rewards are tracked against this address (simulated during beta).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* What the installer does */}
          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">What the Installer Does</h3>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>Creates <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>~/.havnai</code> directory for all node files</li>
                <li>Sets up a Python virtual environment at <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>~/.havnai/venv</code></li>
                <li>Downloads the node client and model registry from the coordinator</li>
                <li>Installs Python dependencies (PyTorch, diffusers, etc.)</li>
                <li>Creates a <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>~/.havnai/.env</code> config file where you set your wallet and token</li>
                <li>Optionally sets up a systemd service (Linux) or launchd agent (macOS) so your node runs on boot</li>
              </ol>
            </div>
          </div>

          {/* Post-install config */}
          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Post-Install Configuration</h3>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <p style={{ marginBottom: "0.75rem" }}>After the installer finishes, configure your node:</p>
              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>1. Set your wallet address</strong></p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# Edit ~/.havnai/.env\nWALLET=0xYourWalletAddressHere`}</code>
              </pre>
              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>2. Set the join token (if required)</strong></p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# In ~/.havnai/.env\nJOIN_TOKEN=your-token-here`}</code>
              </pre>
              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>3. Start the node</strong></p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# Start via systemd (Linux)\nsystemctl --user start havnai-node\nsystemctl --user enable havnai-node  # start on boot\n\n# Or run directly\ncd ~/.havnai && ./venv/bin/python havnai_client.py`}</code>
              </pre>
              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>4. Verify your node is online</strong></p>
              <p>
                Check the <a href="/nodes" style={{ color: "var(--accent)" }}>Nodes</a> page or
                the <a href={`${apiBase}/dashboard`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Dashboard</a> to
                confirm your node appears as online.
              </p>
            </div>
          </div>

          {/* Video / WAN I2V setup */}
          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Video Generation Setup (Optional)</h3>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <p style={{ marginBottom: "0.75rem" }}>
                If your GPU has 16 GB+ VRAM, you can run video generation jobs using LTX-Video.
                Video jobs earn a 2× reward bonus.
              </p>
              <p style={{ marginBottom: "0.5rem" }}>
                The node client automatically downloads video models when it first receives a video
                job, or you can pre-download them:
              </p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`cd ~/.havnai && ./venv/bin/python havnai_client.py --preload-video`}</code>
              </pre>
              <p>
                Video-capable nodes appear with an LTX badge on the <a href="/nodes" style={{ color: "var(--accent)" }}>Nodes</a> page.
              </p>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Troubleshooting</h3>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Issue</th><th>Solution</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Node shows offline</td>
                    <td>Check that the node process is running and can reach the coordinator. Verify your firewall allows outbound HTTPS.</td>
                  </tr>
                  <tr>
                    <td>CUDA out of memory</td>
                    <td>Close other GPU processes. For video jobs, you need 16 GB+ VRAM free. Stick to image jobs on 12 GB cards.</td>
                  </tr>
                  <tr>
                    <td>Python version error</td>
                    <td>The node requires Python 3.10+. Run <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>python3 --version</code> to check.</td>
                  </tr>
                  <tr>
                    <td>Permission denied</td>
                    <td>Don't run the installer as root. It installs to your home directory (<code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>~/.havnai</code>).</td>
                  </tr>
                  <tr>
                    <td>Jobs failing</td>
                    <td>Check logs at <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>~/.havnai/logs/</code>. Common causes: model download interrupted, low disk space, or stale venv.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Contact */}
          <div className="chart-section" style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Need help or a join token? Reach out:
            </p>
            <a href="mailto:support@joinhavn.io" className="job-action-button" style={{ textDecoration: "none", display: "inline-block" }}>
              support@joinhavn.io
            </a>
          </div>
        </section>
      </main>
    </>
  );
};

export default JoinPage;
