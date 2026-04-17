import type { NextPage } from "next";
import Link from "next/link";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const features = [
  {
    title: "Generate short cinematic clips",
    description:
      "JoinHavn supports AI video generation for short sci-fi sequences, atmospheric motion shots, and game-adjacent visual ideas without leaving the main creation stack.",
  },
  {
    title: "Same ecosystem, not a separate tool",
    description:
      "Video creation sits beside image generation and face swap inside the same generator. Credits, wallet identity, and output history stay in one place.",
  },
  {
    title: "Backed by the GPU network",
    description:
      "Video jobs route into the JoinHavn node network, where heavier workloads can be handled by machines configured for video-capable inference.",
  },
  {
    title: "Useful for Astra-world content",
    description:
      "Use clips for worldbuilding, character mood pieces, scene exploration, and cinematic concepting that connects back to Astra and the broader JoinHavn universe.",
  },
];

const steps = [
  { step: "1", label: "Switch to video mode", detail: "Open the generator and choose video generation instead of image or face swap." },
  { step: "2", label: "Write the motion prompt", detail: "Describe the subject, setting, movement, mood, and any cinematic direction you want the model to follow." },
  { step: "3", label: "Run on live capacity", detail: "The job routes into available GPU capacity across the JoinHavn network." },
  { step: "4", label: "Review the clip", detail: "Inspect the result, iterate on prompt direction, and compare future runs as needed." },
  { step: "5", label: "Use alongside the rest of the stack", detail: "Keep video work connected to your broader creation flow, including images, Library history, and Astra-facing worldbuilding." },
];

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "JoinHavn AI Video Generator",
  url: "https://joinhavn.io/ai-video-generator",
  applicationCategory: "MultimediaApplication",
  description:
    "JoinHavn is an AI video generator for short sci-fi clips, cinematic worldbuilding, and game-adjacent motion concepts powered by a distributed GPU network.",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Video generation uses JoinHavn credits. Pricing depends on available plans and network capacity.",
  },
  publisher: {
    "@type": "Organization",
    name: "JoinHavn",
    url: "https://joinhavn.io",
  },
};

const AiVideoGeneratorPage: NextPage = () => (
  <>
    <SeoHead
      title="AI video generator for sci-fi clips and worldbuilding"
      description="Generate short sci-fi clips, atmospheric motion shots, and cinematic concepts with JoinHavn's AI video generator on the GPU network."
      path="/ai-video-generator"
      image="/astra/scenes/solar_rift_briefing.png"
      imageAlt="JoinHavn AI video generator preview with cinematic sci-fi artwork"
      schema={schema}
    />

    <SiteHeader />

    <main className="jh-page-shell">
      <section className="page-container" style={{ paddingTop: "4rem", paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <span className="stat-label" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>
              AI video generator
            </span>
            <h1 className="chart-title" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", marginTop: "0.5rem" }}>
              Generate short cinematic video on the JoinHavn grid.
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.8, maxWidth: "700px", marginBottom: "1.5rem" }}>
            JoinHavn's AI video generator is built for short-form sci-fi clips, worldbuilding sequences, and game-adjacent motion ideas. Run video jobs on live network capacity and keep the work connected to the rest of your creation flow.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">Open Generator</Link>
            <Link href="/pricing" className="jh-btn jh-btn-secondary">View Credits</Link>
            <Link href="/how-it-works" className="jh-btn jh-btn-tertiary">How It Works</Link>
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">What makes it useful</h2>
          </div>
          <div className="gallery-grid" style={{ marginTop: "1.25rem" }}>
            {features.map((feature) => (
              <article key={feature.title} className="output-card">
                <h3 style={{ marginTop: 0 }}>{feature.title}</h3>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">How video generation works</h2>
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
            <h2 className="chart-title">Keep it connected to the rest of the stack</h2>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            Video is part of the same JoinHavn system as image generation, credits, ownership flow, and Astra-facing worldbuilding. Use it as another layer of creation, not a disconnected tool.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">Open Generator</Link>
            <Link href="/ai-image-generator" className="jh-btn jh-btn-secondary">AI Image Generator</Link>
            <Link href="/run-a-node" className="jh-btn jh-btn-tertiary">Run a Node</Link>
          </div>
        </div>
      </section>
    </main>
  </>
);

export default AiVideoGeneratorPage;
