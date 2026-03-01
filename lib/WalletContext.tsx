import React from "react";
import {
  WalletProvider as AppWalletProvider,
  useWallet as useAppWallet,
} from "../components/WalletProvider";

interface LegacyWalletContextValue {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  shortAddress: string | null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <AppWalletProvider>{children}</AppWalletProvider>;
}

export function useWallet(): LegacyWalletContextValue {
  const wallet = useAppWallet();
  return {
    // Legacy nav/button consumers should only treat an actual MetaMask account
    // as "connected". The env fallback wallet is not disconnectable.
    address: wallet.connectedWallet,
    connecting: wallet.connecting,
    connect: async () => {
      await wallet.connect();
    },
    disconnect: wallet.disconnect,
    shortAddress: wallet.connectedWallet
      ? `${wallet.connectedWallet.slice(0, 6)}...${wallet.connectedWallet.slice(-4)}`
      : null,
  };
}
