import Link from "next/link";
import { PolicyPage } from "../../components/PolicyPage";
import { CREDIT_REFUND_PATH, CREDIT_TERMS_PATH } from "../../lib/creditPolicies";

const sections = [
  { id: "buying-credits", title: "Buying credits" },
  { id: "using-credits", title: "Using credits" },
  { id: "prices-and-versions", title: "Prices and policy versions" },
  { id: "receipts-and-refunds", title: "Receipts and refunds" },
  { id: "public-alpha", title: "Public Alpha" },
  { id: "get-help", title: "Getting help" },
];

export default function CreditTermsPage() {
  return <PolicyPage title="Credit purchase terms" path={CREDIT_TERMS_PATH}
    description="What you buy, how credits are used, and where to find your purchase records." sections={sections}>
    <div className="policy-summary"><strong>One-time packs. Your account. No wallet required.</strong><p>These terms apply to paid credit packs purchased for a HavnAI account.</p></div>
    <section id="buying-credits"><h2>Buying credits</h2>
      <p>A credit pack is a one-time purchase, not a subscription. Review the pack, credit quantity, currency, and payment total before confirming checkout. Credits are added after the payment is confirmed.</p>
      <p>Your credits belong to the HavnAI account used for the purchase. Signing in, paying by card, and using account credits do not require MetaMask or another wallet. Linking or unlinking an optional wallet does not move your account balance.</p>
      <p>Credits provide access to supported HavnAI generation and other services that display a credit price. They have no guaranteed cash value, redemption value, or earnings. Buying credits is not a purchase of HAI tokens or an investment.</p>
    </section>
    <section id="using-credits"><h2>Using credits</h2>
      <p>Generation costs depend on the model and settings. Review the displayed cost before submitting work. A job can be accepted only when your account has enough available credits.</p>
      <ol className="policy-steps">
        <li><strong>Reserved when accepted.</strong> The job's credits are set aside while it is queued or running. You cannot spend those reserved credits again.</li>
        <li><strong>Charged on success.</strong> A completed generation uses the reserved credits. Downloading or deleting its result does not reverse that charge.</li>
        <li><strong>Released on failure or cancellation.</strong> When a job reaches a failed or cancelled state, its reservation is released. A release makes credits available again; it is not a card refund.</li>
      </ol>
      <p>Marketplace purchases have their own displayed credit price and ownership record. They are separate from buying a credit pack.</p>
    </section>
    <section id="prices-and-versions"><h2>Prices and policy versions</h2>
      <p>HavnAI sets the available packs, prices, quantities, and policy version. These may change for future purchases. If your quote changes before a new checkout starts, reload pricing and review the updated terms before paying.</p>
      <p>An existing checkout keeps its original purchase details. Your purchase record retains the policy version and links you accepted; a later policy revision does not rewrite that receipt.</p>
    </section>
    <section id="receipts-and-refunds"><h2>Receipts and refunds</h2>
      <p>Keep the purchase receipt and checkout confirmation for payment status, receipt details, and credit adjustments. Returning from checkout alone does not confirm payment.</p>
      <p>Read the <Link href={CREDIT_REFUND_PATH}>refund policy</Link> before purchasing. Refunds and payment disputes can reverse credits, including credits already spent. Purchase receipts and financial audit records are retained.</p>
    </section>
    <section id="public-alpha"><h2>Public Alpha</h2>
      <p>HavnAI is in Public Alpha. Model availability, queue times, and features can change. Generated results vary, and a successful generation does not guarantee a particular creative result. Save copies of work you want to keep.</p>
      <p>If a service problem leaves a job or balance in an unexpected state, contact support with the job or purchase ID so it can be checked.</p>
    </section>
    <section id="get-help"><h2>Getting help</h2>
      <p>Use <Link href="/support">HavnAI support</Link> for billing, account access, and generation issues. Include the relevant purchase, receipt, or job ID. Never send passwords, verification codes, API keys, or wallet recovery phrases.</p>
      <p>These terms do not limit rights that apply to you under applicable consumer law.</p>
    </section>
  </PolicyPage>;
}
