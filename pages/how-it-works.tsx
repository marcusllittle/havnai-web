import type { NextPage } from "next";
import Link from "next/link";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const pipeline = [
  {
    stage: "Create",
    label: "Generate with the AI image generator",
    detail:
      "Describe what you want. The JoinHavn generator produces sci-fi pilots, ships, environments, and scenes. Run multiple outputs and compare models on the same prompt.",
    cta: { label: "Open Generator", href: "/create" },
  },
  {
    stage: "Library",
    label: "Your generated outputs live here",
    detail:
      "Every generation you save goes into your Library. This is your working history — browse, filter, and move assets forward from here.",
    cta: null,
  },
  {
    stage: "Inbox",
    label: "Assets ready to claim appear here",
    detail:
      "Selected outputs that are eligible to move into your Collection flow through the Inbox first. This is the delivery step before ownership begins.",
    cta: null,
  },
  {
    stage: "Claim",
    label: "Ownership begins at claim",
    detail:
      "When you claim an asset, it becomes yours in the JoinHavn ecosystem. This is the moment of transition from generated output to owned item.",
    cta: { label: "See Ownership", href: "/ownership" },
  },
  {
    stage: "Collection",
    label: "Your owned assets live here",
    detail:
      "Your Collection is your permanent inventory. Claimed items persist here regardless of future generation activity.",
    cta: null,
  },
  {
    stage: "Astra / Marketplace",
    label: "Use what you own",
    detail:
      "Bring your Collection into Astra where assets gain game-world context: pilots, ships, and atmosphere become meaningful inside a real game loop. Or list items on the marketplace.",
    cta: { label: "Explore Astra", href: "/astra" },
  },
];

const faqs = [
  {
    q: "Do I need to claim every image I generate?",
    a: "No. Generation is separate from ownership. Your Library holds everything you save. Claiming is an intentional step you take for assets you want to keep long-term and use in other parts of the ecosystem.",
  },
  {
    q: "What is the difference between Library and Collection?",
    a: "Library is your working output history — all saves from generation. Collection is your owned-asset inventory — only items you have claimed. Think of Library as a draft folder and Collection as permanent storage.",
  },
  {
    q: "How do assets get from Collection into Astra?",
    a: "Claimed assets in your Collection are recognized inside Astra's game world. Pilots, ships, and loadout items you own carry through into the game loop.",
  },
  {
    q: "Can I sell assets from my Collection on the marketplace?",
    a: "Yes. Claimed assets in your Collection can be listed through the marketplace flow.",
  },
  {
    q: "How does the node network connect to generation?",
    a: "JoinHavn's generation runs on a distributed GPU network powered by node operators. Operators provide compute and earn for their contribution. This is what keeps the system decentralized.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How JoinHavn works: Generate → Library → Inbox → Claim → Collection → Astra",
  url: "https://joinhavn.io/how-it-works",
  description:
    "Step-by-step breakdown of the full JoinHavn flow: AI image generation, saving to Library, claiming assets into Collection, and using them in Astra or the marketplace.",
  step: pipeline.map((p, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: p.stage,
    text: p.detail,
  })),
};

const HowItWorksPage: NextPage = () => (
  <>
    <SeoHead
      title="How JoinHavn works — generate, collect, and use AI assets"
      description="Full breakdown of the JoinHavn flow: generate AI images, save to Library, claim into Collection, and use assets in Astra or list on the marketplace."
      path="/how-it-works"
      image="/astra/scenes/spaceport_hub.png"
      imageAlt="JoinHavn how-it-works preview showing the Astra spaceport hub"
      schema={schema}
    />

    <SiteHeader />

    <main className="jh-page-shell">
      <section className="page-container" style={{ paddingTop: "4rem", paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <span className="stat-label" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>
              Platform overview
            </span>
            <h1 className="chart-title" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", marginTop: "0.5rem" }}>
              Generate → Library → Inbox → Claim → Collection → Astra
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.8, maxWidth: "680px", marginBottom: "1.5rem" }}>
            JoinHavn is a connected ecosystem. Generation is just the start. Every step from output to ownership to actual use inside a
            game world is defined and deliberate. Here is exactly how it works.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">Open Generator</Link>
            <Link href="/astra" className="jh-btn jh-btn-secondary">See Astra</Link>
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">The full flow</h2>
          </div>
          <ol style={{ listStyle: "none", padding: 0, margin: "1.25rem 0 0", display: "grid", gap: "1.5rem" }}>
            {pipeline.map((p, i) => (
              <li
                key={p.stage}
                style={{
                  display: "grid",
                  gridTemplateColumns: "3.5rem 1fr",
                  gap: "1rem",
                  alignItems: "start",
                  paddingBottom: i < pipeline.length - 1 ? "1.5rem" : 0,
                  borderBottom: i < pipeline.length - 1 ? "1px solid var(--border, rgba(255,255,255,0.08))" : "none",
                }}
              >
                <span
                  style={{
                    background: "var(--surface-2, rgba(255,255,255,0.06))",
                    border: "1px solid var(--border, rgba(255,255,255,0.1))",
                    borderRadius: "8px",
                    padding: "0.35rem 0.5rem",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    textAlign: "center",
                    color: "var(--accent, #7c5cfc)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    lineHeight: 1.3,
                  }}
                >
                  {p.stage}
                </span>
                <div>
                  <strong style={{ display: "block", marginBottom: "0.4rem" }}>{p.label}</strong>
                  <p style={{ color: "var(--text-muted)", margin: "0 0 0.6rem", lineHeight: 1.75 }}>{p.detail}</p>
                  {p.cta && (
                    <Link href={p.cta.href} className="jh-btn jh-btn-tertiary" style={{ display: "inline-block" }}>
                      {p.cta.label}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">Frequently asked questions</h2>
          </div>
          <dl style={{ margin: "1.25rem 0 0", display: "grid", gap: "1.25rem" }}>
            {faqs.map((faq) => (
              <div key={faq.q} style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", paddingBottom: "1.25rem" }}>
                <dt style={{ fontWeight: 700, marginBottom: "0.4rem" }}>{faq.q}</dt>
                <dd style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.75 }}>{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "3rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">Jump in anywhere</h2>
          </div>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">Start Creating</Link>
            <Link href="/astra" className="jh-btn jh-btn-secondary">Explore Astra</Link>
            <Link href="/marketplace" className="jh-btn jh-btn-secondary">Browse Marketplace</Link>
            <Link href="/run-a-node" className="jh-btn jh-btn-tertiary">Run a Node</Link>
          </div>
        </div>
      </section>
    </main>
  </>
);

export default HowItWorksPage;
