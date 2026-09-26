import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/astra", label: "Astra" },
  { href: "/create", label: "Create" },
  { href: "/music", label: "Music" },
  { href: "/discover", label: "Discover" },
  { href: "/music/library", label: "Library" },
  { href: "/video-studio", label: "Video" },
  { href: "/library", label: "Collection" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/nodes", label: "Network" },
  { href: "/pricing", label: "Credits" },
  { href: "/support", label: "Support" },
  { href: "/run-a-node", label: "Run a Node" },
  { href: "/wallet", label: "Wallet" },
  { href: "/how-it-works", label: "How it works" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/music") return pathname === "/music";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const router = useRouter();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="HavnAI home">
          <img src="/HavnAI-logo.png" alt="" width={64} height={64} className="brand-logo" />
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {NAV.map(item => {
            const active = isActive(router.pathname, item.href);
            return <Link key={item.href} href={item.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined}>{item.label}</Link>;
          })}
        </nav>
        <div className="nav-wallet"><WalletButton /></div>
      </div>
    </header>
  );
}
