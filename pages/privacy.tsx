import Link from "next/link";
import { PolicyPage } from "../components/PolicyPage";
import { CREDIT_REFUND_PATH, CREDIT_TERMS_PATH, PLATFORM_TERMS_PATH, PRIVACY_PATH, SUPPORT_EMAIL } from "../lib/creditPolicies";

const sections = [
  { id: "what-we-collect", title: "What we collect" },
  { id: "how-we-use-data", title: "How we use data" },
  { id: "content-and-media", title: "Content and media" },
  { id: "payments-wallets-and-nodes", title: "Payments, wallets, and nodes" },
  { id: "sharing-and-retention", title: "Sharing and retention" },
  { id: "choices-and-requests", title: "Choices and requests" },
];

export default function PrivacyPage() {
  return <PolicyPage title="HavnAI privacy notice" path={PRIVACY_PATH}
    description="How HavnAI handles account, creation, payment, wallet, node, support, and public-content data." sections={sections}>
    <div className="policy-summary"><strong>Private by default. Public when you publish.</strong><p>HavnAI uses your data to operate accounts, generation, payments, libraries, marketplace records, support, safety, and node coordination.</p></div>
    <section id="what-we-collect"><h2>What we collect</h2>
      <p>HavnAI may collect account identifiers, sign-in provider details, contact information, session metadata, purchase and receipt records, credit balances and adjustments, prompts, uploaded source media, generated outputs, job settings, publication metadata, support messages, and security logs.</p>
      <p>When you use optional wallet or node features, HavnAI may process public wallet addresses, signed proofs, transaction hashes, node IDs, model capability reports, hardware readiness reports, job routing status, reward activity, and connectivity information.</p>
    </section>
    <section id="how-we-use-data"><h2>How we use data</h2>
      <p>We use data to authenticate accounts, run generation jobs, reserve and charge credits, deliver private media, show account libraries, operate marketplace and music publication surfaces, coordinate worker nodes, investigate support requests, prevent abuse, improve reliability, and meet financial audit needs.</p>
      <p>Operational analytics are used to understand service health, queue behavior, node availability, payment state, and product quality. We do not ask for passwords, private keys, seed phrases, full card numbers, or verification codes in support requests.</p>
    </section>
    <section id="content-and-media"><h2>Content and media</h2>
      <p>Private generated media and account media endpoints require account authorization. Publishing, listing, or sharing content makes selected titles, previews, metadata, prices, and availability public on the relevant surface.</p>
      <p>Deleted creations may remain recoverable for a limited period and may also remain in backups, logs, receipts, audit records, or abuse-prevention records where retention is needed to operate the service.</p>
    </section>
    <section id="payments-wallets-and-nodes"><h2>Payments, wallets, and nodes</h2>
      <p>Payment processors handle card details. HavnAI stores the purchase, receipt, credit, policy-version, and webhook records needed to fund accounts, prevent duplicate credits, investigate disputes, and support refunds under the <Link href={CREDIT_TERMS_PATH}>credit terms</Link> and <Link href={CREDIT_REFUND_PATH}>refund policy</Link>.</p>
      <p>Wallet and node records are used only for the optional features you use, such as wallet linking, HAI funding, rewards, legacy asset lookup, game compatibility, and worker coordination. Public blockchain data may remain visible outside HavnAI.</p>
    </section>
    <section id="sharing-and-retention"><h2>Sharing and retention</h2>
      <p>HavnAI shares data with service providers when needed for authentication, hosting, payment processing, storage, analytics, email, support, security, or legal compliance. Public content is visible to visitors according to the surface where it is published.</p>
      <p>We retain records while needed for account operation, service delivery, user support, security, legal compliance, financial audit, backups, and dispute handling. Retention periods can differ by record type.</p>
    </section>
    <section id="choices-and-requests"><h2>Choices and requests</h2>
      <p>You can choose whether to publish content, link a wallet, run a node, or use wallet-only features. You can download available outputs, restore recently deleted creations when supported, and contact support for account, privacy, content, or deletion requests.</p>
      <p>For privacy requests, email <a href={`mailto:${SUPPORT_EMAIL}?subject=HavnAI%20privacy%20request`}>{SUPPORT_EMAIL}</a> from the address associated with your account when possible. See the <Link href={PLATFORM_TERMS_PATH}>platform terms</Link> for content and account rules.</p>
    </section>
  </PolicyPage>;
}
