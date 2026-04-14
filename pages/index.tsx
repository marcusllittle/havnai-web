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

const shipImages = [
  "/astra/ships/astra_interceptor.png",
  "/astra/ships/valkyrie_lancer.png",
  "/astra/ships/seraph_guard.png",
];

const outfitImages = [
  "/astra/outfits/aurora_borealis.png",
  "/astra/outfits/cloud_walker.png",
  "/astra/outfits/cosmic_surge.png",
  "/astra/outfits/crimson_wing.png",
  "/astra/outfits/desert_storm.png",
  "/astra/outfits/emerald_gale.png",
  "/astra/outfits/frost_nova.png",
  "/astra/outfits/iron_hawk.png",
  "/astra/outfits/lunar_eclipse.png",
  "/astra/outfits/neon_vanguard.png",
  "/astra/outfits/ocean_drift.png",
  "/astra/outfits/shadow_pulse.png",
  "/astra/outfits/solar_flare.png",
  "/astra/outfits/standard_flight_suit.png",
  "/astra/outfits/starfall_armor.png",
  "/astra/outfits/thunder_strike.png",
  "/astra/outfits/violet_tempest.png",
  "/astra/outfits/void_reaper.png",
];

function pickTwoDistinct<T>(pool: T[], fallbackA: T, fallbackB: T): [T, T] {
  if (pool.length < 2) return [fallbackA, fallbackB];
  const a = Math.floor(Math.random() * pool.length);
  let b = Math.floor(Math.random() * pool.length);
  if (b === a) b = (a + 1) % pool.length;
  return [pool[a], pool[b]];
}

function pickN<T>(pool: T[], n: number): T[] {
  const copy = [...pool];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  // If pool is smaller than n, repeat from original to fill
  while (out.length < n && pool.length > 0) {
    out.push(pool[out.length % pool.length]);
  }
  return out;
}

const showcaseItems = [
  {
    label: "Shmup Combat",
    desc: "Arcade shooter action with bosses, combos, and scoring.",
    img: "/astra/scenes/shmup_combat.png",
  },
  {
    label: "Spaceport Hub",
    desc: "Your base of operations between missions.",
    img: "/astra/scenes/spaceport_hub.png",
  },
  {
    label: "Missions & Zones",
    desc: "Three zones. Twelve missions. Three bosses.",
    img: "/astra/scenes/abyss_crown_briefing.png",
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
  // Rotate through Astra ships/outfits on each page load.
  // Initialized to index 0 so SSR/CSR match, then randomized after mount.
  const [shipImg, setShipImg] = useState<string>(shipImages[0]);
  const [outfitImg, setOutfitImg] = useState<string>(outfitImages[0]);
  const [collectionGrid, setCollectionGrid] = useState<string[]>(outfitImages);

  useEffect(() => {
    setShipImg(shipImages[Math.floor(Math.random() * shipImages.length)]);
    const featuredOutfit =
      outfitImages[Math.floor(Math.random() * outfitImages.length)];
    setOutfitImg(featuredOutfit);
    // Show all 18 outfits in a shuffled order so the mosaic feels alive.
    setCollectionGrid(pickN(outfitImages, outfitImages.length));
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
                href="https://astra.joinhavn.io/"
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
              href="https://astra.joinhavn.io/"
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
                    <strong>{Number(networkStats.success_rate || 0).toFixed(0)}%</strong> success rate
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
            {showcaseItems.slice(0, 2).map((item) => (
              <article key={item.label} className="jh-showcase-card">
                <div className="jh-showcase-img-wrap">
                  <img
                    src={item.img}
                    alt={item.label}
                    className="jh-showcase-img"
                  />
                </div>
                <div className="jh-showcase-card-body">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
              </article>
            ))}
            <article className="jh-showcase-card">
              <div className="jh-showcase-img-wrap">
                <img
                  src={shipImg}
                  alt="Ship Loadouts"
                  className="jh-showcase-img contain"
                />
              </div>
              <div className="jh-showcase-card-body">
                <strong>Ship Loadouts</strong>
                <span>Three ships. Weapon kits. Stat synergies.</span>
              </div>
            </article>
            <article className="jh-showcase-card">
              <div className="jh-showcase-img-wrap">
                <img
                  src={outfitImg}
                  alt="Outfits"
                  className="jh-showcase-img contain"
                />
              </div>
              <div className="jh-showcase-card-body">
                <strong>20+ Outfits</strong>
                <span>Cosmetic gear across four rarity tiers.</span>
              </div>
            </article>
            {showcaseItems.slice(2).map((item) => (
              <article key={item.label} className="jh-showcase-card">
                <div className="jh-showcase-img-wrap">
                  <img
                    src={item.img}
                    alt={item.label}
                    className="jh-showcase-img"
                  />
                </div>
                <div className="jh-showcase-card-body">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
              </article>
            ))}
            <article className="jh-showcase-card">
              <div className="jh-showcase-img-wrap jh-collection-mosaic">
                {collectionGrid.map((src, i) => (
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt=""
                    className="jh-collection-tile"
                  />
                ))}
              </div>
              <div className="jh-showcase-card-body">
                <strong>Collection</strong>
                <span>Track what you've created and collected.</span>
              </div>
            </article>
          </div>
          <div className="jh-showcase-cta">
            <a
              href="https://astra.joinhavn.io/"
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
