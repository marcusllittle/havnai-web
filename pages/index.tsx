import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

const ecosystemCards = [
  {
    eyebrow: "Umbrella Brand",
    title: "JoinHavn",
    body: "The premium destination connecting creation, ownership, play, and network participation into one sci-fi ecosystem.",
  },
  {
    eyebrow: "Emotional Front Door",
    title: "Astra Valk",
    body: "The flagship interactive world, where rewards, identity, and atmosphere become something you actually feel.",
  },
  {
    eyebrow: "Engine Underneath",
    title: "HavnAI",
    body: "The generation, ownership, marketplace, and compute layer powering the entire experience behind the scenes.",
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
    body: "The clean app spending layer for generation and purchases, separate from protocol rewards.",
    href: "/credits",
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
              <h1 className="jh-hero-title">A cinematic world powered by real AI creation and ownership.</h1>
              <p className="jh-hero-subtitle">
                Astra Valk is the emotional front door. HavnAI is the engine underneath. JoinHavn is the
                umbrella that connects creation, rewards, identity, and play.
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
              <div className="jh-stage-panel">
                <div className="jh-stage-panel-header">
                  <span className="jh-stage-chip">Astra Valk</span>
                  <span className="jh-stage-chip ghost">Flagship world</span>
                </div>
                <div className="jh-stage-visual">
                  <div className="jh-stage-rings" />
                  <div className="jh-stage-orb" />
                  <div className="jh-stage-glow" />
                </div>
                <div className="jh-stage-copy">
                  <strong>Flagship interactive frontier</strong>
                  <p>
                    Premium sci-fi atmosphere, progression, rewards, and identity, built to make the ecosystem
                    feel alive instead of theoretical.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="jh-section">
          <div className="jh-section-header">
            <span className="jh-eyebrow">Ecosystem identity</span>
            <h2>Three layers, one ecosystem.</h2>
            <p>
              JoinHavn is not just a site. It is the umbrella brand connecting a flagship world, a premium
              creation engine, and a live ownership economy.
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
              <h2>The world people care about first.</h2>
              <p>
                Astra should not feel like a side project. It is the emotional front door, the flagship universe,
                and the place where rewards, identity, and collected value become meaningful.
              </p>
              <ul className="jh-feature-list">
                <li>Flagship sci-fi atmosphere and worldbuilding</li>
                <li>Credits and progression tied to a larger ecosystem</li>
                <li>A destination that gives HavnAI output emotional context</li>
              </ul>
            </div>
            <div className="jh-highlight-panel">
              <div className="jh-highlight-media" />
            </div>
          </div>
        </section>

        <section className="jh-section">
          <div className="jh-section-header narrow">
            <span className="jh-eyebrow">HavnAI engine</span>
            <h2>The system underneath the spectacle.</h2>
            <p>
              HavnAI powers generation, ownership, exchange, and network participation. It should feel like the
              engine beneath the world, not the only story the user has to learn upfront.
            </p>
          </div>
          <div className="jh-engine-grid">
            <article className="jh-engine-card">
              <strong>Create</strong>
              <p>Generate image and video with premium models and evolving tooling.</p>
            </article>
            <article className="jh-engine-card">
              <strong>Own</strong>
              <p>Save outputs into a personal library that feels like a real inventory, not a temp queue.</p>
            </article>
            <article className="jh-engine-card">
              <strong>Trade</strong>
              <p>List, browse, and acquire assets in a marketplace that supports real ecosystem value.</p>
            </article>
            <article className="jh-engine-card">
              <strong>Power</strong>
              <p>Run a node, serve jobs, and earn tracked HAI rewards through the network layer.</p>
            </article>
          </div>
        </section>

        <section className="jh-section jh-loop-section">
          <div className="jh-section-header narrow center">
            <span className="jh-eyebrow">Core loop</span>
            <h2>Create → Own → Earn → Play</h2>
            <p>
              This is the loop that should define the entire product. Every top-level surface should reinforce one
              part of it.
            </p>
          </div>
          <div className="jh-loop-grid">
            <div className="jh-loop-node">
              <strong>Create</strong>
              <p>Use Generator to produce new outputs.</p>
            </div>
            <div className="jh-loop-node">
              <strong>Own</strong>
              <p>Store and manage them in Library.</p>
            </div>
            <div className="jh-loop-node">
              <strong>Earn</strong>
              <p>Sell, trade, operate, and participate in the economy.</p>
            </div>
            <div className="jh-loop-node">
              <strong>Play</strong>
              <p>Bring it back into Astra Valk and the wider ecosystem.</p>
            </div>
          </div>
        </section>

        <section className="jh-section">
          <div className="jh-section-header">
            <span className="jh-eyebrow">Surface map</span>
            <h2>Explore the ecosystem by intent.</h2>
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
              Node participation should feel like powering a premium system, not just joining a back-office install
              flow. Operators are part of what makes the ecosystem believable.
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
            <h2>Enter the world, create inside it, or help power it.</h2>
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
