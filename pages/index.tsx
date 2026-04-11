import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

const pilots = [
  {
    name: "Nova Starling",
    role: "Precision Lead",
    img: "/astra/pilots/nova_starling.png",
  },
  {
    name: "Rex Thunderbolt",
    role: "Firepower Veteran",
    img: "/astra/pilots/rex_thunderbolt.png",
  },
  {
    name: "Yuki Frostweaver",
    role: "Stealth Operative",
    img: "/astra/pilots/yuki_frostweaver.png",
  },
];

const showcaseItems = [
  {
    label: "Shmup Combat",
    desc: "Arcade shooter action with bosses, combos, and scoring.",
    img: "/astra/scenes/solar_rift_briefing.png",
  },
  {
    label: "Spaceport Hub",
    desc: "Your base of operations between missions.",
    img: "/astra/scenes/nebula_runway_briefing.png",
  },
  {
    label: "Ship Loadouts",
    desc: "Three ships. Weapon kits. Stat synergies.",
    img: "/astra/ships/astra_interceptor.png",
    contain: true,
  },
  {
    label: "20+ Outfits",
    desc: "Cosmetic gear across four rarity tiers.",
    img: "/astra/outfits/aurora_borealis.webp",
    contain: true,
  },
  {
    label: "Missions & Zones",
    desc: "Three zones. Twelve missions. Three bosses.",
    img: "/astra/scenes/abyss_crown_briefing.png",
  },
  {
    label: "Collection",
    desc: "Everything you earn, you keep.",
    img: "/astra/outfits/void_reaper.webp",
    contain: true,
  },
];

const pipelineSteps = [
  {
    step: "Create",
    desc: "Generate images and video with AI",
    icon: "\u2726",
  },
  {
    step: "Save",
    desc: "Assets go to your Library",
    icon: "\u2193",
  },
  {
    step: "Claim",
    desc: "Mint to establish ownership",
    icon: "\u2b22",
  },
  {
    step: "Own",
    desc: "Stored in your Collection",
    icon: "\u25c7",
  },
  {
    step: "Use",
    desc: "Assets gain meaning in Astra",
    icon: "\u2192",
  },
];

const HomePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>JoinHavn | Enter the World</title>
        <meta
          name="description"
          content="JoinHavn is a sci-fi ecosystem where you create with AI, own what you make, and use it in Astra Valkyries — a living world with combat, pilots, progression, and rewards."
        />
      </Head>

      <SiteHeader />

      <main className="jh-homepage">
        {/* ── Hero ── */}
        <section className="jh-hero">
          <div className="jh-hero-bg" aria-hidden="true">
            <img
              src="/astra/scenes/nebula_runway_briefing.png"
              alt=""
              className="jh-hero-bg-img"
            />
            <div className="jh-hero-bg-overlay" />
          </div>

          <div className="jh-hero-inner">
            <span className="jh-eyebrow">JoinHavn</span>
            <h1 className="jh-hero-title">
              Enter the world.<br />Own what you create.
            </h1>
            <p className="jh-hero-subtitle">
              Astra Valkyries is a living sci-fi world with combat, pilots, progression, and
              rewards&mdash;powered by HavnAI, a creator-owned AI platform built on decentralized compute.
            </p>
            <div className="jh-hero-actions">
              <a
                href="https://play.joinhavn.io/"
                className="jh-btn jh-btn-primary"
                target="_blank"
                rel="noreferrer"
              >
                Enter Astra
              </a>
              <Link href="/generator" className="jh-btn jh-btn-secondary">
                Start Creating
              </Link>
              <Link href="/join" className="jh-btn jh-btn-tertiary">
                Run a Node
              </Link>
            </div>
          </div>

          <div className="jh-hero-pilots">
            {pilots.map((p) => (
              <div key={p.name} className="jh-pilot-card">
                <img src={p.img} alt={p.name} className="jh-pilot-img" />
                <div className="jh-pilot-info">
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Astra Showcase ── */}
        <section className="jh-showcase">
          <div className="jh-showcase-header">
            <span className="jh-eyebrow">Astra Valkyries</span>
            <h2>A real world. Already built.</h2>
            <p>
              Combat. Pilots. Loadouts. Missions. Progression. Collection. Leaderboards.
            </p>
          </div>
          <div className="jh-showcase-grid">
            {showcaseItems.map((item) => (
              <article key={item.label} className="jh-showcase-card">
                <div className="jh-showcase-img-wrap">
                  <img
                    src={item.img}
                    alt={item.label}
                    className={`jh-showcase-img${item.contain ? " contain" : ""}`}
                  />
                </div>
                <div className="jh-showcase-card-body">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="jh-showcase-cta">
            <a
              href="https://play.joinhavn.io/"
              className="jh-btn jh-btn-primary"
              target="_blank"
              rel="noreferrer"
            >
              Play Now
            </a>
          </div>
        </section>

        {/* ── HavnAI Pipeline ── */}
        <section className="jh-pipeline">
          <div className="jh-pipeline-header">
            <span className="jh-eyebrow">HavnAI Engine</span>
            <h2>Create with AI. Claim what&rsquo;s yours. Use it in the world.</h2>
          </div>
          <div className="jh-pipeline-flow">
            {pipelineSteps.map((s, i) => (
              <div key={s.step} className="jh-pipeline-step">
                <div className="jh-pipeline-icon">{s.icon}</div>
                <strong>{s.step}</strong>
                <span>{s.desc}</span>
                {i < pipelineSteps.length - 1 && (
                  <div className="jh-pipeline-connector" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
          <div className="jh-pipeline-cta">
            <Link href="/generator" className="jh-btn jh-btn-secondary">
              Start Creating
            </Link>
          </div>
        </section>

        {/* ── Network ── */}
        <section className="jh-network">
          <div className="jh-network-inner">
            <div className="jh-network-copy">
              <span className="jh-eyebrow">Decentralized Compute</span>
              <h2>Run a node. Power the engine.</h2>
              <p>
                JoinHavn runs on a decentralized compute network. Contribute your GPU, serve
                live AI jobs, and earn rewards for powering the system.
              </p>
              <Link href="/join" className="jh-btn jh-btn-tertiary">
                Become an Operator
              </Link>
            </div>
          </div>
        </section>

        {/* ── Entry Points ── */}
        <section className="jh-entry">
          <div className="jh-entry-grid">
            <a
              href="https://play.joinhavn.io/"
              className="jh-entry-card"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="/astra/pilots/nova_starling.png"
                alt="Play Astra"
                className="jh-entry-img"
              />
              <div className="jh-entry-overlay">
                <strong>Play</strong>
                <span>Enter Astra Valkyries</span>
              </div>
            </a>
            <Link href="/generator" className="jh-entry-card">
              <img
                src="/astra/scenes/abyss_crown_briefing.png"
                alt="Create"
                className="jh-entry-img"
              />
              <div className="jh-entry-overlay">
                <strong>Create</strong>
                <span>Generate with HavnAI</span>
              </div>
            </Link>
            <Link href="/join" className="jh-entry-card">
              <img
                src="/astra/ships/valkyrie_lancer.png"
                alt="Build"
                className="jh-entry-img"
              />
              <div className="jh-entry-overlay">
                <strong>Build</strong>
                <span>Run a Node</span>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
