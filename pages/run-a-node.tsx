import type { NextPage } from "next";
import Link from "next/link";
import { useState } from "react";
import { CinematicPageHero } from "../components/CinematicPageHero";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { getApiBase } from "../lib/apiBase";

const reasons = [
  "Put idle GPU capacity to work serving real image, face swap, and video jobs.",
  "Earn visibility and reward attribution as operator activity flows through the network.",
  "Help expand creation capacity for JoinHavn, Astra, and the public generator stack.",
];

const setupSteps = [
  {
    title: "Run the installer",
    body: "Install the node runtime, pull the client, and set up the working environment on your GPU machine.",
  },
  {
    title: "Connect your wallet",
    body: "Attach the wallet address used for Public Alpha reward attribution and future settlement flows.",
  },
  {
    title: "Start serving jobs",
    body: "Bring the node online, confirm it appears on the network, and begin accepting routed generation work.",
  },
];

const faqs = [
  {
    q: "What hardware do I need to run a JoinHavn node?",
    a: "A 64-bit Linux or macOS machine with Python 3.10+, stable internet, and ideally an NVIDIA GPU with at least 12 GB VRAM. CPU-only nodes can run, but GPU nodes are the practical target for meaningful throughput.",
  },
  {
    q: "Can I run video jobs too?",
    a: "Yes. Nodes with 16 GB+ VRAM can opt into video generation workloads. Those jobs are heavier, but they carry stronger weighting during Public Alpha routing and reward tuning.",
  },
  {
    q: "Do I need a wallet?",
    a: "Yes, if you want operator activity attributed correctly. The wallet is used for Public Alpha reward tracking and is expected to stay part of the network identity model going forward.",
  },
  {
    q: "How do I know my node is online?",
    a: "After install, check the Nodes page or the coordinator dashboard. If the process is healthy and can reach the coordinator, your operator should appear there as online.",
  },
];

const RunANodePage: NextPage = () => {
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

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Run a GPU node on JoinHavn",
      url: "https://joinhavn.io/run-a-node",
      description:
        "Install a JoinHavn GPU node, connect your wallet, and serve image and video generation jobs across the network.",
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to run a JoinHavn GPU node",
      description: "Install the node client, configure your wallet, and bring your machine online on the JoinHavn network.",
      step: setupSteps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.body,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    },
  ];

  return (
    <>
      <SeoHead
        title="Run a GPU node and earn on the JoinHavn network"
        description="Install a JoinHavn GPU node, connect your wallet, and serve AI image and video jobs across the network with live operator visibility."
        path="/run-a-node"
        image="/astra/scenes/spaceport_hub.png"
        imageAlt="JoinHavn run-a-node preview with network-themed sci-fi artwork"
        schema={schema}
      />

      <SiteHeader />

      <main className="library-page jh-page-shell">
        <CinematicPageHero
          eyebrow="Run a Node"
          title="Put your GPU on the JoinHavn network."
          description="Install the node client, bring your machine online, and serve real AI image and video generation jobs for the JoinHavn ecosystem."
          mediaVariant="join"
          panelEyebrow="Operator Flow"
          panelTitle="Install fast. Show up live. Start serving jobs."
          panelDescription="The node path is built for operators who want a straightforward install, live visibility, and a real role in the creation network."
          stats={[
            {
              label: "GPU",
              value: "12 GB+",
              detail: "Recommended for image workloads",
            },
            {
              label: "Video",
              value: "16 GB+",
              detail: "Recommended for heavier video jobs",
            },
            {
              label: "Runtime",
              value: "Python 3.10+",
              detail: "Linux or macOS, 64-bit",
            },
          ]}
          actions={
            <>
              <a href="#quick-install" className="jh-btn jh-btn-primary">
                View Install Command
              </a>
              <Link href="/nodes" className="jh-btn jh-btn-secondary">
                See Live Nodes
              </Link>
            </>
          }
        />

        <section className="page-container">
          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">Why run a node</h2>
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-muted)", lineHeight: 1.75 }}>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="chart-section" id="quick-install">
            <div className="chart-header">
              <h2 className="chart-title">Quick install</h2>
            </div>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.7 }}>
              Run this on the machine that will serve jobs. It pulls the installer, sets up the runtime,
              and registers the node against the JoinHavn coordinator.
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
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.75rem", lineHeight: 1.6 }}>
              Optional flags: <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>--token TOKEN</code> if
              you were issued operator access, and <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px" }}>--wallet 0x...</code> to
              prefill the wallet used for operator attribution.
            </p>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">What you need</h2>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Requirement</th><th>Details</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Operating system</td>
                    <td>64-bit Linux or macOS</td>
                  </tr>
                  <tr>
                    <td>Python</td>
                    <td>Python 3.10 or newer</td>
                  </tr>
                  <tr>
                    <td>GPU</td>
                    <td>NVIDIA GPU with 12 GB+ VRAM recommended for image jobs. 16 GB+ VRAM recommended for video workloads.</td>
                  </tr>
                  <tr>
                    <td>Disk</td>
                    <td>Roughly 20 GB free for models, environment setup, and cache.</td>
                  </tr>
                  <tr>
                    <td>Network</td>
                    <td>Stable internet and outbound access to the coordinator.</td>
                  </tr>
                  <tr>
                    <td>Wallet</td>
                    <td>An EVM-compatible wallet address for Public Alpha operator attribution.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">Setup flow</h2>
            </div>
            <div className="gallery-grid" style={{ marginTop: "1rem" }}>
              {setupSteps.map((step, index) => (
                <article key={step.title} className="output-card">
                  <div className="history-meta">Step {index + 1}</div>
                  <h3 style={{ marginTop: "0.4rem" }}>{step.title}</h3>
                  <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 0 }}>{step.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">Post-install commands</h2>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>1. Set your wallet</strong></p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# ~/.havnai/.env\nWALLET=0xYourWalletAddressHere`}</code>
              </pre>

              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>2. Add operator access if issued</strong></p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# ~/.havnai/.env\nJOIN_TOKEN=your-token-here`}</code>
              </pre>

              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>3. Start the node</strong></p>
              <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# Linux\nsystemctl --user start havnai-node\nsystemctl --user enable havnai-node\n\n# Or run directly\ncd ~/.havnai && ./venv/bin/python havnai_client.py`}</code>
              </pre>

              <p>
                Then confirm status on the <Link href="/nodes" style={{ color: "var(--accent)" }}>Nodes</Link> page or the{" "}
                <a href={`${apiBase}/dashboard`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>coordinator dashboard</a>.
              </p>
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">Optional video setup</h2>
            </div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              If your machine has 16 GB+ VRAM, you can take on video jobs too. These are heavier than image generations,
              but they matter more to network capacity and usually carry stronger reward weighting during Public Alpha.
            </p>
            <pre style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginTop: "1rem" }}>
              <code>{`cd ~/.havnai && ./venv/bin/python havnai_client.py --preload-video`}</code>
            </pre>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">FAQ</h2>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {faqs.map((faq) => (
                <article key={faq.q} className="output-card">
                  <h3 style={{ marginTop: 0 }}>{faq.q}</h3>
                  <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 0 }}>{faq.a}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">See the network live</h2>
            </div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "1rem" }}>
              Once your machine is online, it becomes part of the visible JoinHavn operator layer. You can track node presence,
              capacity, and activity from the public-facing network pages.
            </p>
            <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
              <Link href="/nodes" className="jh-btn jh-btn-primary">View Nodes</Link>
              <Link href="/create" className="jh-btn jh-btn-secondary">Open Generator</Link>
              <Link href="/astra" className="jh-btn jh-btn-tertiary">See Astra</Link>
            </div>
            <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <Link href="/how-it-works" className="jh-btn jh-btn-secondary">How It Works</Link>
              <Link href="/ownership" className="jh-btn jh-btn-secondary">Ownership</Link>
              <Link href="/pricing" className="jh-btn jh-btn-tertiary">Credits & Pricing</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default RunANodePage;
