import { useEffect, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Gamepad2 } from "lucide-react";
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

      <main className="astra-page">
        <section className="astra-hero" aria-labelledby="astra-title">
          <div className="astra-hero-copy">
            <span className="astra-eyebrow"><Gamepad2 size={15} aria-hidden="true" /> Astra Valkyries</span>
            <h1 id="astra-title">Make every<br />run <em>your own.</em></h1>
            <p>Fly the mission. Earn the credits. Let the GPU network turn your pilot’s victories into art.</p>
            <div className="astra-actions">
              <a href={playUrl} className="astra-button astra-button-primary" target="_blank" rel="noreferrer">
                {wallet.shortAddress ? `Play as ${wallet.shortAddress}` : "Play Astra"} <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <a href="#astra-zones" className="astra-button astra-button-secondary">Explore the universe</a>
            </div>
            <span className="astra-launch-note">Opens the Astra game in a new tab</span>
          </div>
          <figure className="astra-hero-art">
            <Image src="/astra/scenes/shmup_combat.png" alt="A fighter weaving through glowing fire in a space battle" fill priority sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1280px) 53vw, 660px" />
            <figcaption><span>Arcade combat · Astra universe artwork</span><strong>Your next run starts here.</strong></figcaption>
          </figure>
        </section>
        <section className="astra-loop" aria-labelledby="astra-loop-title">
          <div className="astra-section-heading">
            <div><span className="astra-eyebrow">Beyond the high score</span><h2 id="astra-loop-title">One run. More possibilities.</h2></div>
            <p>Shared HavnAI credits connect<br /> what you play with what you create.</p>
          </div>
          <ol className="astra-loop-grid">
            {loopSteps.map((step, index) => (
              <li key={step.title}><span className="astra-step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>
            ))}
          </ol>
          <Link href="/create" className="astra-text-link">Explore the generator <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
        <section id="astra-zones" className="astra-section" aria-labelledby="astra-zones-title">
          <div className="astra-section-heading">
            <div><span className="astra-eyebrow">Choose your horizon</span><h2 id="astra-zones-title">Three zones. One way forward.</h2></div>
            <p>Eighteen waves. Three bosses.<br /> Grade B or better unlocks the next zone.</p>
          </div>
          <div className="astra-zone-grid">
            {zones.map((zone, index) => (
              <article key={zone.name} className="astra-zone-card">
                <div className="astra-zone-art">
                  <Image src={zone.image} alt={`Cockpit view of ${zone.name}`} fill sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 760px) 42vw, (max-width: 1280px) 31vw, 410px" />
                  <span>Zone 0{index + 1}</span>
                </div>
                <div className="astra-zone-copy"><h3>{zone.name}</h3><p>{zone.description}</p></div>
              </article>
            ))}
          </div>
          <p className="astra-art-note">Explore the world through Astra universe artwork.</p>
        </section>
        <section className="astra-section" aria-labelledby="astra-pilots-title">
          <div className="astra-section-heading">
            <div><span className="astra-eyebrow">Meet the Valkyries</span><h2 id="astra-pilots-title">Find your kind of fearless.</h2></div>
            <p>Three pilots. Distinct voices.<br /> Each with a story to fly.</p>
          </div>
          <div className="astra-pilot-grid">
            {pilots.map((pilot) => (
              <article key={pilot.name} className="astra-pilot-card">
                <div className="astra-pilot-art"><Image src={pilot.image} alt={pilot.name} fill sizes="(max-width: 760px) 110px, (max-width: 1280px) 31vw, 410px" /></div>
                <div className="astra-pilot-copy"><h3>{pilot.name}</h3><p>{pilot.role}</p></div>
              </article>
            ))}
          </div>
        </section>
        {creations.length > 0 && (
          <section className="astra-section" aria-labelledby="astra-creations-title">
            <div className="astra-section-heading">
              <div><span className="astra-eyebrow">Fresh from the grid</span><h2 id="astra-creations-title">A victory worth keeping.</h2></div>
              <p>Player renders generated from<br /> the missions that earned them.</p>
            </div>
            <div className="astra-creation-grid">
              {creations.map((creation) => (
                <article key={creation.job_id} className="astra-creation-card">
                  <div className="astra-creation-art">
                    <img src={resolveAssetUrl(creation.image_url || creation.preview_url)} alt={`Grade ${creation.grade} victory render on ${creation.map_id.replace(/-/g, " ")}`} loading="lazy"
                      onError={(event) => { event.currentTarget.hidden = true; }} />
                    <span>Preview unavailable</span>
                  </div>
                  <div><h3>Grade {creation.grade} · {creation.map_id.replace(/-/g, " ")}</h3><p>Flown by {creation.pilot_short}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="astra-endcap" aria-labelledby="astra-endcap-title">
          <div><span className="astra-eyebrow">The universe is waiting</span><h2 id="astra-endcap-title">Take it for a run.</h2><p>Your pilot. Your next victory. Your collection.</p></div>
          <div className="astra-endcap-actions">
            <a href={playUrl} className="astra-button astra-button-primary" target="_blank" rel="noreferrer">Launch Astra Valkyries <ArrowUpRight size={17} aria-hidden="true" /></a>
            <span className="astra-launch-note">Opens the game in a new tab</span>
          </div>
        </section>
        <footer className="astra-footer"><Link href="/create">Create with HavnAI <ArrowRight size={15} aria-hidden="true" /></Link><Link href="/marketplace">Marketplace</Link><Link href="/pricing">Credits &amp; pricing</Link></footer>
      </main>
    </>
  );
};

export default AstraPage;
