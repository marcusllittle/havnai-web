import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronDown } from "lucide-react";
import { WalletButton } from "./WalletButton";

interface NavItem {
  href: string;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/create", label: "Create" },
  { href: "/music", label: "Music" },
  { href: "/discover", label: "Discover" },
  { href: "/library", label: "Collection" },
  { href: "/astra", label: "Astra" },
];

const UTILITY_NAV: NavItem[] = [
  { href: "/music/library", label: "Music library" },
  { href: "/video-studio", label: "Video studio" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/nodes", label: "Network" },
  { href: "/pricing", label: "Credits & pricing" },
  { href: "/wallet", label: "Wallet" },
  { href: "/run-a-node", label: "Run a Node" },
  { href: "/how-it-works", label: "How it works" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/music") return pathname === "/music";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const [navOpen, setNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const closeMenus = () => { setNavOpen(false); setMoreOpen(false); };

  useEffect(() => {
    if (!navOpen && !moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) { setNavOpen(false); setMoreOpen(false); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [navOpen, moreOpen]);

  useEffect(() => { setNavOpen(false); setMoreOpen(false); }, [router.asPath]);

  return (
    <header className="site-header" ref={headerRef} onKeyDown={event => {
      if (event.key === "Escape" && (navOpen || moreOpen)) {
        event.preventDefault();
        (navOpen ? toggleRef : moreRef).current?.focus();
        closeMenus();
      }
    }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) closeMenus(); }}>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="HavnAI home" onClick={closeMenus}>
          <img src="/HavnAI-logo.png" alt="" width={40} height={40} className="brand-logo" />
          <span className="brand-wordmark" aria-hidden="true">Havn<span>AI</span></span>
        </Link>

        <button
          type="button"
          ref={toggleRef}
          className={`nav-toggle ${navOpen ? "nav-open" : ""}`}
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          aria-controls="site-primary-nav"
          onClick={() => { setNavOpen((o) => !o); setMoreOpen(false); }}
        >
          <span />
          <span />
        </button>

        <nav
          id="site-primary-nav"
          className={`nav-links ${navOpen ? "nav-open" : ""}`}
          aria-label="Primary navigation"
        >
          <div className="nav-main-links">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined} onClick={closeMenus}>
                {item.label}
              </Link>
            );
          })}
          </div>
          <div className={`nav-more ${moreOpen ? "is-open" : ""}`}>
            <button type="button" className={`nav-more-toggle ${UTILITY_NAV.some(item => isActive(router.pathname, item.href)) ? "nav-active" : ""}`} ref={moreRef} aria-expanded={moreOpen} aria-controls="site-more-nav" onClick={() => setMoreOpen(value => !value)}>More <ChevronDown size={13} aria-hidden="true" /></button>
            <div id="site-more-nav" className="nav-more-links">
          {UTILITY_NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined} onClick={closeMenus}>
                {item.label}
              </Link>
            );
          })}
            </div>
          </div>
          <div className="nav-wallet">
          <WalletButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
