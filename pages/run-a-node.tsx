import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Cpu, Terminal } from "lucide-react";
import { NetworkNavigation } from "../components/NetworkNavigation";
import { NodeAppDownload } from "../components/NodeAppDownload";
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
    body: "Installs the full node runtime — image, face swap and video modules — plus the Python environment and a supervised service.",
  },
  {
    title: "Download model weights",
    body: "Checkpoints are the bulk of the download. Open-license weights come from Hugging Face; the rest stream from the coordinator.",
  },
  {
    title: "Verify with the preflight check",
    body: "havnai-doctor reports exactly what your machine can serve and what is blocking anything it cannot. Run it before going online.",
  },
  {
    title: "Start serving jobs",
    body: "Bring the node online, confirm it appears on the network, and begin accepting routed generation work.",
  },
];

const faqs = [
  {
    q: "What hardware do I need to run a JoinHavn node?",
    a: "A 64-bit Linux or macOS machine with Python 3.10+, stable internet, and ideally an NVIDIA GPU with at least 12 GB VRAM. On Windows, use the desktop app, or WSL2 for the terminal installer. CPU-only nodes can run, but GPU nodes are the practical target for meaningful throughput.",
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
  {
    q: "How do I know my node can actually serve the jobs it accepts?",
    a: "Run ~/.havnai/bin/havnai-doctor. It reports image, face swap and video readiness separately, checking dependencies, GPU and CUDA, model weights and coordinator reachability, and prints a fix for anything blocking. The installer runs it automatically as its final step.",
  },
  {
    q: "Where do the model weights come from?",
    a: "Each model in the registry declares its source. Open-license weights are pulled from the Hugging Face CDN, weights the grid hosts stream from the coordinator using your join token, and a small number carry restricted licences you supply yourself — havnai-fetch-models names the exact file and directory for those. Downloads resume where they left off and are checksummed before use.",
  },
  {
    q: "Is there a version I can use without the terminal?",
    a: "Yes. A desktop app wraps the same tooling: it installs the node, shows the preflight results, downloads weights with progress, and starts and stops the node.",
  },
];

const RunANodePage: NextPage = () => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const apiBase = getApiBase();

  const getInstallBase = (): string => {
    const configuredBase = getApiBase();
    if (/^https?:\/\//i.test(configuredBase)) return configuredBase;
    return `https://joinhavn.io${configuredBase.startsWith("/") ? "" : "/"}${configuredBase}`;
  };

  const installBase = getInstallBase();
  const installCmd = `curl -fsSL ${installBase}/installers/install-node.sh | bash -s -- --server ${installBase}`;

  const copyCmd = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(installCmd);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy is unavailable in this browser. Select and copy the command below.");
    }
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

      <main className="network-page node-setup-page">
        <header className="network-heading"><div><span className="network-eyebrow"><Cpu size={15} aria-hidden="true" /> Run a node</span><h1>Put your GPU to work.</h1><p>Help power image, face swap, and video creation. Start with the desktop app or install directly from your terminal.</p></div><Link href="/nodes" className="network-secondary">See the network <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
        <NetworkNavigation active="run-a-node" />
        <div className="setup-install-grid">
          <NodeAppDownload />
          <section className="network-panel setup-terminal" id="quick-install" aria-labelledby="terminal-title">
            <span className="network-eyebrow"><Terminal size={15} aria-hidden="true" /> Terminal setup</span>
            <h2 id="terminal-title">One command to get started.</h2>
            <p>Run this on the Linux or macOS machine that will serve jobs. On Windows, run it inside WSL2.</p>
            <p>The installer sets up the runtime, downloads model weights, and checks what your machine can serve.</p>
            <div className="setup-command-heading"><span>Install the node runtime</span><button className="network-secondary" onClick={() => void copyCmd()}>{copied ? "Copied!" : "Copy command"}</button></div>
            <pre className="setup-command" tabIndex={0} aria-label="Node install command"><code>{installCmd}</code></pre>
            {copyError && <p className="network-notice" role="alert">{copyError}</p>}
            <details className="network-disclosure"><summary>Optional install flags</summary><p>Add <code>--token TOKEN</code> if you were issued operator access, or <code>--wallet 0x...</code> to prefill your wallet for attribution.</p></details>
          </section>
        </div>
        <section className="setup-requirements" aria-labelledby="requirements-title">
          <div className="network-section-heading"><h2 id="requirements-title">Check your machine</h2><span>Use the preflight check to confirm workload readiness.</span></div>
          <div className="setup-requirement-grid">
            <article><span>01 / Compute</span><h3>12 GB+ GPU memory</h3><p>NVIDIA GPU recommended for image jobs. Plan for 16 GB+ VRAM for video workloads.</p></article>
            <article><span>02 / Runtime</span><h3>Linux or macOS</h3><p>64-bit system, Python 3.10+, and stable internet. On Windows, use the desktop app.</p></article>
            <article><span>03 / Storage</span><h3>Room for your models</h3><p>25 GB free minimum. Allow 150 GB+ when serving many models; checkpoints are several GB each.</p></article>
          </div>
          <p className="network-caption">Use an EVM-compatible wallet address for Public Alpha operator attribution.</p>
        </section>
        <section aria-labelledby="setup-flow-title"><div className="network-section-heading"><h2 id="setup-flow-title">From install to online</h2></div><ol className="setup-steps">{setupSteps.map((step, index) => <li key={step.title}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol></section>
          <details className="network-disclosure setup-details"><summary>Post-install commands</summary>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>1. Set your wallet</strong></p>
              <pre tabIndex={0} aria-label="Wallet configuration" style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# ~/.havnai/.env\nWALLET=0xYourWalletAddressHere`}</code>
              </pre>

              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>2. Add operator access if issued</strong></p>
              <pre tabIndex={0} aria-label="Operator access configuration" style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# ~/.havnai/.env\nJOIN_TOKEN=your-token-here`}</code>
              </pre>

              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>3. Download model weights</strong></p>
              <pre tabIndex={0} aria-label="Model download command" style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`~/.havnai/bin/havnai-fetch-models --face-assets`}</code>
              </pre>
              <p style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
                The installer does this for you on GPU machines. Re-run it any time the model
                registry gains an entry. Transfers resume where they left off.
              </p>

              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>4. Check what your node can serve</strong></p>
              <pre tabIndex={0} aria-label="Node preflight command" style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`~/.havnai/bin/havnai-doctor`}</code>
              </pre>
              <p style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
                Reports image, face swap and video readiness separately, with a fix for anything
                blocking. Worth running before you go online — a node that starts with a broken
                capability will accept those jobs and fail them.
              </p>

              <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--text)" }}>5. Start the node</strong></p>
              <pre tabIndex={0} aria-label="Node start commands" style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", overflow: "auto", fontSize: "0.82rem", marginBottom: "1rem" }}>
                <code>{`# Linux\nsystemctl --user start havnai-node\nsystemctl --user enable havnai-node\n\n# Or run directly\n~/.havnai/bin/havnai-node`}</code>
              </pre>

              <p>
                Then confirm status on the <Link href="/nodes" style={{ color: "var(--accent)" }}>Nodes</Link> page or the{" "}
                <a href={`${apiBase}/dashboard`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>coordinator dashboard</a>.
              </p>
            </div>
          </details>
        <details className="network-disclosure setup-details"><summary>Optional video setup</summary><div><p>For machines with 16 GB+ VRAM, preload video support after installation. Run the preflight check to confirm readiness before serving video jobs.</p><pre className="setup-command" tabIndex={0} aria-label="Preload video command"><code>{'cd ~/.havnai && ./venv/bin/python havnai_client.py --preload-video'}</code></pre></div></details>
        <section className="setup-why" aria-labelledby="why-node"><h2 id="why-node">More capacity. More room to create.</h2><ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><Link href="/nodes" className="network-primary">Find your node <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
        <section className="setup-faq" aria-labelledby="faq-title"><div className="network-section-heading"><h2 id="faq-title">Before you get started</h2></div>{faqs.map(faq => <details className="network-disclosure" key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</section>
        <p className="network-footnote">Node activity and rewards are tracked during Public Alpha. <Link href="/how-it-works">How HavnAI works</Link> / <Link href="/ownership">Ownership</Link> / <Link href="/pricing">Credits and pricing</Link></p>
      </main>
    </>
  );
};

export default RunANodePage;
