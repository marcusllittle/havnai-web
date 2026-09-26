import Link from "next/link";

const destinations = [
  ["nodes", "Nodes"], ["analytics", "Analytics"], ["run-a-node", "Run a node"],
  ["node-rewards", "Rewards"], ["receipt-anchors", "Receipts"],
] as const;

export function NetworkNavigation({ active }: { active: typeof destinations[number][0] }) {
  return <nav className="network-nav" aria-label="Network pages">
    {destinations.map(([slug, label]) => <Link key={slug} href={`/${slug}`} aria-current={slug === active ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
