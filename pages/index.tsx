import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import {
  fetchAnalyticsOverview,
  fetchGalleryBrowse,
  AnalyticsOverview,
} from "../lib/havnai";

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
    desc: "Track what you've created and collected.",
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
    desc: "Outputs go to your Library",
    icon: "\u2193",
  },
  {
    step: "Collect",
    desc: "Claim and build your collection",
    icon: "\u25c7",
  },
  {
    step: "Trade",
    desc: "List on the Marketplace",
    icon: "\u2192",
  },
];

const HomePage: NextPage = () => {
  const [networkStats, setNetworkStats] = useState<AnalyticsOverview | null>(null);
  const [featuredImg, setFeaturedImg] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsOverview()
      .then(setNetworkStats)
      .catch(() => {});
    // Pull a batch of recent listings and pick one at random so the
    // Create card showcases live renders without pinning to a single "newest".
    fetchGalleryBrowse({ asset_type: "image", sort: "newest", limit: 24 })
      .then((res) => {
        const withImages = res.listings.filter((l) => !!l.image_url);
        if (withImages.length === 0) return;
        const pick = withImages[Math.floor(Math.random() * withImages.length)];
        if (pick?.image_url) setFeaturedImg(pick.image_url);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <title>JoinHavn | Enter the World</title>
        <meta
          name="description"
          content="JoinHavn — create with AI, collect what you make, and enter Astra Valkyries, a sci-fi world with combat, pilots, and progression."
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
            <h1 className="jh-hero-title">
              Enter the world.<br />Own what you create.
            </h1>
            <p className="jh-hero-subtitle">
              Astra Valkyries is a sci-fi world with combat, pilots, and progression.
              Create with HavnAI. Collect what you make.
            </p>
            <div className="jh-hero-actions">
              <a
                href="https://play.joinhavn.io/"
                className="jh-btn jh-btn-primary"
                target="_blank"
                rel="noreferrer"
              >
                Play Astra
              </a>
              <Link href="/generator" className="jh-btn jh-btn-secondary">
                Start Creating
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
                src={featuredImg || "/astra/scenes/abyss_crown_briefing.png"}
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
                src="/astra/scenes/solar_rift_briefing.png"
                alt="Operate"
                className="jh-entry-img"
              />
              <div className="jh-entry-overlay">
                <strong>Operate</strong>
                <span>Power the Network</span>
              </div>
            </Link>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="jh-pipeline">
          <div className="jh-pipeline-header">
            <span className="jh-eyebrow">How It Works</span>
            <h2>Create with AI. Collect what you make. Trade on the Marketplace.</h2>
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
              <span className="jh-eyebrow">The Network</span>
              <h2>Run a node. Power the engine.</h2>
              <p>
                JoinHavn runs on a decentralized compute network. Contribute your GPU, serve
                live AI jobs, and earn rewards for powering the system.
              </p>
              {networkStats && (
                <div className="jh-network-stats">
                  <span className="jh-network-stat">
                    <strong>{networkStats.online_nodes ?? networkStats.active_nodes}</strong> nodes online
                  </span>
                  <span className="jh-network-stat">
                    <strong>{networkStats.total_jobs.toLocaleString()}</strong> jobs served
                  </span>
                  <span className="jh-network-stat">
                    <strong>{(networkStats.success_rate * 100).toFixed(0)}%</strong> success rate
                  </span>
                </div>
              )}
              <Link href="/join" className="jh-btn jh-btn-tertiary">
                Become an Operator
              </Link>
            </div>
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

        {/* ── Characters ── */}
        <section className="jh-characters">
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
      </main>

      <footer className="site-footer">
        <div className="footer-inner footer-layout">
          <div className="footer-col footer-col-left">
            <div className="footer-brand">
              <img src="/HavnAI-logo.png" alt="JoinHavn" className="footer-logo" />
              <div>
                <div className="footer-brand-name">JoinHavn</div>
                <p className="footer-tagline">Decentralized GPU network for AI creators.</p>
              </div>
            </div>
            <p className="footer-copy">&copy; 2025 JoinHavn</p>
          </div>

          <div className="footer-col footer-col-center">
            <h4>Follow</h4>
            <ul>
              <li>
                <a href="https://x.com/joinHAVNAI" target="_blank" rel="noreferrer">
                  Twitter / X
                </a>
              </li>
              <li>
                <a
                  href="https://www.patreon.com/cw/u38989793"
                  target="_blank"
                  rel="noreferrer"
                >
                  Patreon
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col footer-col-right">
            <h4>Contact</h4>
            <a className="footer-email" href="mailto:team@joinhavn.io">
              team@joinhavn.io
            </a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default HomePage;
