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
  { href: "https://astra.joinhavn.io", label: "Play Astra", external: true, accent: true },
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
        <Link href="/" className="brand" aria-label="JoinHavn home" onClick={() => setNavOpen(false)}>
          <img src="/HavnAI-logo.png" alt="JoinHavn" className="brand-logo" />
        </Link>

        <button
          type="button"
          className={`nav-toggle ${navOpen ? "nav-open" : ""}`}
          aria-label="Toggle navigation"
          onClick={() => setNavOpen((o) => !o)}
        >
          <span />
          <span />
        </button>

        <nav
          className={`nav-links ${navOpen ? "nav-open" : ""}`}
          aria-label="Primary navigation"
          onClick={() => setNavOpen(false)}
        >
          {PRIMARY_NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            const cls = [active && "nav-active", item.accent && "nav-accent"].filter(Boolean).join(" ") || undefined;
            if (item.external) {
              return (
                <a key={item.href} href={item.href} className={cls} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
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
