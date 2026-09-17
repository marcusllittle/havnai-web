import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "../lib/WalletContext";

export function WalletButton() {
  const { address, shortAddress, connecting, connect, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const version = useRef(0);
  const menuId = useId();

  useEffect(() => {
    version.current += 1;
    setMenuOpen(false); setCopied(false); setMessage("");
    return () => { version.current += 1; };
  }, [address]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  const handleConnect = async () => {
    const request = ++version.current;
    setMessage("");
    try { await connect(); }
    catch (error) {
      if (request === version.current) setMessage(error instanceof Error ? error.message : "Wallet connection didn’t finish. Please try again.");
    }
  };

  const handleCopy = async () => {
    if (!address) return;
    const request = ++version.current;
    setMessage(""); setCopied(false);
    try {
      await navigator.clipboard.writeText(address);
      if (request === version.current) setCopied(true);
    } catch {
      if (request === version.current) setMessage("Couldn’t copy automatically. Select the address above to copy it.");
    }
  };

  return <div className="wallet-btn-wrapper" ref={ref} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenuOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault(); event.stopPropagation(); setMenuOpen(false); trigger.current?.focus();
    }
  }}>
    <button type="button" ref={trigger} className={`wallet-connect-btn${address ? " wallet-connected" : ""}`} disabled={connecting}
      aria-expanded={address ? menuOpen : undefined} aria-controls={address && menuOpen ? menuId : undefined}
      aria-label={address ? `Wallet ${shortAddress}` : undefined}
      onClick={() => { if (address) { setMenuOpen(value => !value); setMessage(""); setCopied(false); } else { void handleConnect(); } }}>
      {address ? <><span className="wallet-dot" aria-hidden="true" />{shortAddress}</> : connecting ? "Connecting…" : "Connect Wallet"}
    </button>
    {address && menuOpen && <div id={menuId} className="wallet-dropdown" role="group" aria-label="Wallet options">
      <span className="wallet-menu-label">Connected wallet</span>
      <p className="wallet-menu-address">{address}</p>
      <Link className="wallet-dropdown-item" href="/wallet" onClick={() => setMenuOpen(false)}>Wallet &amp; credits</Link>
      <button type="button" className="wallet-dropdown-item" onClick={() => { void handleCopy(); }}>{copied ? "Copied!" : "Copy address"}</button>
      {message && <p className="wallet-menu-feedback" role="status">{message}</p>}
      <button type="button" className="wallet-dropdown-item wallet-dropdown-disconnect" onClick={() => { disconnect(); setMenuOpen(false); }}>Disconnect</button>
    </div>}
    {!address && message && <p className="wallet-connect-feedback" role="alert">{message}</p>}
  </div>;
}
