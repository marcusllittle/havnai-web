import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

const ecosystemCards = [
  {
    eyebrow: "Umbrella Brand",
    title: "JoinHavn",
    body: "The premium destination connecting creation, ownership, play, and network participation into one cinematic sci-fi ecosystem.",
  },
  {
    eyebrow: "Emotional Front Door",
    title: "Astra Valk",
    body: "The flagship interactive world, where atmosphere, progression, and identity become something people actually care about.",
  },
  {
    eyebrow: "Engine Underneath",
    title: "HavnAI",
    body: "The creation, ownership, marketplace, and compute layer that powers the entire experience beneath the surface.",
  },
];

const surfaceCards = [
  {
    title: "Generator",
    body: "Create premium image and video outputs through the HavnAI engine.",
    href: "/generator",
    cta: "Start creating",
  },
  {
    title: "Library",
    body: "Your owned history, saved outputs, and launch point into listing, collecting, and reuse.",
    href: "/library",
    cta: "View library",
  },
  {
    title: "Marketplace",
    body: "Browse, buy, sell, and relist outputs in the premium exchange layer.",
    href: "/marketplace",
    cta: "Open marketplace",
  },
  {
    title: "Credits",
    body: "The simple app spending layer for generation and purchases, distinct from protocol rewards.",
    href: "/pricing",
    cta: "See credits",
  },
  {
    title: "Run a Node",
    body: "Power the network with your GPU and earn tracked HAI rewards by serving live jobs.",
    href: "/join",
    cta: "Become an operator",
  },
  {
    title: "Astra Valk",
    body: "The world where the ecosystem becomes playable, expressive, and emotionally sticky.",
    href: "https://play.joinhavn.io/",
    cta: "Enter Astra",
    external: true,
  },
];

const loopNodes = [
  { title: "Create", body: "Use Generator to produce new image and video outputs with premium models." },
  { title: "Own", body: "Save them into Library and build a persistent inventory instead of a disposable queue." },
  { title: "Earn", body: "Sell, trade, relist, operate, and participate in a networked economy." },
  { title: "Play", body: "Bring it all back into Astra Valk, where the ecosystem becomes a world." },
];

const HomePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>JoinHavn | Astra Valk x HavnAI</title>
        <meta
          name="description"
          content="JoinHavn is a premium sci-fi ecosystem where you create, own, earn, and play. Astra Valk is the flagship world. HavnAI is the engine underneath."
        />
      </Head>

      <SiteHeader />

      <main className="jh-homepage">
        <section className="jh-hero">
          <div className="jh-hero-backdrop" aria-hidden="true" />
          <div className="jh-hero-grid">
            <div className="jh-hero-copy">
              <span className="jh-eyebrow">JoinHavn flagship ecosystem</span>
              <h1 className="jh-hero-title">Step into the world. Own what you create. Power what comes next.</h1>
              <p className="jh-hero-subtitle">
                Astra Valk is the emotional front door. HavnAI is the engine underneath. JoinHavn is the umbrella
                where creation, ownership, rewards, and play finally belong to the same system.
              </p>
              <div className="jh-hero-actions">
                <Link href="https://play.joinhavn.io/" className="jh-btn jh-btn-primary">
                  Enter Astra
                </Link>
                <Link href="/generator" className="jh-btn jh-btn-secondary">
                  Explore HavnAI
                </Link>
                <Link href="/join" className="jh-btn jh-btn-tertiary">
                  Run a Node
                </Link>
              </div>
              <div className="jh-hero-loop-strip">
                <span>Create</span>
                <span>Own</span>
                <span>Earn</span>
                <span>Play</span>
              </div>
            </div>

            <div className="jh-hero-stage">
              <div className="jh-stage-panel jh-stage-panel-main">
                <div className="jh-stage-panel-header">
                  <span className="jh-stage-chip">Astra Valk</span>
                  <span className="jh-stage-chip ghost">Flagship world</span>
                </div>
                <div className="jh-stage-visual jh-stage-visual-main">
                  <div className="jh-stage-rings" />
                  <div className="jh-stage-orb" />
                  <div className="jh-stage-glow" />
                  <div className="jh-stage-gridline" />
                </div>
                <div className="jh-stage-copy">
                  <strong>Flagship interactive frontier</strong>
                  <p>
                    A premium sci-fi world built to make rewards, identity, progression, and ownership feel cinematic
                    instead of abstract.
                  </p>
                </div>
              </div>
              <div className="jh-hero-sideband">
                <div className="jh-sideband-card">
                  <span className="jh-card-eyebrow">Engine layer</span>
                  <strong>HavnAI powers generation, ownership, and exchange.</strong>
                </div>
                <div className="jh-sideband-card">
                  <span className="jh-card-eyebrow">Why it matters</span>
                  <strong>Astra gives the system emotional gravity, not just utility.</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="jh-section">
          <div className="jh-section-header">
            <span className="jh-eyebrow">Ecosystem identity</span>
            <h2>One brand. One world. One engine underneath.</h2>
            <p>
              JoinHavn connects the cinematic front door, the generation engine, and the ownership economy into a
              single system that feels coherent instead of fragmented.
            </p>
          </div>
          <div className="jh-ecosystem-grid">
            {ecosystemCards.map((card) => (
              <article key={card.title} className="jh-info-card">
                <span className="jh-card-eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="jh-section jh-section-highlight">
          <div className="jh-highlight-grid">
            <div className="jh-highlight-copy">
              <span className="jh-eyebrow">Astra spotlight</span>
              <h2>The emotional reason the ecosystem exists.</h2>
              <p>
                Astra should not feel like a side-link. It is the world that makes everything else matter, the place
                where progression, identity, and premium sci-fi atmosphere become felt instead of merely explained.
              </p>
              <ul className="jh-feature-list">
                <li>Flagship atmosphere and high-identity worldbuilding</li>
                <li>A living destination for rewards, credits, and progression</li>
                <li>The clearest emotional expression of the JoinHavn ecosystem</li>
              </ul>
            </div>
            <div className="jh-highlight-panel">
              <div className="jh-highlight-media">
                <div className="jh-highlight-overlay-card top">
                  <span className="jh-card-eyebrow">World layer</span>
                  <strong>Premium sci-fi atmosphere</strong>
                </div>
                <div className="jh-highlight-overlay-card bottom">
                  <span className="jh-card-eyebrow">Player loop</span>
                  <strong>Earn, unlock, return, and go deeper.</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="jh-section">
          <div className="jh-section-header narrow">
            <span className="jh-eyebrow">HavnAI engine</span>
            <h2>The system underneath the spectacle.</h2>
            <p>
              HavnAI powers generation, ownership, exchange, and network participation. It should feel like the engine
              beneath the world, not the only story a visitor has to decode on the first screen.
            </p>
          </div>
          <div className="jh-engine-grid">
            <article className="jh-engine-card">
              <strong>Create</strong>
              <p>Generate premium image and video outputs with expanding tooling and creator surfaces.</p>
            </article>
            <article className="jh-engine-card">
              <strong>Own</strong>
              <p>Keep your outputs in a library that feels like a real collection and inventory.</p>
            </article>
            <article className="jh-engine-card">
              <strong>Trade</strong>
              <p>Move into the marketplace and participate in an economy that actually loops back into use.</p>
            </article>
            <article className="jh-engine-card">
              <strong>Power</strong>
              <p>Run a node, serve demand, and participate directly in the system’s underlying infrastructure.</p>
            </article>
          </div>
        </section>

        <section className="jh-section jh-loop-section">
          <div className="jh-section-header narrow center">
            <span className="jh-eyebrow">Core loop</span>
            <h2>Create → Own → Earn → Play</h2>
            <p>
              This is the simplest expression of JoinHavn. The site, the economy, and the product surfaces should all
              reinforce this loop.
            </p>
          </div>
          <div className="jh-loop-grid">
            {loopNodes.map((node) => (
              <div key={node.title} className="jh-loop-node">
                <strong>{node.title}</strong>
                <p>{node.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="jh-section">
          <div className="jh-section-header">
            <span className="jh-eyebrow">Surface map</span>
            <h2>Enter by intent, not by confusion.</h2>
            <p>
              The ecosystem should feel easy to navigate. Each surface has one job, one identity, and one clear reason
              to exist.
            </p>
          </div>
          <div className="jh-surface-grid">
            {surfaceCards.map((card) => {
              const content = (
                <>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <span className="jh-surface-cta">{card.cta}</span>
                </>
              );

              return card.external ? (
                <a key={card.title} href={card.href} className="jh-surface-card" target="_blank" rel="noreferrer">
                  {content}
                </a>
              ) : (
                <Link key={card.title} href={card.href} className="jh-surface-card">
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="jh-section jh-network-section">
          <div className="jh-section-header narrow">
            <span className="jh-eyebrow">Operator layer</span>
            <h2>Run the infrastructure behind the world.</h2>
            <p>
              Node participation should feel like joining a premium system, not just opening a utility page. Operators
              are part of what makes the whole ecosystem credible.
            </p>
          </div>
          <div className="jh-network-band">
            <div>
              <strong>Run live jobs</strong>
              <p>Serve creator demand across image, video, and future workflows.</p>
            </div>
            <div>
              <strong>Earn tracked HAI</strong>
              <p>Build visible operator history and reward flow through the network layer.</p>
            </div>
            <div>
              <strong>Power JoinHavn</strong>
              <p>Support the engine underneath Astra, HavnAI, and the marketplace.</p>
            </div>
          </div>
        </section>

        <section className="jh-final-cta">
          <div className="jh-final-cta-inner">
            <span className="jh-eyebrow">Choose your entry point</span>
            <h2>Play the world, create inside it, or help power what comes next.</h2>
            <div className="jh-hero-actions center">
              <Link href="https://play.joinhavn.io/" className="jh-btn jh-btn-primary">
                Play Astra
              </Link>
              <Link href="/generator" className="jh-btn jh-btn-secondary">
                Start Creating
              </Link>
              <Link href="/join" className="jh-btn jh-btn-tertiary">
                Run a Node
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
