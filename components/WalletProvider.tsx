import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureInjectedProvider,
  getAllProviders,
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

const CONNECT_TIMEOUT_MS = 30_000;
const SAFETY_TIMEOUT_MS = 35_000;

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
    return "Multiple wallet extensions detected. MetaMask is being used as the active provider.";
  }
  return "Multiple wallet extensions detected. Using the browser's active wallet provider. If connection fails, disable other wallet extensions or make MetaMask the preferred wallet.";
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
    message: envWallet ? "Using the fallback site wallet for env-based actions." : undefined,
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
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

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
    let selection: InjectedProviderSelection;
    try {
      selection = await ensureInjectedProvider();
    } catch {
      patchSnapshot({
        connectedWallet: null,
        hasProvider: false,
        hasConflict: false,
        error: new WalletError("wallet_unknown", "Failed to detect wallet provider."),
        message: "Failed to detect wallet provider. Try disabling other wallet extensions.",
        connecting: false,
        status: envWallet ? "fallback" : "error",
      });
      return;
    }
    setProvider(selection.provider);

    if (!connectPromiseRef.current) {
      patchSnapshot({
        status: "checking",
        hasProvider: selection.hasProvider,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
      });
    }

    if (!selection.provider) {
      patchSnapshot({
        connectedWallet: null,
        hasProvider: selection.hasProvider,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        chainId: undefined,
        chainName: undefined,
        chainAllowed: true,
        error: selection.error,
        message:
          selection.error?.message ||
          (envWallet ? "Using the fallback site wallet for env-based actions." : undefined),
        connecting: false,
        status: selection.error ? "error" : envWallet ? "fallback" : "idle",
      });
      return;
    }

    try {
      const [accounts, chain] = await Promise.all([
        readConnectedAccounts(selection.provider),
        readChainInfo(selection.provider),
      ]);
      patchSnapshot({
        connectedWallet: accounts[0] || null,
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
          ? "Using the fallback site wallet for env-based actions."
          : undefined,
        connecting: Boolean(connectPromiseRef.current),
        status: accounts[0] ? "connected" : envWallet ? "fallback" : "idle",
      });
    } catch (error) {
      const issue = normalizeWalletError(error);
      patchSnapshot({
        connectedWallet: null,
        hasProvider: true,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        error: issue,
        message: issue.message,
        connecting: Boolean(connectPromiseRef.current),
        status: envWallet ? "fallback" : "error",
      });
    }
  }, [envWallet, patchSnapshot]);

  const dismissError = useCallback(() => {
    const snap = snapshotRef.current;
    patchSnapshot({
      error: null,
      message: envWallet ? "Using the fallback site wallet for env-based actions." : undefined,
      status: snap.connectedWallet ? "connected" : envWallet ? "fallback" : "idle",
    });
  }, [envWallet, patchSnapshot]);

  const disconnect = useCallback(() => {
    clearConnectTimers();
    connectPromiseRef.current = null;
    patchSnapshot({
      connectedWallet: null,
      error: null,
      message: envWallet ? "Using the fallback site wallet for env-based actions." : undefined,
      connecting: false,
      status: envWallet ? "fallback" : "idle",
    });
  }, [clearConnectTimers, envWallet, patchSnapshot]);

  const connect = useCallback(async () => {
    let selection: InjectedProviderSelection;
    try {
      selection = await ensureInjectedProvider();
    } catch (err) {
      const issue = new WalletError("wallet_unknown", "Failed to detect wallet provider. Try disabling other wallet extensions.");
      patchSnapshot({
        error: issue,
        message: issue.message,
        hasProvider: false,
        hasConflict: false,
        connecting: false,
        status: envWallet ? "fallback" : "error",
      });
      throw issue;
    }
    setProvider(selection.provider);

    if (!selection.provider) {
      const issue =
        selection.error || new WalletError("wallet_unavailable", "MetaMask not found. Install MetaMask and try again.");
      patchSnapshot({
        error: issue,
        message: issue.message,
        hasProvider: selection.hasProvider,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        connecting: false,
        status: envWallet ? "fallback" : "error",
      });
      throw issue;
    }

    if (connectPromiseRef.current) {
      const issue = new WalletError(
        "wallet_request_pending",
        "MetaMask already has a connection request open. Open the extension and finish or cancel it."
      );
      patchSnapshot({
        error: issue,
        message: issue.message,
        hasProvider: true,
        hasConflict: selection.hasConflict,
        providerName: selection.providerName,
        connecting: true,
        status: "attention",
      });
      return connectPromiseRef.current;
    }

    clearConnectTimers();
    patchSnapshot({
      error: null,
      message: undefined,
      hasProvider: true,
      hasConflict: selection.hasConflict,
      providerName: selection.providerName,
      connecting: true,
      status: "prompting",
    });

    promptTimerRef.current = window.setTimeout(() => {
      patchSnapshot({
        connecting: true,
        status: "prompting",
        message: "Approve the request in MetaMask to continue.",
      });
    }, 1000);

    attentionTimerRef.current = window.setTimeout(() => {
      const issue = new WalletError(
        "wallet_request_timeout",
        "MetaMask has not finished yet. Open the extension and complete or cancel the request."
      );
      patchSnapshot({
        error: issue,
        message: issue.message,
        connecting: true,
        status: "attention",
      });
    }, 15000);

    // Try multiple providers — if the preferred one fails (proxy intercept, timeout),
    // automatically try the next one. Stop on user rejection.
    const PER_PROVIDER_TIMEOUT_MS = 10_000;
    const allProviders = getAllProviders();
    // Ensure preferred provider is first, then others
    const providerOrder = [selection.provider];
    for (const p of allProviders) {
      if (p !== selection.provider) providerOrder.push(p);
    }

    const tryProviders = async (): Promise<string | null> => {
      let lastError: WalletError | null = null;
      for (let i = 0; i < providerOrder.length; i++) {
        const currentProvider = providerOrder[i];
        const isLast = i === providerOrder.length - 1;
        // Give last provider the full remaining timeout
        const timeout = isLast ? CONNECT_TIMEOUT_MS : PER_PROVIDER_TIMEOUT_MS;

        try {
          const accounts = await withTimeout(
            requestAccounts(currentProvider),
            timeout,
            "Wallet did not respond. Trying next provider..."
          );
          const wallet = accounts[0] || null;
          if (!wallet) {
            throw new WalletError("wallet_unknown", "No wallet account returned.");
          }
          // Success — use this provider
          setProvider(currentProvider);
          const chain = await readChainInfo(currentProvider);
          const hasConflict = providerOrder.length > 1;
          const providerName = currentProvider.isMetaMask ? "MetaMask" : "Browser wallet";
          patchSnapshot({
            connectedWallet: wallet,
            hasProvider: true,
            hasConflict,
            providerName,
            chainId: chain.chainId,
            chainName: chain.chainName,
            chainAllowed: chain.chainAllowed,
            error: null,
            message: hasConflict ? getConflictMessage(providerName) : undefined,
            connecting: false,
            status: "connected",
          });
          return wallet;
        } catch (err) {
          lastError = normalizeWalletError(err);
          // User explicitly rejected — don't try other providers
          if (lastError.code === "wallet_rejected") break;
          // Request already pending in this provider — don't try others
          if (lastError.code === "wallet_request_pending") break;
          // Otherwise (timeout, unknown error) — try next provider
          if (!isLast) {
            console.warn(
              `[WalletProvider] Provider ${i} failed (${lastError.message}), trying next...`
            );
          }
        }
      }

      // All providers failed
      const issue = lastError || new WalletError("wallet_unknown", "Wallet connection failed.");
      if (issue.code === "wallet_request_pending") {
        patchSnapshot({ error: issue, message: issue.message, connecting: false, status: "attention" });
      } else if (issue.code === "wallet_rejected") {
        patchSnapshot({ error: issue, message: issue.message, connecting: false, status: envWallet ? "fallback" : "idle" });
      } else {
        patchSnapshot({ error: issue, message: issue.message, connecting: false, status: envWallet ? "fallback" : "error" });
      }
      throw issue;
    };

    const promise = tryProviders()
      .finally(() => {
        clearConnectTimers();
        connectPromiseRef.current = null;
      });

    connectPromiseRef.current = promise;

    // Safety net: forcefully reset if the promise chain somehow never settles
    safetyTimerRef.current = window.setTimeout(() => {
      if (connectPromiseRef.current) {
        connectPromiseRef.current = null;
        clearConnectTimers();
        patchSnapshot({
          connecting: false,
          error: new WalletError("wallet_unknown", "Connection timed out. Try again."),
          message: "Connection timed out. Try again.",
          status: envWallet ? "fallback" : "error",
        });
      }
    }, SAFETY_TIMEOUT_MS);

    return promise;
  }, [clearConnectTimers, envWallet, patchSnapshot]);

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
      patchSnapshot({
        connectedWallet: null,
        error: null,
        message: envWallet ? "Using the fallback site wallet for env-based actions." : undefined,
        status: envWallet ? "fallback" : "idle",
      });
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
