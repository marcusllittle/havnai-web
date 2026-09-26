import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { SeoHead } from "./SeoHead";
import { SiteHeader } from "./SiteHeader";
import { CommercialFooter } from "./CommercialFooter";
import { CREDIT_POLICY_VERSION } from "../lib/creditPolicies";

export function PolicyPage({ title, description, path, sections, children }: {
  title: string;
  description: string;
  path: string;
  sections: Array<{ id: string; title: string }>;
  children: ReactNode;
}) {
  return <>
    <SeoHead title={title} description={description} path={path} />
    <SiteHeader />
    <main className="product-page policy-page">
      <header className="policy-heading">
        <Link href="/pricing" className="policy-back"><ArrowLeft size={16} aria-hidden="true" />Credit packs</Link>
        <p className="policy-eyebrow"><FileText size={16} aria-hidden="true" />HavnAI account credits<span>{CREDIT_POLICY_VERSION}</span></p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="policy-layout">
        <nav className="policy-contents" aria-label="On this page"><p>On this page</p>{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
        <article className="policy-article">{children}</article>
      </div>
    </main>
    <CommercialFooter />
  </>;
}
