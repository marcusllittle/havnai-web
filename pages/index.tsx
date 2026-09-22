import type { NextPage } from "next";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, Cpu, Film, ImagePlus } from "lucide-react";
import { SeoHead, buildWebsiteSchema } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { HomeVideoPreview } from "../components/HomeVideoPreview";
import { homeArtwork, homePortfolio, homeVideo } from "../lib/homeShowcase";
import { fetchAnalyticsOverview, type AnalyticsOverview } from "../lib/havnai";

const creativeTools = [
  { title: "Image Studio", description: "Portraits with presence. Products with polish. Worlds that feel real.", href: "/create", ...homeArtwork.portrait, icon: ImagePlus, label: "Create an image", access: "" },
  { title: "Video Studio", description: "Start with a still. Direct what happens in the next few seconds.", href: "/video-studio", src: homeVideo.poster, alt: homeVideo.alt, icon: Film, label: "Explore Video Studio", access: "Studio key required" },
  { title: "Music Studio", description: "Write the lyrics. Shape the sound. Make a song worth sharing.", href: "/music", ...homeArtwork.music, icon: AudioLines, label: "Explore Music Studio", access: "Studio key required" },
];

const footerGroups = [
  { title: "Create & explore", links: [{ label: "Image & video", href: "/create" }, { label: "Music Studio", href: "/music" }, { label: "Video Studio", href: "/video-studio" }, { label: "Discover music", href: "/discover" }, { label: "Astra Valkyries", href: "/astra" }] },
  { title: "Your Havn", links: [{ label: "Collection", href: "/library" }, { label: "Music library", href: "/music/library" }, { label: "Marketplace", href: "/marketplace" }, { label: "Credits & pricing", href: "/pricing" }, { label: "Ownership", href: "/ownership" }] },
  { title: "The network", links: [{ label: "How it works", href: "/how-it-works" }, { label: "Network status", href: "/nodes" }, { label: "Run a node", href: "/run-a-node" }, { label: "Image generation", href: "/ai-image-generator" }, { label: "Video generation", href: "/ai-video-generator" }] },
];

const HomePage: NextPage = () => {
  const [networkStats, setNetworkStats] = useState<AnalyticsOverview | null>(null);
  useEffect(() => {
    let active = true;
    fetchAnalyticsOverview().then(stats => { if (active) setNetworkStats(stats); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const onlineNodes = networkStats?.online_nodes ?? networkStats?.active_nodes;
  const servedJobs = networkStats?.total_jobs;

  return (
    <>
      <SeoHead title="Explore Astra. Create images, video, and music with AI" description="Explore Astra Valkyries and make something of your own with HavnAI's image, video, and music tools. Create, collect, and discover on a shared GPU network." path="/" image="/astra/home-pilots.png" imageAlt="Three Astra Valkyries pilots in a space hangar" schema={buildWebsiteSchema()} />
      <SiteHeader />
      <main className="havn-home">
        <section className="havn-home-hero" aria-labelledby="home-title">
          <div className="havn-hero-copy">
            <h1 id="home-title">Enter the world.<br /><span>Create beyond it.</span></h1>
            <p>Explore Astra’s sci-fi world. Then make something of your own with AI image, video, and music tools.</p>
            <div className="havn-home-actions"><Link href="/astra" className="havn-button havn-button-primary">Explore Astra <ArrowUpRight size={17} aria-hidden="true" /></Link><Link href="/create" className="havn-button havn-button-secondary">Start creating <ArrowRight size={17} aria-hidden="true" /></Link></div>
          </div>
          <div className="havn-hero-scene">
            <Image src="/astra/home-pilots.png" alt="Three Astra Valkyries pilots in green, red, and white flight suits inside a space hangar" fill sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1328px) 54vw, 690px" priority />
            <div className="havn-scene-caption"><div><strong>Astra Valkyries</strong></div><a href="https://astra.joinhavn.io/" target="_blank" rel="noreferrer" aria-label="Launch Astra in a new tab"><ArrowUpRight size={24} aria-hidden="true" /></a></div>
          </div>
        </section>

        <section className="havn-tools" aria-labelledby="tools-title">
          <div className="havn-section-heading"><div><h2 id="tools-title">Follow the idea.</h2></div><p>Images, motion, and music.<br className="havn-desktop-break" /> Made from your imagination.</p></div>
          <div className="havn-tool-grid">
            {creativeTools.map(tool => <article className="havn-tool-card" key={tool.title}>
              <div className={`havn-tool-art${tool.href === "/create" ? " havn-portrait-art" : tool.href === "/music" ? " havn-music-art" : ""}`}>
                {tool.href === "/video-studio" ? <HomeVideoPreview {...homeVideo} /> : <Image src={tool.src} alt={tool.alt} fill sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1328px) 32vw, 410px" />}
                <span><tool.icon size={18} aria-hidden="true" /></span>
              </div>
              <div className="havn-tool-copy"><h3>{tool.title}</h3><p>{tool.description}</p>{tool.access && <small>{tool.access}</small>}<Link href={tool.href}>{tool.label}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
            </article>)}
          </div>
          <div className="havn-tools-footnote"><span>Selected artwork and creative inspiration. Results vary by prompt and model.</span><Link href="/discover">Hear what others are making <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </section>

        <section className="havn-collection-story" aria-labelledby="collection-title">
          <div className="havn-portfolio" aria-label="Creative portfolio examples">
            {homePortfolio.map(art => <figure key={art.label} className={`havn-portfolio-item havn-portfolio-${art.className}`}>
              <Image src={art.src} alt={art.alt} fill sizes="(max-width: 760px) 30vw, 220px" />
              <figcaption>{art.label}</figcaption>
            </figure>)}
          </div>
          <div className="havn-collection-copy"><h2 id="collection-title">An idea today.<br />A collection tomorrow.</h2><p>Portraits, imagined worlds, films, and songs. Build a body of work with range. Keep your images and clips in Collection, find your songs in Music Library, and publish what you want to share.</p><div className="havn-home-actions"><Link href="/library" className="havn-button havn-button-secondary">Open Collection <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/ownership" className="havn-text-link">How ownership works <ArrowRight size={14} aria-hidden="true" /></Link></div></div>
        </section>

        <section className="havn-network-story" aria-labelledby="network-title">
          <div className="havn-network-icon" aria-hidden="true"><Cpu size={38} strokeWidth={1.2} /></div>
          <div className="havn-network-copy"><h2 id="network-title">Creative tools.<br />Shared computing power.</h2><p>HavnAI runs on a distributed GPU network. Explore how it works, or contribute your GPU to help power the next creation.</p>
            {typeof onlineNodes === "number" && Number.isFinite(onlineNodes) && typeof servedJobs === "number" && Number.isFinite(servedJobs) && <div className="havn-network-stats"><span><strong>{onlineNodes.toLocaleString()}</strong> nodes online</span><span><strong>{servedJobs.toLocaleString()}</strong> jobs served</span></div>}
          </div>
          <div className="havn-network-links"><Link href="/run-a-node" className="havn-button havn-button-primary">Run a node <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/nodes" className="havn-text-link">Explore the network <ArrowRight size={14} aria-hidden="true" /></Link><Link href="/pricing" className="havn-text-link">Credits & pricing <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </section>
      </main>

      <footer className="havn-home-footer">
        <div className="havn-footer-top"><div className="havn-footer-brand"><Link href="/" aria-label="HavnAI home">Havn<span>AI</span></Link><p>A place for your next idea.</p><a href="mailto:team@joinhavn.io">team@joinhavn.io</a></div>
          {footerGroups.map(group => <div className="havn-footer-group" key={group.title}><h2>{group.title}</h2><ul>{group.links.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></div>)}
        </div>
        <div className="havn-footer-bottom"><span>© {new Date().getFullYear()} JoinHavn</span><div><a href="https://x.com/joinHAVNAI" target="_blank" rel="noreferrer">Twitter / X <ArrowUpRight size={12} aria-hidden="true" /></a><a href="https://www.patreon.com/cw/u38989793" target="_blank" rel="noreferrer">Patreon <ArrowUpRight size={12} aria-hidden="true" /></a></div></div>
      </footer>
    </>
  );
};

export default HomePage;
