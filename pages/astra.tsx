import type { NextPage } from "next";
import Link from "next/link";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const gameplayCards = [
  {
    title: "Choose your pilot and loadout",
    description: "Build around different pilots, ships, outfits, and combat style before you launch.",
    image: "/astra/pilots/nova_starling.png",
  },
  {
    title: "Run combat missions",
    description: "Fight through arcade shooter encounters, bosses, and scoring-driven combat loops.",
    image: "/astra/scenes/shmup_combat.png",
  },
  {
    title: "Return to the spaceport",
    description: "Come back to the hub, track progression, manage collection flow, and go deeper on the next run.",
    image: "/astra/scenes/spaceport_hub.png",
  },
];

const AstraPage: NextPage = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Astra Valkyries",
    url: "https://joinhavn.io/astra",
    image: "https://joinhavn.io/astra/scenes/shmup_combat.png",
    description:
      "Astra Valkyries is the sci-fi world connected to JoinHavn, where combat, pilots, progression, and collected assets gain meaning.",
    genre: ["Shooter", "Sci-Fi", "Action"],
    publisher: {
      "@type": "Organization",
      name: "JoinHavn",
      url: "https://joinhavn.io",
    },
  };

  return (
    <>
      <SeoHead
        title="Astra Valkyries sci-fi game world"
        description="Explore Astra Valkyries, the sci-fi game world connected to JoinHavn where combat, pilots, progression, and collected assets come together."
        path="/astra"
        image="/astra/scenes/shmup_combat.png"
        schema={schema}
      />

      <SiteHeader />

      <main className="jh-page-shell">
        <section className="jh-hero">
          <div className="jh-hero-bg" aria-hidden="true">
            <img src="/astra/scenes/shmup_combat.png" alt="" className="jh-hero-bg-img" />
            <div className="jh-hero-bg-overlay" />
          </div>

          <div className="jh-hero-inner">
            <h1 className="jh-hero-title">Astra Valkyries is where the ecosystem becomes a world.</h1>
            <p className="jh-hero-subtitle">
              Play combat runs, choose pilots and loadouts, return to the spaceport, and give claimed assets a real place to matter.
            </p>
            <div className="jh-hero-actions">
              <a
                href="https://astra.joinhavn.io/"
                className="jh-btn jh-btn-primary"
                target="_blank"
                rel="noreferrer"
              >
                Play Astra
              </a>
              <Link href="/create" className="jh-btn jh-btn-secondary">
                Start Creating
              </Link>
              <Link href="/marketplace" className="jh-btn jh-btn-tertiary">
                Explore Marketplace
              </Link>
            </div>
          </div>
        </section>

        <section className="page-container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">Why Astra matters</h2>
            </div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>
              Astra is not just an outbound play link. It is the front door of the JoinHavn ecosystem, the place where creation,
              collection, and progression connect to an actual game loop instead of staying abstract.
            </p>
          </div>

          <div className="gallery-grid" style={{ marginTop: "1.5rem" }}>
            {gameplayCards.map((card) => (
              <article key={card.title} className="output-card">
                <img src={card.image} alt={card.title} style={{ width: "100%", borderRadius: "16px", marginBottom: "1rem" }} />
                <h3 style={{ marginTop: 0 }}>{card.title}</h3>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>{card.description}</p>
              </article>
            ))}
          </div>

          <div className="chart-section" style={{ marginTop: "1.5rem" }}>
            <div className="chart-header">
              <h2 className="chart-title">How Astra connects back to JoinHavn</h2>
            </div>
            <div style={{ display: "grid", gap: "1rem", color: "var(--text-muted)", lineHeight: 1.75 }}>
              <p><strong style={{ color: "var(--text)" }}>Create</strong> on the JoinHavn generator and build outputs that can move into your broader ecosystem flow.</p>
              <p><strong style={{ color: "var(--text)" }}>Collect</strong> through library, inbox, claim, and collection paths so owned assets feel persistent.</p>
              <p><strong style={{ color: "var(--text)" }}>Use</strong> Astra as the world layer where progression, identity, and atmosphere make those assets mean something.</p>
            </div>
            <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
              <Link href="/create" className="jh-btn jh-btn-secondary">Create Assets</Link>
              <Link href="/pricing" className="jh-btn jh-btn-secondary">View Credits</Link>
              <Link href="/run-a-node" className="jh-btn jh-btn-tertiary">Run a Node</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default AstraPage;
