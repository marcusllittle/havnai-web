import { getAddress } from "ethers";
import type { MetaMaskSDK as MetaMaskSDKType } from "@metamask/sdk";

export const ZERO_WALLET = "0x0000000000000000000000000000000000000000";
export const WALLET =
  process.env.NEXT_PUBLIC_HAVNAI_WALLET && process.env.NEXT_PUBLIC_HAVNAI_WALLET.length > 0
    ? process.env.NEXT_PUBLIC_HAVNAI_WALLET
    : ZERO_WALLET;

const CHAIN_NAME_BY_ID: Record<string, string> = {
  "0x1": "Ethereum",
  "0x89": "Polygon",
  "0x13881": "Mumbai",
  "0x2105": "Base",
  "0x14a34": "Base Sepolia",
  "0xaa36a7": "Sepolia",
  "0xa4b1": "Arbitrum One",
  "0x66eee": "Arbitrum Sepolia",
  "0xa": "Optimism",
  "0x14a33": "Optimism Sepolia",
};

const ALLOWED_CHAIN_IDS = (process.env.NEXT_PUBLIC_HAVNAI_ALLOWED_CHAIN_IDS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const METAMASK_SDK_ENABLED = !["0", "false", "no", "off"].includes(
  String(process.env.NEXT_PUBLIC_METAMASK_SDK_ENABLED ?? "true").trim().toLowerCase()
);
const METAMASK_DAPP_NAME =
  String(process.env.NEXT_PUBLIC_METAMASK_DAPP_NAME || "HavnAI Network").trim() || "HavnAI Network";
const METAMASK_DAPP_URL = String(
  process.env.NEXT_PUBLIC_METAMASK_DAPP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
).trim();

let metaMaskSdkInstance: MetaMaskSDKType | null = null;
let metaMaskSdkProvider: InjectedProvider | null = null;
let metaMaskSdkInitPromise: Promise<InjectedProvider | null> | null = null;

export type WalletSource = "connected" | "env" | "none";
export type WalletStatus =
  | "idle"
  | "checking"
  | "prompting"
  | "attention"
  | "connected"
  | "fallback"
  | "error";
export type WalletErrorCode =
  | "wallet_unavailable"
  | "wallet_request_pending"
  | "wallet_request_timeout"
  | "wallet_rejected"
  | "wallet_conflict"
  | "wallet_unknown";

export interface WalletSnapshot {
  connectedWallet: string | null;
  envWallet: string | null;
  activeWallet: string | null;
  source: WalletSource;
  status: WalletStatus;
  error: WalletError | null;
  message?: string;
  providerName?: string;
  hasProvider: boolean;
  hasConflict: boolean;
  chainId?: string;
  chainName?: string;
  chainAllowed: boolean;
  connecting: boolean;
}

export interface ChainInfo {
  chainId?: string;
  chainName?: string;
  chainAllowed: boolean;
}

export interface InjectedProvider {
  isMetaMask?: boolean;
  providers?: InjectedProvider[];
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
}

export interface InjectedProviderSelection {
  provider: InjectedProvider | null;
  providerName?: string;
  hasProvider: boolean;
  hasConflict: boolean;
  error: WalletError | null;
}

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

export class WalletError extends Error {
  code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

export function isUsableWallet(wallet: string | null | undefined): wallet is string {
  if (!wallet) return false;
  const trimmed = wallet.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== ZERO_WALLET.toLowerCase();
}

export function getConfiguredWallet(): string | null {
  return isUsableWallet(WALLET) ? WALLET : null;
}

function getWindowEthereum(): InjectedProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return window.ethereum;
}

function getMetaMaskDappUrl(): string | undefined {
  if (METAMASK_DAPP_URL) return METAMASK_DAPP_URL;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return undefined;
}

async function initMetaMaskSdkProvider(): Promise<InjectedProvider | null> {
  if (metaMaskSdkProvider && isProviderUsable(metaMaskSdkProvider)) {
    return metaMaskSdkProvider;
  }
  if (typeof window === "undefined" || !METAMASK_SDK_ENABLED) {
    return null;
  }
  if (metaMaskSdkInitPromise) {
    return metaMaskSdkInitPromise;
  }

  metaMaskSdkInitPromise = (async () => {
    try {
      const sdkModule = await import("@metamask/sdk");
      const MetaMaskSDKCtor =
        (sdkModule.default || (sdkModule as any).MetaMaskSDK) as
          | (new (options?: Record<string, unknown>) => MetaMaskSDKType)
          | undefined;

      if (typeof MetaMaskSDKCtor !== "function") {
        return null;
      }

      const dappUrl = getMetaMaskDappUrl();
      metaMaskSdkInstance = new MetaMaskSDKCtor({
        dappMetadata: {
          name: METAMASK_DAPP_NAME,
          ...(dappUrl ? { url: dappUrl } : {}),
        },
        checkInstallationImmediately: false,
        injectProvider: false,
        useDeeplink: true,
        logging: {
          developerMode: false,
          sdk: false,
        },
      });

      if (typeof (metaMaskSdkInstance as any).init === "function") {
        await (metaMaskSdkInstance as any).init();
      }

      const provider = (metaMaskSdkInstance as any).getProvider?.();
      if (isProviderUsable(provider)) {
        metaMaskSdkProvider = provider;
        return metaMaskSdkProvider;
      }
      return null;
    } catch (error) {
      console.warn("[wallet] MetaMask SDK provider initialization failed", error);
      return null;
    } finally {
      if (!metaMaskSdkProvider) {
        metaMaskSdkInitPromise = null;
      }
    }
  })();

  return metaMaskSdkInitPromise;
}

function dedupeProviders(providers: InjectedProvider[]): InjectedProvider[] {
  return providers.filter((provider, index) => providers.indexOf(provider) === index);
}

function getProviderList(root: InjectedProvider | undefined): InjectedProvider[] {
  if (!root) return [];
  if (Array.isArray(root.providers) && root.providers.length > 0) {
    return dedupeProviders(root.providers);
  }
  return [root];
}

function isProviderUsable(provider: InjectedProvider | undefined | null): provider is InjectedProvider {
  return Boolean(provider && typeof provider.request === "function");
}

function isProviderHealthy(provider: InjectedProvider): boolean {
  try {
    // Verify request is a callable function, not a throwing proxy trap
    return typeof provider.request === "function" && typeof provider.request.bind === "function";
  } catch {
    return false;
  }
}

function isRealMetaMask(provider: InjectedProvider): boolean {
  // Coinbase Wallet and others set isMetaMask=true for compat.
  // Real MetaMask has _metamask, and does NOT have isCoinbaseWallet/isBraveWallet/etc.
  if (!provider.isMetaMask) return false;
  if ((provider as any).isCoinbaseWallet) return false;
  if ((provider as any).isBraveWallet) return false;
  if ((provider as any).isPhantom) return false;
  if ((provider as any).isRabby) return false;
  // Real MetaMask typically exposes _metamask object
  if ((provider as any)._metamask) return true;
  return true;
}

function choosePreferredProvider(
  root: InjectedProvider | undefined,
  providers: InjectedProvider[]
): { provider: InjectedProvider | null; providerName?: string } {
  // Prefer a provider that is genuinely MetaMask (not an impersonator)
  if (isProviderUsable(root) && isRealMetaMask(root)) {
    return { provider: root, providerName: "MetaMask" };
  }

  const realMetaMask = providers.find((provider) => isRealMetaMask(provider) && isProviderUsable(provider));
  if (realMetaMask) {
    return { provider: realMetaMask, providerName: "MetaMask" };
  }

  // Fallback: any provider claiming isMetaMask (might be impersonator but better than nothing)
  if (isProviderUsable(root) && root.isMetaMask) {
    return { provider: root, providerName: "MetaMask" };
  }

  const metaMaskProvider = providers.find((provider) => provider.isMetaMask && isProviderUsable(provider));
  if (metaMaskProvider) {
    return { provider: metaMaskProvider, providerName: "MetaMask" };
  }

  if (isProviderUsable(root)) {
    return {
      provider: root,
      providerName: root.isMetaMask ? "MetaMask" : "Browser wallet",
    };
  }

  const firstUsableProvider = providers.find((provider) => isProviderUsable(provider));
  if (firstUsableProvider) {
    return {
      provider: firstUsableProvider,
      providerName: firstUsableProvider.isMetaMask ? "MetaMask" : "Injected wallet",
    };
  }

  return { provider: null, providerName: undefined };
}

export function detectProviderConflict(): {
  providers: InjectedProvider[];
  provider: InjectedProvider | null;
  hasConflict: boolean;
  providerName?: string;
  error: WalletError | null;
} {
  const root = getWindowEthereum();
  const providers = getProviderList(root);
  if (providers.length === 0) {
    return {
      providers: [],
      provider: null,
      hasConflict: false,
      providerName: undefined,
      error: null,
    };
  }

  if (providers.length === 1) {
    const provider = choosePreferredProvider(root, providers);
    return {
      providers,
      provider: provider.provider,
      hasConflict: false,
      providerName: provider.providerName || (providers[0].isMetaMask ? "MetaMask" : "Injected wallet"),
      error: null,
    };
  }

  // Reuse the preferred-provider selector so multi-wallet installs stay on one code path.
  const preferred = choosePreferredProvider(root, providers);
  if (preferred.provider) {
    return {
      providers,
      provider: preferred.provider,
      hasConflict: true,
      providerName: preferred.providerName || "Browser wallet",
      error: null,
    };
  }

  // Multiple providers claim isMetaMask (e.g. Brave Wallet, Coinbase Wallet).
  // Filter out known imposters and pick the real MetaMask if possible.
  const metaMaskProviders = providers.filter((p: any) => p.isMetaMask);
  if (metaMaskProviders.length > 1) {
    const realMM = metaMaskProviders.filter(
      (p: any) => !p.isBraveWallet && !p.isCoinbaseWallet && !p.isTokenary
    );
    if (realMM.length >= 1) {
      return {
        providers: [realMM[0]],
        provider: realMM[0],
        hasConflict: true,
        providerName: "MetaMask",
        error: null,
      };
    }
  }

  // Fallback: can't identify the real MetaMask, but still pick the first
  // provider so the user can at least attempt to connect.
  return {
    providers: [providers[0]],
    provider: providers[0],
    hasConflict: true,
    providerName: providers[0].isMetaMask ? "MetaMask" : "Injected wallet",
    error: null,
  };
}

export function getInjectedProvider(): InjectedProviderSelection {
  const ethereum = getWindowEthereum();
  if (!ethereum) {
    if (isProviderUsable(metaMaskSdkProvider)) {
      return {
        provider: metaMaskSdkProvider,
        providerName: "MetaMask",
        hasProvider: true,
        hasConflict: false,
        error: null,
      };
    }
    return {
      provider: null,
      providerName: undefined,
      hasProvider: false,
      hasConflict: false,
      error: null,
    };
  }

  const conflict = detectProviderConflict();

  // Even when conflict detection reports an error, still try to find a usable
  // provider rather than giving up — the user should be able to attempt a
  // connection with whatever wallet is available.
  const preferred = conflict.provider || conflict.providers[0] || ethereum;

  if (!preferred || !isProviderUsable(preferred)) {
    // Genuinely no usable provider found.
    return {
      provider: null,
      providerName: conflict.providerName,
      hasProvider: Boolean(ethereum),
      hasConflict: conflict.hasConflict,
      error: conflict.error || null,
    };
  }

  // If the preferred provider fails a health check (e.g. a proxy extension wrapping
  // window.ethereum), try alternatives before giving up.
  if (!isProviderHealthy(preferred)) {
    const healthy = conflict.providers.find((p) => p !== preferred && isProviderHealthy(p));
    if (healthy) {
      return {
        provider: healthy,
        providerName: healthy.isMetaMask ? "MetaMask" : "Injected wallet",
        hasProvider: true,
        hasConflict: true,
        error: null,
      };
    }
    // Last resort: try raw window.ethereum if it's different from preferred
    if (ethereum && ethereum !== preferred && isProviderHealthy(ethereum)) {
      return {
        provider: ethereum,
        providerName: ethereum.isMetaMask ? "MetaMask" : "Browser wallet",
        hasProvider: true,
        hasConflict: true,
        error: null,
      };
    }
  }

  return {
    provider: preferred,
    providerName: conflict.providerName || (preferred.isMetaMask ? "MetaMask" : "Injected wallet"),
    hasProvider: true,
    hasConflict: conflict.hasConflict,
    error: null,
  };
}

export async function ensureInjectedProvider(): Promise<InjectedProviderSelection> {
  const current = getInjectedProvider();
  if (current.provider) {
    return current;
  }

  const sdkProvider = await initMetaMaskSdkProvider();
  if (isProviderUsable(sdkProvider)) {
    return {
      provider: sdkProvider,
      providerName: "MetaMask",
      hasProvider: true,
      hasConflict: false,
      error: null,
    };
  }

  return current;
}

function normalizeAccounts(rawAccounts: unknown): string[] {
  if (!Array.isArray(rawAccounts)) return [];
  return rawAccounts
    .map((account) => {
      try {
        return getAddress(String(account));
      } catch {
        return null;
      }
    })
    .filter((account): account is string => Boolean(account));
}

async function requireProvider(provider?: InjectedProvider | null): Promise<InjectedProvider> {
  if (isProviderUsable(provider)) {
    return provider;
  }
  const selection = await ensureInjectedProvider();
  if (!selection.provider) {
    throw (
      selection.error ||
      new WalletError(
        "wallet_unavailable",
        "No compatible wallet was found. Install MetaMask or open a supported browser wallet and try again."
      )
    );
  }
  return selection.provider;
}

function normalizeChainId(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${Number.parseInt(trimmed, 10).toString(16)}`;
}

function chainAllowed(chainId?: string): boolean {
  if (!chainId || ALLOWED_CHAIN_IDS.length === 0) return true;
  return ALLOWED_CHAIN_IDS.includes(chainId.toLowerCase());
}

export async function readConnectedAccounts(provider?: InjectedProvider | null): Promise<string[]> {
  const injected = await requireProvider(provider);
  const accounts = await injected.request({ method: "eth_accounts" });
  return normalizeAccounts(accounts);
}

export async function requestAccounts(provider?: InjectedProvider | null): Promise<string[]> {
  const injected = await requireProvider(provider);
  const accounts = await injected.request({ method: "eth_requestAccounts" });
  return normalizeAccounts(accounts);
}

export async function readChainInfo(provider?: InjectedProvider | null): Promise<ChainInfo> {
  const injected = await requireProvider(provider);
  try {
    const rawChainId = await injected.request({ method: "eth_chainId" });
    const chainId = normalizeChainId(rawChainId);
    return {
      chainId,
      chainName: chainId ? CHAIN_NAME_BY_ID[chainId] || chainId : undefined,
      chainAllowed: chainAllowed(chainId),
    };
  } catch {
    return {
      chainId: undefined,
      chainName: undefined,
      chainAllowed: true,
    };
  }
}

export function normalizeWalletError(error: unknown): WalletError {
  if (error instanceof WalletError) {
    return error;
  }

  const code =
    typeof error === "object" && error && "code" in error
      ? Number((error as { code?: number | string }).code)
      : undefined;
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";

  if (code === -32002) {
    return new WalletError(
      "wallet_request_pending",
      "A wallet connection request is already open. Finish or cancel it in your wallet."
    );
  }
  if (code === 4001 || /user rejected|rejected/i.test(message)) {
    return new WalletError("wallet_rejected", "Wallet connection was rejected.");
  }
  if (/not found|install metamask|wallet unavailable/i.test(message)) {
    return new WalletError(
      "wallet_unavailable",
      "No compatible wallet was found. Install MetaMask or open a supported browser wallet and try again."
    );
  }
  if (/multiple wallet/i.test(message)) {
    return new WalletError(
      "wallet_conflict",
      "Multiple wallet extensions were detected. Disable extra wallet extensions or make one wallet the active provider."
    );
  }
  return new WalletError("wallet_unknown", message || "Wallet connection failed.");
}

/**
 * Returns all available providers ordered by preference (MetaMask first).
 * Used by connect() to retry with fallback providers when the preferred one fails.
 */
export function getAllProviders(): InjectedProvider[] {
  const ethereum = getWindowEthereum();
  if (!ethereum) {
    return isProviderUsable(metaMaskSdkProvider) ? [metaMaskSdkProvider] : [];
  }
  const conflict = detectProviderConflict();
  const seen = new Set<InjectedProvider>();
  const result: InjectedProvider[] = [];

  // Preferred provider first
  if (conflict.provider && isProviderUsable(conflict.provider)) {
    seen.add(conflict.provider);
    result.push(conflict.provider);
  }

  // Then remaining providers from the array
  for (const p of conflict.providers) {
    if (!seen.has(p) && isProviderUsable(p)) {
      seen.add(p);
      result.push(p);
    }
  }

  // Root ethereum as last resort if not already included
  if (!seen.has(ethereum) && isProviderUsable(ethereum)) {
    result.push(ethereum);
  }

  if (isProviderUsable(metaMaskSdkProvider) && !seen.has(metaMaskSdkProvider)) {
    result.push(metaMaskSdkProvider);
  }

  return result;
}

export function formatWalletShort(wallet: string | null | undefined): string {
  if (!wallet) return "No wallet";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export function getConnectButtonLabel(snapshot: Pick<WalletSnapshot, "status" | "activeWallet" | "connectedWallet" | "connecting">): string {
  if (snapshot.connecting || snapshot.status === "prompting") return "Check Wallet";
  if (snapshot.status === "attention" || snapshot.status === "error") return "Retry Wallet Connection";
  if (snapshot.connectedWallet) return "Switch Wallet";
  return "Connect Wallet";
}
