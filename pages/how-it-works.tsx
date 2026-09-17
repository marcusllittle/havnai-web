import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FolderOpen, Layers3, Sparkles } from "lucide-react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const steps = [
  { title: "Start with an idea", body: "Choose image or video in Create. Describe the scene, pick an available model, and add a starting image when the selected workflow needs one.", href: "/create", link: "Open Create", icon: Sparkles },
  { title: "Make it your own", body: "Review the result, adjust your prompt, and try another direction. Model availability, settings, and network capacity shape each generation.", href: "/discover", link: "Explore models", icon: Layers3 },
  { title: "Return to your work", body: "Open Collection to browse your generation history, inspect a job, or download an available result. Keep a downloaded copy of the work you want to save.", href: "/library", link: "Open Collection", icon: FolderOpen },
];
const faqs = [
  { q: "Where do I find my generated work?", a: "Collection shows generation history from this browser and, when available, jobs associated with your wallet. Open a result to inspect it or download it. Music has its own library." },
  { q: "Do I have to put my work on the marketplace?", a: "No. Publishing a finished result is a separate action. You can review and download your available results without creating a gallery listing." },
  { q: "What do I need before generating?", a: "Create shows available models and access requirements. Open Access & credits to review your wallet, credits, or access code. Some models also require a source image." },
  { q: "How does the GPU network fit in?", a: "Node operators provide the compute that runs generation jobs. The network pages show reported capacity and activity; availability can change while nodes and models come online or go offline." },
];

export default function HowItWorksPage() {
  return <>
    <SeoHead title="How HavnAI works — from an idea to your next creation" description="Start creating images and video, revisit your work in Collection, and explore the HavnAI marketplace, Astra, and GPU network." path="/how-it-works" image="/create/amber-still-life.webp" imageAlt="Illustrative amber glass still life" schema={{ "@context": "https://schema.org", "@type": "HowTo", name: "Create and revisit your work on HavnAI", step: steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.title, text: step.body })) }} />
    <SiteHeader />
    <main className="product-page guide-page">
      <section className="guide-hero">
        <div className="guide-hero-copy">
          <span className="product-eyebrow">A guide to HavnAI</span>
          <h1>An idea is a<br />good place to start.</h1>
          <p>Describe it. Create it. See where it takes you. Your workspace brings image and video generation together, with room to explore beyond the first result.</p>
          <div className="product-actions"><Link className="product-primary" href="/create">Start creating <ArrowUpRight size={16} aria-hidden="true" /></Link><a className="product-secondary" href="#creative-flow">See the steps <ArrowRight size={16} aria-hidden="true" /></a></div>
        </div>
        <figure className="guide-art">
          <div><Image src="/create/amber-still-life.webp" alt="Amber glass bottle on pale stone, with sunlight passing through curved frosted glass" fill priority sizes="(max-width: 760px) 100vw, 50vw" /></div>
          <figcaption><span>Start with a few words</span><p>“Amber glass. Warm light. A quiet still life.”</p><small>Illustrative AI artwork · results vary</small></figcaption>
        </figure>
      </section>
      <section className="guide-flow" id="creative-flow" aria-labelledby="flow-title">
        <div className="product-section-heading"><span className="product-eyebrow">The creative flow</span><h2 id="flow-title">Three steps. Plenty of possibilities.</h2></div>
        <ol className="guide-steps">{steps.map(({ title, body, href, link, icon: Icon }, index) => <li key={title}><div className="guide-step-top"><span>0{index + 1}</span><Icon size={22} aria-hidden="true" /></div><h3>{title}</h3><p>{body}</p><Link href={href}>{link} <ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ol>
      </section>
      <section className="guide-paths" aria-labelledby="paths-title">
        <div className="product-section-heading"><span className="product-eyebrow">Choose your next direction</span><h2 id="paths-title">There’s more to explore.</h2><p>Follow the parts of HavnAI that fit what you want to make.</p></div>
        <div className="guide-path-grid">
          <Link href="/music" className="guide-path"><span>01 / Sound</span><h3>Find your sound.</h3><p>Create music in the studio, then return to your tracks in the music library.</p><strong>Explore Music <ArrowUpRight size={16} aria-hidden="true" /></strong></Link>
          <Link href="/marketplace" className="guide-path"><span>02 / Exchange</span><h3>Share a finished piece.</h3><p>Browse gallery assets and reusable workflows. Publish eligible results from Create or Collection.</p><strong>Browse Marketplace <ArrowUpRight size={16} aria-hidden="true" /></strong></Link>
          <Link href="/astra" className="guide-path guide-path-astra"><span>03 / Play</span><h3>Enter Astra.</h3><p>Explore the game. Connect the same wallet to see supported gallery assets under Collection → Owned.</p><strong>Explore Astra <ArrowUpRight size={16} aria-hidden="true" /></strong></Link>
        </div>
      </section>
      <aside className="guide-note"><FolderOpen size={24} aria-hidden="true" /><div><h2>Your creations and your owned assets</h2><p>The site’s Collection is your generation history. Marketplace → My Collection tracks wallet-owned gallery assets. Each has its own place.</p><Link href="/ownership">See how collections work <ArrowRight size={15} aria-hidden="true" /></Link></div></aside>
      <section className="product-faq" aria-labelledby="faq-title"><div><span className="product-eyebrow">Good to know</span><h2 id="faq-title">A little clarity before you begin.</h2><Link href="/pricing">Credits &amp; pricing <ArrowRight size={15} aria-hidden="true" /></Link></div><div>{faqs.map(faq => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div></section>
      <section className="product-outro"><div><span className="product-eyebrow">Your first idea</span><h2>See what you can make.</h2></div><Link className="product-primary" href="/create">Open Create <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
    </main>
    <footer className="product-footer"><Link href="/">HavnAI home</Link><Link href="/ownership">Collections &amp; ownership</Link><Link href="/nodes">The GPU network</Link><Link href="/run-a-node">Run a node</Link></footer>
  </>;
}
