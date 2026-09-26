import Link from "next/link";
import { ArrowUpRight, CreditCard, KeyRound, LifeBuoy, Mail, Server, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { SeoHead } from "../components/SeoHead";
import { CommercialFooter } from "../components/CommercialFooter";
import { CREDIT_REFUND_PATH, SUPPORT_EMAIL } from "../lib/creditPolicies";

export default function SupportPage() {
  return <>
    <SeoHead title="HavnAI support" description="Get help with HavnAI credits, payments, your account, creations, and optional wallet or node features." path="/support" />
    <SiteHeader />
    <main className="product-page policy-page support-page">
      <header className="policy-heading support-heading">
        <p className="policy-eyebrow"><LifeBuoy size={17} aria-hidden="true" />HavnAI support</p>
        <h1>Let's get you unstuck.</h1>
        <p>Help with your account, your credits, and what you're creating.</p>
        <a className="product-primary support-email" href={`mailto:${SUPPORT_EMAIL}?subject=HavnAI%20support`}><Mail size={18} aria-hidden="true" />{SUPPORT_EMAIL}<ArrowUpRight size={16} aria-hidden="true" /></a>
        <p className="support-email-note">Opens your email app. Include what happened and what you expected.</p>
      </header>
      <section className="support-topics" aria-label="Support topics">
        <article id="payment-help"><CreditCard size={25} aria-hidden="true" /><h2>Payments &amp; refunds</h2>
          <p>For missing credits, a refund request, or a disputed payment, include the purchase ID, receipt number, purchase date, amount, and a short description.</p>
          <p>Check the purchase status before paying again. A return from checkout alone does not confirm payment.</p>
          <div className="support-topic-links"><Link href="/account">Purchases and receipts<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href={CREDIT_REFUND_PATH}>Refund policy<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        </article>
        <article id="account-help"><KeyRound size={25} aria-hidden="true" /><h2>Account access</h2>
          <p>Tell us which sign-in method you use, your browser and device, and the step that fails. If possible, email from the address associated with your HavnAI account.</p>
          <p>Signing in and accessing account credits or your library does not require MetaMask. Never send a password or verification code.</p>
          <Link href="/sign-in">Sign in to your account<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </article>
        <article id="creation-help"><Sparkles size={25} aria-hidden="true" /><h2>Creations &amp; your library</h2>
          <p>For a missing result, stuck job, or unexpected credit reservation, include the job ID, model, approximate time, and any visible error message.</p>
          <p>Recently deleted creations can be restored privately within 30 days. Restoring does not automatically republish them.</p>
          <div className="support-topic-links"><Link href="/library">Open Collection<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/account/deleted">Deleted creations<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        </article>
        <article id="node-wallet-help"><Server size={25} aria-hidden="true" /><h2>Wallets &amp; nodes</h2>
          <p>Wallets are optional for ordinary account use. For linking, rewards, or other blockchain features, include the network, wallet provider, public transaction hash if relevant, and the error you see.</p>
          <p>For worker problems, include the node ID, operating system, GPU, software version, and a short log excerpt with credentials removed.</p>
          <div className="support-topic-links"><Link href="/account">Account and linked wallets<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/run-a-node">Node setup guide<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        </article>
      </section>
      <aside className="support-privacy"><ShieldCheck size={23} aria-hidden="true" /><div><h2>Keep secrets out of your message.</h2>
        <p>Never send passwords, verification codes, full card numbers, private keys, seed phrases, API keys, or session tokens. Crop sensitive details out of screenshots and remove credentials from logs. A purchase or job ID is enough to start investigating.</p></div></aside>
      <section className="support-followup"><h2>Following up on an issue?</h2><p>Reply to the same email conversation with the relevant purchase or job ID and what is still unresolved. This keeps the details together.</p></section>
    </main>
    <CommercialFooter />
  </>;
}
