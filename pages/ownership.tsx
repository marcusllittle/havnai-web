import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FolderOpen, Wallet } from "lucide-react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

const ownedHref = "/marketplace";
const faqs = [
  { q: "Does generating an image create a marketplace listing?", a: "No. Publishing is a separate action on an eligible completed result. Review the title, description, and price before publishing to the gallery." },
  { q: "Where can I find assets I own?", a: "Sign in and open the marketplace’s owned listings view. Ordinary purchases belong to your HavnAI account. Older wallet-owned assets remain separate until you explicitly import eligible content through account settings." },
  { q: "What happens when a gallery asset is sold?", a: "A completed account purchase transfers the recorded ownership to the buyer’s account and creates a purchase receipt. The current owner can hold or relist the asset. No MetaMask signature is required for an account purchase." },
  { q: "Do I need the same wallet in Astra?", a: "Yes. Astra looks up gallery assets using the connected wallet. Use the wallet that owns the asset, then open Collection → Owned. Supported assets can be equipped as cosmetic hangar decor." },
];

export default function OwnershipPage() {
  return <>
    <SeoHead title="Collections & ownership on HavnAI" description="Find your account’s generated work and purchased assets, and understand optional wallet features in Astra." path="/ownership" image="/astra/scenes/spaceport_hub.png" imageAlt="Astra vehicle inside a blue-lit hangar" schema={{ "@context": "https://schema.org", "@type": "WebPage", name: "Collections and ownership on HavnAI", url: "https://joinhavn.io/ownership", description: "A guide to generation history, gallery ownership records, and supported assets in Astra." }} />
    <SiteHeader />
    <main className="product-page guide-page ownership-guide">
      <section className="guide-heading">
        <span className="product-eyebrow">Collections &amp; ownership</span>
        <h1>Your work.<br />A place for every piece.</h1>
        <p>Revisit your creations and purchased assets with your HavnAI account. A wallet is optional for separate blockchain and Astra features.</p>
        <div className="product-actions"><Link className="product-primary" href="/library">Your creations <ArrowUpRight size={16} aria-hidden="true" /></Link><Link className="product-secondary" href={ownedHref}>Your owned assets <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </section>
      <section className="guide-collections" aria-labelledby="collections-title">
        <div className="product-section-heading"><span className="product-eyebrow">Find the right collection</span><h2 id="collections-title">Two views of your creative world.</h2></div>
        <div className="guide-collection-grid">
          <article><div className="guide-collection-icon"><FolderOpen size={24} aria-hidden="true" /><span>Creative workspace</span></div><h3>What you’ve made</h3><p>Collection in the main navigation brings your generation history together. Browse results, inspect jobs, and download available files.</p><ul><li>Image and video generation history</li><li>Job details and available previews</li><li>Downloads and publishing controls</li></ul><Link href="/library">Open Collection <ArrowRight size={16} aria-hidden="true" /></Link></article>
          <article><div className="guide-collection-icon"><Wallet size={24} aria-hidden="true" /><span>Account-owned gallery assets</span></div><h3>What your account owns</h3><p>Sign in to the marketplace and select your owned listings. Account purchases transfer the ownership record without a wallet prompt.</p><ul><li>Listings owned by your account</li><li>Account purchase receipts</li><li>Controls to hold or relist your assets</li></ul><Link href={ownedHref}>Open marketplace <ArrowRight size={16} aria-hidden="true" /></Link></article>
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
