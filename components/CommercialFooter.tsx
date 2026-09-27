import Link from "next/link";
import { CREDIT_REFUND_PATH, CREDIT_TERMS_PATH, PLATFORM_TERMS_PATH, PRIVACY_PATH } from "../lib/creditPolicies";

export function CommercialFooter({ className = "product-footer" }: { className?: string }) {
  return <footer className={className} aria-label="Account, policies and support">
    <Link href="/pricing">Credit packs</Link>
    <Link href="/account">Account and receipts</Link>
    <Link href={PLATFORM_TERMS_PATH}>Terms</Link>
    <Link href={PRIVACY_PATH}>Privacy</Link>
    <Link href="/ownership">Ownership</Link>
    <Link href={CREDIT_TERMS_PATH}>Credit purchase terms</Link>
    <Link href={CREDIT_REFUND_PATH}>Refund policy</Link>
    <Link href="/support">Support</Link>
  </footer>;
}
