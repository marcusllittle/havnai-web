import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getConnectedWallet, connectWallet as mmConnect, setActiveWallet } from "./havnai";

interface WalletContextValue {
  /** Checksummed wallet address or null if not connected */
  address: string | null;
  /** True while MetaMask popup is open */
  connecting: boolean;
  /** Trigger MetaMask connect */
  connect: () => Promise<void>;
  /** Disconnect (clear localStorage, reset to fallback) */
  disconnect: () => void;
  /** Truncated address for display, e.g. "0x7110...9262" */
  shortAddress: string | null;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  shortAddress: null,
});

export function useWallet() {
  return useContext(WalletContext);
}

const STORAGE_KEY = "havnai_connected_wallet";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Sync the module-level active wallet in havnai.ts whenever address changes
  useEffect(() => {
    setActiveWallet(address);
  }, [address]);

  // On mount: restore from localStorage + verify with MetaMask
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setAddress(saved);
      // Verify MetaMask still has this account
      getConnectedWallet()
        .then((current) => {
          if (current && current.toLowerCase() === saved.toLowerCase()) {
            setAddress(current); // use checksummed version
          }
          // If MetaMask doesn't have the saved account, keep it anyway
          // (user may have locked MetaMask but we remember their choice)
        })
        .catch(() => {});
    }
  }, []);

  // Listen for MetaMask account changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ethereum = (window as any).ethereum;
    if (!ethereum?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected all accounts in MetaMask
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        // Import getAddress for checksumming
        import("ethers").then(({ getAddress }) => {
          const addr = getAddress(accounts[0]);
          setAddress(addr);
          localStorage.setItem(STORAGE_KEY, addr);
        });
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const addr = await mmConnect();
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const shortAddress = address ? truncate(address) : null;

  return (
    <WalletContext.Provider value={{ address, connecting, connect, disconnect, shortAddress }}>
      {children}
    </WalletContext.Provider>
  );
}
