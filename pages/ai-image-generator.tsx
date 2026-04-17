import type { NextPage } from "next";
import Link from "next/link";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const features = [
  {
    title: "Sci-fi and game-ready output",
    description:
      "JoinHavn's generator is tuned for sci-fi worlds: pilots, ships, environments, characters, and atmospheric scenes. Every output is designed to be game-adjacent, not just decorative.",
  },
  {
    title: "Model choice built in",
    description:
      "Switch between models on the same prompt to compare output quality and style. No separate accounts or API keys required.",
  },
  {
    title: "Save, collect, and use",
    description:
      "Generated outputs move into your Library. Selected assets can be claimed into your Collection and used across the JoinHavn ecosystem including Astra.",
  },
  {
    title: "Community-powered generation",
    description:
      "Generation is backed by a distributed GPU network. Node operators provide capacity and earn for doing so.",
  },
];

const steps = [
  { step: "1", label: "Describe your image", detail: "Type a prompt. Apply any style preset or model preference." },
  { step: "2", label: "Generate and compare", detail: "Run multiple outputs and compare results side by side." },
  { step: "3", label: "Save to your Library", detail: "Keep what you like. Your Library is your working output history." },
  { step: "4", label: "Claim into your Collection", detail: "Move selected assets into your Collection via the inbox and claim flow." },
  { step: "5", label: "Use in Astra and beyond", detail: "Bring assets into the Astra game world or list them on the marketplace." },
];

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "JoinHavn AI Image Generator",
  url: "https://joinhavn.io/create",
  applicationCategory: "MultimediaApplication",
  description:
    "JoinHavn is an AI image generator built for sci-fi game worlds. Create pilots, ships, environments, and atmospheric scenes. Save to Library, claim into Collection, use in Astra.",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free credits available. Additional credits available via pricing plans.",
  },
  publisher: {
    "@type": "Organization",
    name: "JoinHavn",
    url: "https://joinhavn.io",
  },
};

const AiImageGeneratorPage: NextPage = () => (
  <>
    <SeoHead
      title="AI image generator for sci-fi and game worlds"
      description="Generate sci-fi pilots, ships, environments, and atmospheric scenes with JoinHavn's AI image generator. Save to Library, claim into Collection, use in Astra."
      path="/ai-image-generator"
      image="/astra/scenes/nebula_runway_briefing.png"
      imageAlt="JoinHavn AI image generator preview with a cinematic sci-fi scene"
      schema={schema}
    />

    <SiteHeader />

    <main className="jh-page-shell">
      <section className="page-container" style={{ paddingTop: "4rem", paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <span className="stat-label" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>
              AI image generator
            </span>
            <h1 className="chart-title" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", marginTop: "0.5rem" }}>
              Generate images built for sci-fi worlds, not just art feeds.
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.8, maxWidth: "680px", marginBottom: "1.5rem" }}>
            JoinHavn's AI image generator produces pilots, ships, environments, weapons, and atmospheric scenes tuned for game-adjacent
            output. Everything you generate moves into an ecosystem where assets can be saved, collected, and used.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">
              Open Generator
            </Link>
            <Link href="/astra" className="jh-btn jh-btn-secondary">
              See Astra
            </Link>
            <Link href="/pricing" className="jh-btn jh-btn-tertiary">
              View Credits
            </Link>
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">What makes it different</h2>
          </div>
          <div className="gallery-grid" style={{ marginTop: "1.25rem" }}>
            {features.map((f) => (
              <article key={f.title} className="output-card">
                <h3 style={{ marginTop: 0 }}>{f.title}</h3>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{f.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">How generation works</h2>
          </div>
          <ol style={{ listStyle: "none", padding: 0, margin: "1.25rem 0 0", display: "grid", gap: "1rem" }}>
            {steps.map((s) => (
              <li key={s.step} style={{ display: "grid", gridTemplateColumns: "2rem 1fr", gap: "0.75rem", alignItems: "start" }}>
                <span
                  style={{
                    background: "var(--accent, #7c5cfc)",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "2rem",
                    height: "2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    flexShrink: 0,
                  }}
                >
                  {s.step}
                </span>
                <div>
                  <strong>{s.label}</strong>
                  <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0", lineHeight: 1.7 }}>{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "3rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">Ready to generate?</h2>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            Start with the generator and see what the model produces for your prompt. Save what works, collect what matters, and bring
            your best assets into Astra or the marketplace.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">
              Open Generator
            </Link>
            <Link href="/how-it-works" className="jh-btn jh-btn-secondary">
              How It Works
            </Link>
            <Link href="/marketplace" className="jh-btn jh-btn-tertiary">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>
    </main>
  </>
);

export default AiImageGeneratorPage;
