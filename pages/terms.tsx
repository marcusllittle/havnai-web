import Link from "next/link";
import { PolicyPage } from "../components/PolicyPage";
import { CREDIT_REFUND_PATH, CREDIT_TERMS_PATH, PLATFORM_TERMS_PATH, PRIVACY_PATH, SUPPORT_EMAIL } from "../lib/creditPolicies";

const sections = [
  { id: "using-havnai", title: "Using HavnAI" },
  { id: "accounts-and-wallets", title: "Accounts and wallets" },
  { id: "credits-and-payments", title: "Credits and payments" },
  { id: "creations-and-ownership", title: "Creations and ownership" },
  { id: "public-content", title: "Public content" },
  { id: "availability-and-support", title: "Availability and support" },
];

export default function PlatformTermsPage() {
  return <PolicyPage title="HavnAI terms" path={PLATFORM_TERMS_PATH}
    description="The practical rules for HavnAI accounts, creation tools, credits, publishing, ownership records, and support." sections={sections}>
    <div className="policy-summary"><strong>Account-first creation. Optional wallet features.</strong><p>These terms describe how to use the HavnAI platform. Credit purchases use the separate credit policy linked from checkout.</p></div>
    <section id="using-havnai"><h2>Using HavnAI</h2>
      <p>Use HavnAI only for lawful creative, account, marketplace, music, game, and node activity. Do not attempt to bypass access controls, abuse the generation queue, scrape private content, interfere with other users, or upload material that you do not have the right to use.</p>
      <p>Generated results can vary by model, prompt, settings, source media, and network capacity. HavnAI does not guarantee that a generation will match a specific creative expectation.</p>
    </section>
    <section id="accounts-and-wallets"><h2>Accounts and wallets</h2>
      <p>Your HavnAI account is the primary identity for account credits, receipts, private library access, purchases, and account-owned marketplace records. Keep your sign-in method secure and contact support if you suspect unauthorized access.</p>
      <p>Wallets are optional for ordinary account use. Wallet features may be used for blockchain rewards, legacy ownership records, HAI funding, or game integrations. Never share private keys, seed phrases, verification codes, API keys, or session tokens with support.</p>
    </section>
    <section id="credits-and-payments"><h2>Credits and payments</h2>
      <p>Paid account credit packs, checkout records, reservations, releases, and payment adjustments are governed by the <Link href={CREDIT_TERMS_PATH}>credit purchase terms</Link>. Refund handling is described in the <Link href={CREDIT_REFUND_PATH}>refund policy</Link>.</p>
      <p>Credits are platform access units for supported HavnAI services. They are not a token purchase, investment, cash account, or promise of earnings.</p>
    </section>
    <section id="creations-and-ownership"><h2>Creations and ownership</h2>
      <p>You keep responsibility for prompts, uploaded source media, and how you use or share outputs. HavnAI needs permission to store, process, display, deliver, moderate, and support your content so the service can operate.</p>
      <p>Generation history, private media, account-owned listings, wallet-owned assets, and game cosmetics are separate records. The <Link href="/ownership">ownership guide</Link> explains where to find each view and how account purchases differ from optional wallet features.</p>
      <p>Download copies of work you want to keep. A library entry, marketplace listing, or game integration is not a guarantee of permanent file storage.</p>
    </section>
    <section id="public-content"><h2>Public content</h2>
      <p>Private creations remain private unless you choose a publish, listing, sharing, or public-discovery action. When you publish or list content, you confirm you have the right to share it and authorize HavnAI to show the public title, preview, price, metadata, and availability needed for that surface.</p>
      <p>Public listings, music publications, marketplace items, and reusable workflows may be reviewed, hidden, removed, or restricted if they appear unsafe, unlawful, misleading, rights-infringing, mature in a public context, or inconsistent with platform operation.</p>
      <p>To report content or an ownership issue, email <a href={`mailto:${SUPPORT_EMAIL}?subject=HavnAI%20content%20report`}>{SUPPORT_EMAIL}</a> with the public URL, listing ID, job ID, or receipt ID and a short explanation.</p>
    </section>
    <section id="availability-and-support"><h2>Availability and support</h2>
      <p>Models, pricing, node capacity, rewards, game integrations, and feature availability can change. Maintenance, failures, queue pressure, external providers, and policy enforcement can affect access.</p>
      <p>Use <Link href="/support">HavnAI support</Link> for account access, billing, generation, content, ownership, wallet, node, and privacy requests. Privacy handling is described in the <Link href={PRIVACY_PATH}>privacy notice</Link>.</p>
    </section>
  </PolicyPage>;
}
