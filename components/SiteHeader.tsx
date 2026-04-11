import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { WalletButton } from "./WalletButton";

interface NavItem {
  href: string;
  label: string;
  external?: boolean;
  accent?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "https://play.joinhavn.io/", label: "Astra", external: true, accent: true },
  { href: "/generator", label: "Create" },
  { href: "/library", label: "Collection" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/nodes", label: "Network" },
];

const UTILITY_NAV: NavItem[] = [
  { href: "/pricing", label: "Credits" },
  { href: "/join", label: "Run a Node" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (/^https?:/i.test(href)) return false;
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" onClick={() => setNavOpen(false)}>
          <img src="/HavnAI-logo.png" alt="JoinHavn" className="brand-logo" />
          <span className="brand-name">JoinHavn</span>
        </Link>

        <button
          type="button"
          className={`nav-toggle flagship-nav-toggle ${navOpen ? "nav-open" : ""}`}
          aria-label="Toggle navigation"
          onClick={() => setNavOpen((o) => !o)}
        >
          <span />
          <span />
        </button>

        <nav
          className={`nav-links flagship-nav-links ${navOpen ? "nav-open" : ""}`}
          aria-label="Primary navigation"
        >
          {PRIMARY_NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            const cls = [active && "nav-active", item.accent && "nav-accent"].filter(Boolean).join(" ") || undefined;
            if (item.external) {
              return (
                <a key={item.href} href={item.href} className={cls} target="_blank" rel="noreferrer">
                  {item.label}
                </Link>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={cls}>
                {item.label}
              </Link>
            );
          })}
          <span className="nav-separator" />
          {UTILITY_NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={`nav-utility ${active ? "nav-active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
