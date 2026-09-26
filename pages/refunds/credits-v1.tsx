import Link from "next/link";
import { PolicyPage } from "../../components/PolicyPage";
import { CREDIT_REFUND_PATH } from "../../lib/creditPolicies";

const sections = [
  { id: "request-a-refund", title: "Requesting a refund" },
  { id: "credit-adjustments", title: "Full and partial refunds" },
  { id: "disputes", title: "Payment disputes" },
  { id: "spent-credits", title: "Credits already spent" },
  { id: "failed-generation", title: "Failed generation" },
  { id: "records-and-support", title: "Records and support" },
];

export default function CreditRefundsPage() {
  return <PolicyPage title="Credit refunds & disputes" path={CREDIT_REFUND_PATH}
    description="How to ask for payment help and what a refund or dispute means for your credit balance." sections={sections}>
    <div className="policy-summary"><strong>Payment help starts with your purchase record.</strong><p>Keep your purchase ID and receipt handy. You do not need a wallet to request help with a credit-pack payment.</p></div>
    <section id="request-a-refund"><h2>Requesting a refund</h2>
      <p>Contact <Link href="/support#payment-help">HavnAI support</Link> to request a full or partial refund of a paid credit pack. Include the purchase ID, receipt number if available, purchase date, amount, and the reason for your request.</p>
      <p>Refund requests are reviewed individually, taking account of the payment, credit usage, reported issue, and applicable consumer rights. Sending a request does not itself issue a refund. Support will confirm the outcome and any approved amount.</p>
      <p>Approved card refunds are processed through the original payment method. Bank processing times vary. If a refund is pending or missing, contact support instead of making another purchase to resolve it.</p>
    </section>
    <section id="credit-adjustments"><h2>Full and partial refunds</h2>
      <p>A confirmed full refund reverses the credits granted by that purchase. A partial refund reduces that grant in proportion to the refunded amount; the retained credits are rounded down to the nearest 0.001 credit.</p>
      <p>Your account shows the payment adjustment alongside the original receipt. Repeated payment notifications do not create extra refunds or duplicate credit deductions.</p>
    </section>
    <section id="disputes"><h2>Payment disputes</h2>
      <p>Credits associated with the disputed amount are removed from the available grant while a formal payment dispute is open or under review. This can temporarily stop new spending.</p>
      <p>If the dispute is resolved in HavnAI's favor, the dispute-related credit reversal is undone, except for credits already reversed by a refund. If it is resolved in the cardholder's favor, the disputed portion remains reversed. Your account is updated from the confirmed payment outcome.</p>
      <p>Contact support if you do not recognize a charge or need help understanding an adjustment. This support path does not prevent you from exercising rights with your card issuer.</p>
    </section>
    <section id="spent-credits"><h2>When credits have already been spent</h2>
      <p>A refund or dispute can reverse credits you have already used. Your account may then show credit debt and have insufficient available credits for new jobs or purchases. Further spending stays limited until the available balance covers its cost.</p>
      <p>New paid credits first offset any credit debt. Releasing a job reservation does not recreate funding that was refunded. Contact support if you believe a balance or hold is incorrect.</p>
    </section>
    <section id="failed-generation"><h2>Failed generation is a credit release</h2>
      <p>Failed or cancelled generation releases the job's reserved credits. It does not automatically refund the original card payment. A queued or running job keeps its reservation until its outcome is confirmed.</p>
      <p>If a reservation remains after failure or cancellation, send support the job ID. A completed job whose result you dislike, hide, or delete does not automatically reverse its generation charge; you can still contact support about a problem.</p>
    </section>
    <section id="records-and-support"><h2>Records and support</h2>
      <p>View <Link href="/account">Purchases and receipts</Link> for the original purchase and later adjustments. Receipts, ledger entries, and financial audit records are retained when payments are refunded or creations are deleted. Corrections are recorded as new adjustments rather than rewriting the original transaction.</p>
      <p>For a follow-up, reply to your existing support conversation with the purchase or job ID and what remains unresolved. Never include card numbers, passwords, verification codes, or wallet secrets.</p>
      <p>This policy does not limit refunds or other remedies required by applicable consumer law.</p>
    </section>
  </PolicyPage>;
}
