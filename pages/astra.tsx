import { useEffect, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { useWallet } from "../lib/WalletContext";
import { apiGet } from "../lib/api";
import { resolveAssetUrl } from "../lib/havnai";

const GAME_URL = "https://astra.joinhavn.io/";

const zones = [
  {
    name: "Nebula Runway",
    description: "The proving ground. Formation waves over the runway lights, ending at the Aegis Dreadnought.",
    image: "/astra/scenes/nebula_runway_briefing.png",
  },
  {
    name: "Solar Rift",
    description: "Ember light and heat lattices. Faster waves, aimed fire, and the Helios Tyrant waiting at the end.",
    image: "/astra/scenes/solar_rift_briefing.png",
  },
  {
    name: "Abyss Crown",
    description: "The cold dark. Pincer pressure and cryo swarms building to the Cryo Leviathan.",
    image: "/astra/scenes/abyss_crown_briefing.png",
  },
];

const pilots = [
  {
    name: "Nova Starling",
    role: "The ace. Reads a crowded corridor like an open lane.",
    image: "/astra/pilots/nova_starling.png",
  },
  {
    name: "Rex Thunderbolt",
    role: "The hammer. Aggression as technically responsible behavior.",
    image: "/astra/pilots/rex_thunderbolt.png",
  },
  {
    name: "Yuki Frostweaver",
    role: "The calm. The void only feels infinite if you panic.",
    image: "/astra/pilots/yuki_frostweaver.png",
  },
];

const loopSteps = [
  { title: "Play", text: "Fly combat runs. Grades B and up earn shared HavnAI credits, capped daily." },
  { title: "Earn", text: "Rewarded runs also queue a personalized render of your pilot on the GPU grid." },
  { title: "Collect", text: "Generated art lands in your in-game Collection. Spend credits on gacha pulls." },
  { title: "Create", text: "The same credits power the JoinHavn generator. One wallet, one balance." },
];

interface RecentCreation {
  job_id: string;
  pilot_id: string;
  map_id: string;
  grade: string;
  pilot_short: string;
  image_url?: string;
  preview_url?: string;
}

const AstraPage: NextPage = () => {
  const wallet = useWallet();
  const [creations, setCreations] = useState<RecentCreation[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet("/astra/recent?limit=8")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.creations) ? data.creations : [];
        setCreations(list.filter((c: RecentCreation) => c.image_url || c.preview_url));
      })
      .catch(() => {
        // Strip simply doesn't render if the feed is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Display hint only: the game always re-authorizes with its own
  // signature handshake. Never treat a URL wallet as authentication.
  const playUrl = wallet.address
    ? `${GAME_URL}?wallet=${encodeURIComponent(wallet.address)}`
    : GAME_URL;

  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Astra Valkyries",
    url: "https://joinhavn.io/astra",
    image: "https://joinhavn.io/astra/scenes/shmup_combat.png",
    description:
      "Astra Valkyries is the sci-fi world connected to JoinHavn: arcade combat where victories earn shared credits and the GPU network paints your pilot's wins.",
    genre: ["Shooter", "Sci-Fi", "Action"],
    publisher: { "@type": "Organization", name: "JoinHavn", url: "https://joinhavn.io" },
  };

  return (
    <>
      <SeoHead
        title="Astra Valkyries — play, earn, and let the network paint your victories"
        description="Arcade space combat wired into the JoinHavn economy: win runs, earn shared credits, and receive AI-generated art of your own pilot, rendered by the GPU grid."
        path="/astra"
        image="/astra/scenes/shmup_combat.png"
        schema={schema}
      />

      <SiteHeader />

      <main className="jh-page-shell">
        {/* ── Hero ── */}
        <section className="jh-hero">
          <div className="jh-hero-bg" aria-hidden="true">
            <img src="/astra/scenes/shmup_combat.png" alt="" className="jh-hero-bg-img" />
            <div className="jh-hero-bg-overlay" />
          </div>
          <div className="jh-hero-inner">
            <span className="jh-eyebrow">Astra Valkyries</span>
            <h1 className="jh-hero-title">Win the run. The network paints it.</h1>
            <p className="jh-hero-subtitle">
              Arcade space combat wired into a real economy. Victories earn shared HavnAI
              credits — and the GPU grid renders your pilot, your outfit, your zone, your grade.
            </p>
            <div className="jh-hero-actions">
              <a href={playUrl} className="jh-btn jh-btn-primary" target="_blank" rel="noreferrer">
                {wallet.shortAddress ? `Play as ${wallet.shortAddress}` : "Play Astra"}
              </a>
              <Link href="/create" className="jh-btn jh-btn-secondary">
                Open Generator
              </Link>
              <Link href="/marketplace" className="jh-btn jh-btn-tertiary">
                Marketplace
              </Link>
            </div>
          </div>
        </section>

        {/* ── The loop ── */}
        <section className="jh-pipeline">
          <div className="jh-pipeline-header">
            <span className="jh-eyebrow">One wallet, one economy</span>
            <h2>Play. Earn. Collect. Create.</h2>
            <p>
              Astra is not a promo page for the platform — it is the platform, playable.
              The credits you win are the credits that generate.
            </p>
          </div>
          <div className="jh-pipeline-flow">
            {loopSteps.map((step, i) => (
              <div key={step.title} style={{ display: "contents" }}>
                <div className="jh-pipeline-step">
                  <span className="jh-pipeline-icon">{i + 1}</span>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </div>
                {i < loopSteps.length - 1 && <span className="jh-pipeline-connector" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </section>

        {/* ── Fresh from the grid ── */}
        {creations.length > 0 && (
          <section className="jh-showcase">
            <div className="jh-showcase-header">
              <span className="jh-eyebrow">Fresh from the grid</span>
              <h2>Player victories, painted by the network.</h2>
              <p>
                Every one of these was generated for a real run — pilot, outfit, zone,
                and grade straight from the mission that earned it.
              </p>
            </div>
            <div className="jh-showcase-grid">
              {creations.map((creation) => (
                <article key={creation.job_id} className="jh-showcase-card">
                  <div className="jh-showcase-img-wrap">
                    <img
                      src={resolveAssetUrl(creation.image_url ?? creation.preview_url)}
                      alt={`Grade ${creation.grade} victory render on ${creation.map_id.replace(/-/g, " ")}`}
                      className="jh-showcase-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="jh-showcase-card-body">
                    <strong>Grade {creation.grade} — {creation.map_id.replace(/-/g, " ")}</strong>
                    <span>flown by {creation.pilot_short}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Zones ── */}
        <section className="jh-showcase">
          <div className="jh-showcase-header">
            <span className="jh-eyebrow">Three zones</span>
            <h2>Eighteen waves. Three bosses. One route at a time.</h2>
            <p>Clear a zone at grade B or better to unlock the next.</p>
          </div>
          <div className="jh-showcase-grid">
            {zones.map((zone) => (
              <article key={zone.name} className="jh-showcase-card">
                <div className="jh-showcase-img-wrap">
                  <img src={zone.image} alt={zone.name} className="jh-showcase-img" loading="lazy" />
                </div>
                <div className="jh-showcase-card-body">
                  <strong>{zone.name}</strong>
                  <span>{zone.description}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Pilots ── */}
        <section className="jh-characters">
          <div className="jh-showcase-header">
            <span className="jh-eyebrow">The Valkyries</span>
            <h2>Three pilots. Distinct voices. Real dialogue.</h2>
          </div>
          <div className="jh-hero-pilots">
            {pilots.map((pilot) => (
              <article key={pilot.name} className="jh-pilot-card">
                <img src={pilot.image} alt={pilot.name} className="jh-pilot-img" loading="lazy" />
                <div className="jh-pilot-info">
                  <strong>{pilot.name}</strong>
                  <span>{pilot.role}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="jh-hero-actions" style={{ justifyContent: "center", marginTop: "2rem" }}>
            <a href={playUrl} className="jh-btn jh-btn-primary" target="_blank" rel="noreferrer">
              Launch Astra Valkyries
            </a>
            <Link href="/pricing" className="jh-btn jh-btn-tertiary">
              Credits &amp; Pricing
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default AstraPage;
