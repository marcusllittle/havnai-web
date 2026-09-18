import { clearMusicReadSession } from "../lib/musicReadSession";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureInjectedProvider,
  setActiveWalletProvider,
  getConfiguredWallet,
  InjectedProvider,
  InjectedProviderSelection,
  normalizeWalletError,
  readChainInfo,
  readConnectedAccounts,
  requestAccounts,
  WalletError,
  WalletSnapshot,
} from "../lib/wallet";
import { SITE_SESSION_MESSAGE } from "../lib/publicAlpha";
import { clearMusicLibraryCache } from "../lib/musicLibraryCache";

const CONNECT_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WalletError("wallet_unknown", message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface WalletContextValue extends WalletSnapshot {
  connect: () => Promise<string | null>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  dismissError: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function getConflictMessage(providerName?: string): string {
  if (providerName === "MetaMask") {
    return "Multiple wallet extensions detected. HavnAI will use MetaMask as the active wallet.";
  }
  return "Multiple wallet extensions detected. HavnAI will use the browser's active wallet. If connection fails, disable extra wallet extensions or make MetaMask the preferred wallet.";
}

function buildSnapshot(
  prev: WalletSnapshot,
  patch: Partial<WalletSnapshot>,
  envWallet: string | null
): WalletSnapshot {
  const connectedWallet =
    patch.connectedWallet !== undefined ? patch.connectedWallet : prev.connectedWallet;
  const activeWallet = connectedWallet || envWallet || null;
  const source = connectedWallet ? "connected" : envWallet ? "env" : "none";
  let status = patch.status;
  if (!status) {
    if (connectedWallet) status = "connected";
    else if (envWallet) status = "fallback";
    else status = "idle";
  }
  return {
    ...prev,
    ...patch,
    envWallet,
    connectedWallet,
    activeWallet,
    source,
    status,
  };
}

function initialSnapshot(envWallet: string | null): WalletSnapshot {
  return {
    connectedWallet: null,
    envWallet,
    activeWallet: envWallet,
    source: envWallet ? "env" : "none",
    status: envWallet ? "fallback" : "idle",
    error: null,
    message: envWallet ? SITE_SESSION_MESSAGE : undefined,
    providerName: undefined,
    hasProvider: false,
    hasConflict: false,
    chainId: undefined,
    chainName: undefined,
    chainAllowed: true,
    connecting: false,
  };
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envWallet = getConfiguredWallet();
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(() => initialSnapshot(envWallet));
  const [provider, setProvider] = useState<InjectedProvider | null>(null);
  const connectPromiseRef = useRef<Promise<string | null> | null>(null);
  const promptTimerRef = useRef<number | null>(null);
  const attentionTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const selectedRef = useRef<InjectedProviderSelection | null>(null);
  const refreshVersion = useRef(0);
  const explicitlyDisconnected = useRef(false);
  const previousWallet = useRef<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => {
    clearMusicLibraryCache();
    if (previousWallet.current && previousWallet.current !== snapshot.connectedWallet) clearMusicReadSession();
    previousWallet.current = snapshot.connectedWallet;
    return clearMusicLibraryCache;
  }, [snapshot.connectedWallet]);

  const clearConnectTimers = useCallback(() => {
    if (promptTimerRef.current != null) {
      window.clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    if (attentionTimerRef.current != null) {
      window.clearTimeout(attentionTimerRef.current);
      attentionTimerRef.current = null;
    }
    if (safetyTimerRef.current != null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const patchSnapshot = useCallback((patch: Partial<WalletSnapshot>) => {
    setSnapshot((prev) => buildSnapshot(prev, patch, envWallet));
  }, [envWallet]);

  const refresh = useCallback(async () => {
    if (explicitlyDisconnected.current || connectPromiseRef.current) return;
    const version = ++refreshVersion.current;
    let selection: InjectedProviderSelection;
    try {
      selection = selectedRef.current || await ensureInjectedProvider({ allowSdk: false });
    } catch {
      patchSnapshot({
        ...(snapshotRef.current.connectedWallet ? {} : { connectedWallet: null }),
        hasProvider: false,
        hasConflict: false,
        error: new WalletError("wallet_unknown", "Failed to detect wallet provider."),
        message: "Failed to detect wallet provider. Try disabling other wallet extensions.",
        connecting: false,
        status: snapshotRef.current.connectedWallet ? "connected" : envWallet ? "fallback" : "error",
      });
      return;
    }
    if (version !== refreshVersion.current || explicitlyDisconnected.current || connectPromiseRef.current) return;
    // Do not pin an unconnected provider during startup; MetaMask may inject later.
    setProvider(selection.provider);

    if (!connectPromiseRef.current) {
      patchSnapshot({
        status: snapshotRef.current.connectedWallet ? "connected" : "checking",
        hasProvider: selection.hasProvider,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
      });
    }

    if (!selection.provider) {
      patchSnapshot({
        ...(snapshotRef.current.connectedWallet ? {} : { connectedWallet: null }),
        hasProvider: selection.hasProvider,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        chainId: undefined,
        chainName: undefined,
        chainAllowed: true,
        error: selection.error,
        message:
          selection.error?.message ||
          (envWallet ? SITE_SESSION_MESSAGE : undefined),
        connecting: false,
        status: selection.error ? "error" : envWallet ? "fallback" : "idle",
      });
      return;
    }

    try {
      const [accounts, chain] = await Promise.all([
        withTimeout(readConnectedAccounts(selection.provider), 10_000, "Wallet connection check timed out."),
        readChainInfo(selection.provider),
      ]);
      if (version !== refreshVersion.current || explicitlyDisconnected.current || connectPromiseRef.current) return;
      if (accounts.length) {
        selectedRef.current = selection;
        setActiveWalletProvider(selection.provider);
      }
      patchSnapshot({
        connectedWallet: accounts[0]?.toLowerCase() || null,
        hasProvider: true,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        chainId: chain.chainId,
        chainName: chain.chainName,
        chainAllowed: chain.chainAllowed,
        error: null,
        message: selection.hasConflict
          ? getConflictMessage(selection.providerName)
          : envWallet && accounts.length === 0
          ? SITE_SESSION_MESSAGE
          : undefined,
        connecting: Boolean(connectPromiseRef.current),
        status: accounts[0] ? "connected" : envWallet ? "fallback" : "idle",
      });
    } catch (error) {
      if (version !== refreshVersion.current || explicitlyDisconnected.current || connectPromiseRef.current) return;
      const issue = normalizeWalletError(error);
      patchSnapshot({
        ...(snapshotRef.current.connectedWallet ? {} : { connectedWallet: null }),
        hasProvider: true,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        error: issue,
        message: issue.message,
        connecting: Boolean(connectPromiseRef.current),
        status: snapshotRef.current.connectedWallet ? "connected" : envWallet ? "fallback" : "error",
      });
    }
  }, [envWallet, patchSnapshot]);

  const dismissError = useCallback(() => {
    const snap = snapshotRef.current;
    patchSnapshot({
      error: null,
      message: envWallet ? SITE_SESSION_MESSAGE : undefined,
      status: snap.connectedWallet ? "connected" : envWallet ? "fallback" : "idle",
    });
  }, [envWallet, patchSnapshot]);

  const disconnect = useCallback(() => {
    clearMusicReadSession();
    clearMusicLibraryCache();
    selectedRef.current = null;
    setActiveWalletProvider(null);
    explicitlyDisconnected.current = true;
    refreshVersion.current += 1;
    clearConnectTimers();
    connectPromiseRef.current = null;
    patchSnapshot({
      connectedWallet: null,
      error: null,
      message: envWallet ? SITE_SESSION_MESSAGE : undefined,
      connecting: false,
      status: envWallet ? "fallback" : "idle",
    });
  }, [clearConnectTimers, envWallet, patchSnapshot]);

  const connect = useCallback((): Promise<string | null> => {
    if (connectPromiseRef.current) return connectPromiseRef.current;
    if (snapshotRef.current.connectedWallet) return Promise.resolve(snapshotRef.current.connectedWallet);
    explicitlyDisconnected.current = false;
    const version = ++refreshVersion.current;
    clearConnectTimers();
    patchSnapshot({ connecting: true, status: "prompting", error: null, message: "Approve the connection in MetaMask." });

    // Reserve the entire connection operation before provider discovery can yield.
    const operation = Promise.resolve().then(async () => {
      try {
        setActiveWalletProvider(null);
        const selection = await withTimeout(ensureInjectedProvider(), CONNECT_TIMEOUT_MS,
          "Wallet detection timed out. Open MetaMask and try again.");
        if (version !== refreshVersion.current || explicitlyDisconnected.current) return null;
        if (!selection.provider) throw selection.error || new WalletError("wallet_unavailable", "MetaMask was not found. Enable the extension for this site and try again.");
        setProvider(selection.provider);
        // This explicit click must reach the permission RPC even if eth_accounts is stuck.
        const accounts = await withTimeout(requestAccounts(selection.provider), CONNECT_TIMEOUT_MS,
          "MetaMask has not answered. Open the extension to complete or cancel the pending connection request.");
        if (version !== refreshVersion.current || explicitlyDisconnected.current) return null;
        const wallet = accounts[0]?.toLowerCase();
        if (!wallet) throw new WalletError("wallet_unknown", "MetaMask returned no account.");
        selectedRef.current = selection;
        setActiveWalletProvider(selection.provider);
        // Account access is enough to connect; a slow chain RPC must not hide success.
        patchSnapshot({ connectedWallet: wallet, connecting: false, status: "connected", error: null,
          message: undefined, hasProvider: true, hasConflict: selection.hasConflict, providerName: selection.providerName });
        void readChainInfo(selection.provider).then(chain => {
          if (version === refreshVersion.current && !explicitlyDisconnected.current) patchSnapshot(chain);
        });
        return wallet;
      } catch (error) {
        if (version !== refreshVersion.current || explicitlyDisconnected.current) return null;
        const issue = normalizeWalletError(error);
        patchSnapshot({ connecting: false, status: issue.code === "wallet_rejected" ? "idle" : "error", error: issue, message: issue.message });
        throw issue;
      }
    }).finally(() => {
      if (connectPromiseRef.current === operation) connectPromiseRef.current = null;
    });
    connectPromiseRef.current = operation;
    return operation;
  }, [clearConnectTimers, patchSnapshot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!provider || typeof provider.on !== "function" || typeof provider.removeListener !== "function") {
      return;
    }

    const handleAccountsChanged = () => {
      void refresh();
    };
    const handleChainChanged = () => {
      void refresh();
    };
    const handleConnect = () => {
      void refresh();
    };
    const handleDisconnect = () => {
      // Transport interruptions do not revoke account permission. Recheck silently.
      void refresh();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("connect", handleConnect);
    provider.on("disconnect", handleDisconnect);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
      provider.removeListener?.("connect", handleConnect);
      provider.removeListener?.("disconnect", handleDisconnect);
    };
  }, [envWallet, patchSnapshot, provider, refresh]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  const value = useMemo<WalletContextValue>(() => ({
    ...snapshot,
    connect,
    disconnect,
    refresh,
    dismissError,
  }), [connect, disconnect, dismissError, refresh, snapshot]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
