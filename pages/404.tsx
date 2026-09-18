import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";

export default function NotFoundPage() {
  return <>
    <SeoHead title="Page not found" description="Find your way back to HavnAI and keep creating." path="/404" noindex />
    <SiteHeader />
    <main className="product-page guide-page notfound-page">
      <section className="guide-heading">
        <span className="product-eyebrow">404 / A little off course</span>
        <h1>Let’s find your<br />next direction.</h1>
        <p>This page has moved or doesn’t exist. Head home, or pick up a new idea in Create.</p>
        <div className="product-actions"><Link className="product-primary" href="/">Back to home <ArrowRight size={16} aria-hidden="true" /></Link><Link className="product-secondary" href="/create">Open Create <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </section>
      <nav className="notfound-links" aria-label="Explore HavnAI"><Link href="/library">Your collection</Link><Link href="/discover">Explore models</Link><Link href="/how-it-works">How HavnAI works</Link></nav>
    </main>
  </>;
}
