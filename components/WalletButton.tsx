import React, { useState, useEffect, useRef } from "react";
import { useWallet } from "../lib/WalletContext";

export function WalletButton() {
  const { address, shortAddress, connecting, connect, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!address) {
    return (
      <button
        type="button"
        className="wallet-connect-btn"
        onClick={connect}
        disabled={connecting}
      >
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="wallet-btn-wrapper" ref={ref}>
      <button
        type="button"
        className="wallet-connect-btn wallet-connected"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span className="wallet-dot" />
        {shortAddress}
      </button>
      {menuOpen && (
        <div className="wallet-dropdown">
          <button type="button" className="wallet-dropdown-item" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy Address"}
          </button>
          <button
            type="button"
            className="wallet-dropdown-item wallet-dropdown-disconnect"
            onClick={() => { disconnect(); setMenuOpen(false); }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
