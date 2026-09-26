import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";

// This test policy must never be served as commercial purchase terms.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV !== "development") return { notFound: true };
  return { props: {} };
};

export default function SandboxCreditPolicy() {
  return <main className="account-page">
    <Head><title>Sandbox credit test · HavnAI</title><meta name="robots" content="noindex,nofollow" /></Head>
    <h1>Sandbox credit test</h1>
    <p>Test policy version: sandbox-2026-09-25. This page applies only to the local Stripe sandbox test.</p>
    <h2>Test purchases</h2>
    <p>No real money is collected. Use Stripe test payment details only. The displayed prices and credit packs are test values, not approved commercial pricing.</p>
    <p>Test credits belong to your local HavnAI account and have no cash value. They do not transfer to production. Generation reserves credits, captures them on success, and releases them on failure or cancellation.</p>
    <h2>Test refunds</h2>
    <p>During verification, a tester may refund the sandbox payment. The corresponding credit grant is reduced, and the account purchase history records the adjustment. Credits already spent can create an account debt that prevents further spending until covered.</p>
    <p>Test records may be reset after verification. This page is not a production refund policy or commercial agreement.</p>
    <Link href="/pricing">Return to credit packs</Link>
  </main>;
}
