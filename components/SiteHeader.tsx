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
    <header className="site-header flagship-header">
      <div className="header-inner flagship-header-inner">
        <Link href="/" className="brand flagship-brand" onClick={() => setNavOpen(false)}>
          <img src="/HavnAI-logo.png" alt="JoinHavn" className="brand-logo flagship-brand-logo" />
          <span className="flagship-brand-name">JoinHavn</span>
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
          <div className="flagship-nav-list">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(router.pathname, item.href);
              const className = `flagship-nav-link ${active ? "nav-active" : ""} ${item.accent ? "accent" : ""}`.trim();
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={className}
                    onClick={() => setNavOpen(false)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={className}
                  onClick={() => setNavOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flagship-header-actions">
            {UTILITY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flagship-utility-link"
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <WalletButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
