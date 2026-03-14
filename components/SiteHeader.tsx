import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { WalletButton } from "./WalletButton";
import { PUBLIC_ALPHA_LABEL } from "../lib/publicAlpha";

interface NavItem {
  href: string;
  label: string;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/generator", label: "Generator", external: true },
  { href: "/library", label: "My Library" },
  { href: "/pricing", label: "Buy Credits" },
  { href: "/analytics", label: "Analytics" },
  { href: "/nodes", label: "Nodes" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/join", label: "Join" },
  { href: "https://astra.joinhavn.io", label: "Play Astra", external: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-meta">
              <span className="brand-status">{PUBLIC_ALPHA_LABEL}</span>
            </div>
            <span className="brand-name">HavnAI Network</span>
          </div>
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
          {NAV_ITEMS.map((item) => {
            const active = isActive(router.pathname, item.href);
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={active ? "nav-active" : undefined}
                >
                  {item.label}
                </a>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-active" : undefined}
              >
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
