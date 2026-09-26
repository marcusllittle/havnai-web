import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronDown } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { useAccount } from "./AccountProvider";
import { AccountSessionButton } from "./AccountSessionButton";

const GROUPS = {
  Create: [{ href: "/create", label: "Image" }, { href: "/video-studio", label: "Video" }, { href: "/music", label: "Music" }],
  Network: [{ href: "/nodes", label: "Network overview" }, { href: "/run-a-node", label: "Run a Node" }, { href: "/how-it-works", label: "How it works" }],
  "Your Havn": [{ href: "/account", label: "Your account" }, { href: "/music/library", label: "Library" }, { href: "/library", label: "Collection" }, { href: "/account/deleted", label: "Deleted creations" }, { href: "/wallet", label: "Wallet" }, { href: "/pricing", label: "Credits" }, { href: "/support", label: "Support" }],
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/music" || href === "/account") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const account = useAccount();
  const router = useRouter();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = () => nav.current?.querySelectorAll("details[open]").forEach(item => item.removeAttribute("open"));
    const outside = (event: PointerEvent) => { if (!nav.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const opened = nav.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (opened) { opened.querySelector("summary")?.focus(); close(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => {
    nav.current?.querySelectorAll("details[open]").forEach(item => item.removeAttribute("open"));
  }, [router.asPath]);
  const link = (item: { href: string; label: string }) => {
    const active = isActive(router.pathname, item.href);
    return <Link key={item.href} href={item.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined}
      onClick={() => nav.current?.querySelectorAll("details[open]").forEach(detail => detail.removeAttribute("open"))}>{item.label}</Link>;
  };
  const group = (name: keyof typeof GROUPS) => <details className="nav-group" key={name} onToggle={event => {
    const current = event.currentTarget;
    if (current.open) nav.current?.querySelectorAll("details[open]").forEach(other => { if (other !== current) other.removeAttribute("open"); });
  }}>
    <summary className={GROUPS[name].some(item => isActive(router.pathname, item.href)) ? "nav-group-active" : undefined}>
      {name}<ChevronDown size={14} aria-hidden="true" />
    </summary>
    <div className="nav-group-panel">{GROUPS[name].map(link)}</div>
  </details>;
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="HavnAI home">
          <img src="/HavnAI-logo.png" alt="" width={64} height={64} className="brand-logo" />
        </Link>
        <nav ref={nav} className="nav-links" aria-label="Primary navigation">
          {group("Create")}
          {link({ href: "/discover", label: "Discover" })}
          {link({ href: "/astra", label: "Astra" })}
          {link({ href: "/marketplace", label: "Marketplace" })}
          {group("Network")}
          {group("Your Havn")}
        </nav>
        <div className="nav-wallet">{account.configured
          ? <AccountSessionButton />
          : <WalletButton />}</div>
      </div>
    </header>
  );
}
