import type { NextPage } from "next";
import Link from "next/link";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const principles = [
  {
    title: "Not every generated image is yours",
    body: "Generation is a creative act, not an ownership act. You produce outputs. Ownership starts when you choose to claim.",
  },
  {
    title: "Claim is the ownership moment",
    body: "When you claim an asset through the inbox and claim flow, it enters your Collection as something you own inside the JoinHavn ecosystem.",
  },
  {
    title: "Your Collection is permanent",
    body: "Claimed assets persist in your Collection independently of your Library, your generation activity, and your credit balance.",
  },
  {
    title: "Owned assets can move",
    body: "Items in your Collection can be used in Astra's game world, listed on the marketplace, or held in your inventory indefinitely.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "AI asset ownership on JoinHavn",
  url: "https://joinhavn.io/ownership",
  description:
    "How AI asset ownership works on JoinHavn: generate images, save to Library, claim into your Collection, and use owned assets in Astra or the marketplace.",
  publisher: {
    "@type": "Organization",
    name: "JoinHavn",
    url: "https://joinhavn.io",
  },
};

const OwnershipPage: NextPage = () => (
  <>
    <SeoHead
      title="AI asset ownership — how JoinHavn collection works"
      description="Understand how AI asset ownership works on JoinHavn: generate images, save to Library, claim into your Collection, and use or sell owned assets."
      path="/ownership"
      schema={schema}
    />

    <SiteHeader />

    <main className="jh-page-shell">
      <section className="page-container" style={{ paddingTop: "4rem", paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <span className="stat-label" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem" }}>
              Asset ownership
            </span>
            <h1 className="chart-title" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", marginTop: "0.5rem" }}>
              Generation is not ownership. Claiming is.
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.8, maxWidth: "680px", marginBottom: "1.5rem" }}>
            On JoinHavn, generation and ownership are two separate things. You can generate and save freely. Ownership — and everything
            that comes with it — begins when you claim an asset into your Collection.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">Start Generating</Link>
            <Link href="/how-it-works" className="jh-btn jh-btn-secondary">Full Flow Explained</Link>
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">How ownership works</h2>
          </div>
          <div className="gallery-grid" style={{ marginTop: "1.25rem" }}>
            {principles.map((p) => (
              <article key={p.title} className="output-card">
                <h3 style={{ marginTop: 0 }}>{p.title}</h3>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">The path from generated to owned</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.75rem",
              margin: "1.25rem 0",
              textAlign: "center",
            }}
          >
            {["Generate", "Library", "Inbox", "Claim", "Collection", "Astra / Marketplace"].map((stage, i, arr) => (
              <div key={stage} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    flex: 1,
                    background: "var(--surface-2, rgba(255,255,255,0.06))",
                    border: "1px solid var(--border, rgba(255,255,255,0.1))",
                    borderRadius: "10px",
                    padding: "0.75rem 0.5rem",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: stage === "Claim" || stage === "Collection" ? "var(--accent, #7c5cfc)" : "var(--text)",
                  }}
                >
                  {stage}
                </div>
                {i < arr.length - 1 && (
                  <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: "0.9rem" }}>→</span>
                )}
              </div>
            ))}
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>
            Every generated output starts in your Library. From there, selected items move through Inbox to Claim.
            Claim is where <strong style={{ color: "var(--text)" }}>ownership begins</strong>. Your Collection holds everything you have claimed.
            From Collection, assets flow to Astra for use in-world or to the marketplace for sale.
          </p>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "2rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">What you can do with owned assets</h2>
          </div>
          <div style={{ display: "grid", gap: "1rem", color: "var(--text-muted)", lineHeight: 1.75, marginTop: "1rem" }}>
            <p>
              <strong style={{ color: "var(--text)" }}>Use in Astra</strong> — Claimed pilots, ships, and equipment appear in Astra's
              game world and carry meaning inside the game loop.
            </p>
            <p>
              <strong style={{ color: "var(--text)" }}>List on the marketplace</strong> — Assets in your Collection can be listed for
              sale or trade through the JoinHavn marketplace.
            </p>
            <p>
              <strong style={{ color: "var(--text)" }}>Hold indefinitely</strong> — Your Collection does not expire. Owned assets
              remain yours regardless of generation activity.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <Link href="/astra" className="jh-btn jh-btn-secondary">See Astra</Link>
            <Link href="/marketplace" className="jh-btn jh-btn-secondary">Browse Marketplace</Link>
          </div>
        </div>
      </section>

      <section className="page-container" style={{ paddingBottom: "3rem" }}>
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">Start generating and collecting</h2>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            Open the generator, build up your Library, and move your best work into your Collection. Every claimed asset is yours to use.
          </p>
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            <Link href="/create" className="jh-btn jh-btn-primary">Open Generator</Link>
            <Link href="/how-it-works" className="jh-btn jh-btn-tertiary">How It Works</Link>
          </div>
        </div>
      </section>
    </main>
  </>
);

export default OwnershipPage;
