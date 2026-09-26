import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FolderOpen, Wallet } from "lucide-react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const ownedHref = "/marketplace?tab=gallery&galleryView=collection";
const faqs = [
  { q: "Does generating an image create a marketplace listing?", a: "No. Publishing is a separate action on an eligible completed result. Review the title, description, and price before publishing to the gallery." },
  { q: "Where can I see an asset’s ownership history?", a: "Open a gallery asset in the marketplace. Its details show the current listing and available ownership history. Use My Collection to find gallery assets linked to your connected wallet." },
  { q: "What happens when a gallery asset is sold?", a: "A completed purchase updates the asset’s recorded owner to the buyer’s wallet. The current owner can hold the asset or use the marketplace’s relisting controls. Astra checks current ownership when loading owned assets." },
  { q: "Do I need the same wallet in Astra?", a: "Yes. Astra looks up gallery assets using the connected wallet. Use the wallet that owns the asset, then open Collection → Owned. Supported assets can be equipped as cosmetic hangar decor." },
];

export default function OwnershipPage() {
  return <>
    <SeoHead title="Collections & ownership on HavnAI" description="Find your generated work, understand wallet-owned gallery assets, and see how supported assets appear in Astra." path="/ownership" image="/astra/scenes/spaceport_hub.png" imageAlt="Astra vehicle inside a blue-lit hangar" schema={{ "@context": "https://schema.org", "@type": "WebPage", name: "Collections and ownership on HavnAI", url: "https://joinhavn.io/ownership", description: "A guide to generation history, gallery ownership records, and supported assets in Astra." }} />
    <SiteHeader />
    <main className="product-page guide-page ownership-guide">
      <section className="guide-heading">
        <span className="product-eyebrow">Collections &amp; ownership</span>
        <h1>Your work.<br />A place for every piece.</h1>
        <p>Revisit what you’ve created, keep track of the gallery assets your wallet owns, and bring supported pieces into Astra.</p>
        <div className="product-actions"><Link className="product-primary" href="/library">Your creations <ArrowUpRight size={16} aria-hidden="true" /></Link><Link className="product-secondary" href={ownedHref}>Your owned assets <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </section>
      <section className="guide-collections" aria-labelledby="collections-title">
        <div className="product-section-heading"><span className="product-eyebrow">Find the right collection</span><h2 id="collections-title">Two views of your creative world.</h2></div>
        <div className="guide-collection-grid">
          <article><div className="guide-collection-icon"><FolderOpen size={24} aria-hidden="true" /><span>Creative workspace</span></div><h3>What you’ve made</h3><p>Collection in the main navigation brings your generation history together. Browse results, inspect jobs, and download available files.</p><ul><li>Image and video generation history</li><li>Job details and available previews</li><li>Downloads and publishing controls</li></ul><Link href="/library">Open Collection <ArrowRight size={16} aria-hidden="true" /></Link></article>
          <article><div className="guide-collection-icon"><Wallet size={24} aria-hidden="true" /><span>Wallet-owned gallery assets</span></div><h3>What your wallet holds</h3><p>My Collection in the marketplace shows gallery assets recorded under your wallet. A completed gallery purchase transfers that ownership record.</p><ul><li>Assets linked to your connected wallet</li><li>Available ownership history</li><li>Controls to hold or relist your assets</li></ul><Link href={ownedHref}>Open owned assets <ArrowRight size={16} aria-hidden="true" /></Link></article>
        </div>
        <p className="product-caption">Download a copy of results you want to keep. A generation-history entry is not a guarantee of permanent file storage.</p>
      </section>
      <section className="guide-astra" aria-labelledby="astra-title">
        <div className="guide-astra-art"><Image src="/astra/scenes/spaceport_hub.png" alt="A futuristic vehicle framed by the blue light of an Astra hangar" fill sizes="(max-width: 760px) 100vw, 50vw" /><span>Astra artwork</span></div>
        <div className="guide-astra-copy"><span className="product-eyebrow">From your collection to your hangar</span><h2 id="astra-title">Make a little space<br />for your style.</h2><p>In Astra, supported wallet-owned gallery assets can become hangar decor. They’re cosmetic: equipping one does not change your gameplay stats.</p><ol><li><span>01</span> Connect the wallet that owns the asset.</li><li><span>02</span> Open Collection → Owned in Astra.</li><li><span>03</span> Choose a supported piece for your hangar.</li></ol><Link className="product-secondary" href="/astra">Explore Astra <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </section>
      <section className="product-faq" aria-labelledby="ownership-faq"><div><span className="product-eyebrow">The details</span><h2 id="ownership-faq">Know where you stand.</h2><Link href="/marketplace">Browse the gallery <ArrowRight size={15} aria-hidden="true" /></Link></div><div>{faqs.map(faq => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div></section>
      <section className="product-outro"><div><span className="product-eyebrow">Keep exploring</span><h2>Your next piece starts here.</h2></div><Link className="product-primary" href="/create">Start creating <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
    </main>
    <footer className="product-footer"><Link href="/">HavnAI home</Link><Link href="/how-it-works">How HavnAI works</Link><Link href="/library">Your creations</Link><Link href="/marketplace">Marketplace</Link></footer>
  </>;
}
