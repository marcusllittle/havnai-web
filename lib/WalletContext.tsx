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
    address: wallet.connectedWallet || wallet.activeWallet,
    connecting: wallet.connecting,
    connect: async () => {
      await wallet.connect();
    },
    disconnect: wallet.disconnect,
    shortAddress: wallet.activeWallet
      ? `${wallet.activeWallet.slice(0, 6)}...${wallet.activeWallet.slice(-4)}`
      : null,
  };
}
