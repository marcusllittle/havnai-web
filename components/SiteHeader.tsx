import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronDown } from "lucide-react";
import { WalletButton } from "./WalletButton";

const MAIN_NAV = [
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
  { href: "/run-a-node", label: "Run a Node" },
];
const EXTRA_NAV = [
  { href: "/wallet", label: "Wallet" },
  { href: "/how-it-works", label: "How it works" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/music") return pathname === "/music";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(2);
  const countRef = useRef(2);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const closeMenus = () => setMoreOpen(false);

  useEffect(() => {
    const nav = navRef.current, wallet = walletRef.current, measure = measureRef.current;
    if (!nav || !wallet || !measure) return;
    let disposed = false;
    const update = () => {
      if (disposed || !nav.clientWidth) return;
      const measurements = Array.from(measure.children) as HTMLElement[];
      const navStyle = getComputedStyle(nav);
      const gap = parseFloat(navStyle.columnGap) || 8;
      const padding = (parseFloat(navStyle.paddingLeft) || 0) + (parseFloat(navStyle.paddingRight) || 0);
      const walletWidth = wallet.getBoundingClientRect().width;
      const available = nav.clientWidth - padding - measurements[MAIN_NAV.length].getBoundingClientRect().width
        - walletWidth - gap * (walletWidth ? 2 : 1) - 2;
      let used = 0, count = 0;
      for (let index = 0; index < MAIN_NAV.length; index += 1) {
        const width = measurements[index].getBoundingClientRect().width + (index ? 4 : 0);
        if (used + width > available) break;
        used += width;
        count += 1;
      }
      // Resizing must not strand keyboard focus on a link that moves between menus.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && (
        (!walletWidth && wallet.contains(focused)) ||
        (walletWidth > 0 && focused.closest(".nav-mobile-wallet"))
      )) moreRef.current?.focus();
      if (focused instanceof HTMLAnchorElement && nav.contains(focused)) {
        const index = MAIN_NAV.findIndex(item => item.href === focused.getAttribute("href"));
        if (index >= 0 && (index < count) !== (index < countRef.current)) moreRef.current?.focus();
      }
      countRef.current = count;
      setVisibleCount(count);
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(nav);
    observer?.observe(wallet);
    observer?.observe(measure);
    window.addEventListener("resize", update);
    void document.fonts?.ready.then(update);
    return () => { disposed = true; observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [moreOpen]);
  useEffect(closeMenus, [router.asPath]);

  const overflow = [...MAIN_NAV.slice(visibleCount), ...EXTRA_NAV];
  const renderLink = (item: { href: string; label: string }) => {
    const active = isActive(router.pathname, item.href);
    return <Link key={item.href} href={item.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined} onClick={closeMenus}>{item.label}</Link>;
  };

  return (
    <header className="site-header" ref={headerRef} onKeyDown={event => {
      if (event.key === "Escape" && moreOpen) {
        event.preventDefault();
        moreRef.current?.focus();
        closeMenus();
      }
    }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) closeMenus(); }}>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="HavnAI home" onClick={closeMenus}>
          <img src="/HavnAI-logo.png" alt="" width={64} height={64} className="brand-logo" />
        </Link>
        <nav ref={navRef} className="nav-links" aria-label="Primary navigation">
          <div className="nav-main-links">{MAIN_NAV.slice(0, visibleCount).map(renderLink)}</div>
          <div className={`nav-more ${moreOpen ? "is-open" : ""}`}>
            <button type="button" className={`nav-more-toggle ${overflow.some(item => isActive(router.pathname, item.href)) ? "nav-active" : ""}`} ref={moreRef} aria-expanded={moreOpen} aria-controls="site-more-nav" onClick={() => setMoreOpen(value => !value)}>More <ChevronDown size={13} aria-hidden="true" /></button>
            <div id="site-more-nav" className="nav-more-links">
              {overflow.map(renderLink)}
              <div className="nav-mobile-wallet"><WalletButton /></div>
            </div>
          </div>
          <div className="nav-wallet" ref={walletRef}><WalletButton /></div>
        </nav>
      </div>
      <div className="nav-measure" aria-hidden="true">
        <div className="nav-measure-row" ref={measureRef}>
          {MAIN_NAV.map(item => <span className="nav-measure-item" key={item.href}>{item.label}</span>)}
          <span className="nav-measure-item nav-measure-more">More <ChevronDown size={13} /></span>
        </div>
      </div>
    </header>
  );
}
