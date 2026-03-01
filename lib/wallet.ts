import { BrowserProvider, getAddress } from "ethers";

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

export function detectProviderConflict(): {
  providers: InjectedProvider[];
  hasConflict: boolean;
  providerName?: string;
  error: WalletError | null;
} {
  const providers = getProviderList(getWindowEthereum());
  if (providers.length === 0) {
    return {
      providers: [],
      hasConflict: false,
      providerName: undefined,
      error: null,
    };
  }

  if (providers.length === 1) {
    return {
      providers,
      hasConflict: false,
      providerName: providers[0].isMetaMask ? "MetaMask" : "Injected wallet",
      error: null,
    };
  }

  const metaMaskProviders = providers.filter((provider) => provider.isMetaMask);
  if (metaMaskProviders.length === 1) {
    return {
      providers: metaMaskProviders,
      hasConflict: true,
      providerName: "MetaMask",
      error: null,
    };
  }

  return {
    providers,
    hasConflict: true,
    providerName: "Multiple wallets",
    error: new WalletError(
      "wallet_conflict",
      "Multiple wallet extensions were detected. Disable extra wallet extensions or make MetaMask the active provider."
    ),
  };
}

export function getInjectedProvider(): InjectedProviderSelection {
  const ethereum = getWindowEthereum();
  if (!ethereum) {
    return {
      provider: null,
      providerName: undefined,
      hasProvider: false,
      hasConflict: false,
      error: null,
    };
  }

  const conflict = detectProviderConflict();
  if (conflict.error) {
    return {
      provider: null,
      providerName: conflict.providerName,
      hasProvider: true,
      hasConflict: true,
      error: conflict.error,
    };
  }

  const provider = conflict.providers[0] || ethereum;
  return {
    provider,
    providerName: conflict.providerName || (provider.isMetaMask ? "MetaMask" : "Injected wallet"),
    hasProvider: true,
    hasConflict: conflict.hasConflict,
    error: null,
  };
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

function requireProvider(provider?: InjectedProvider | null): InjectedProvider {
  const selection = provider
    ? { provider, error: null }
    : getInjectedProvider();
  if (!selection.provider) {
    throw selection.error || new WalletError("wallet_unavailable", "MetaMask not found. Install MetaMask and try again.");
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
  const injected = requireProvider(provider);
  const browserProvider = new BrowserProvider(injected as any);
  const accounts = await browserProvider.send("eth_accounts", []);
  return normalizeAccounts(accounts);
}

export async function requestAccounts(provider?: InjectedProvider | null): Promise<string[]> {
  const injected = requireProvider(provider);
  const browserProvider = new BrowserProvider(injected as any);
  const accounts = await browserProvider.send("eth_requestAccounts", []);
  return normalizeAccounts(accounts);
}

export async function readChainInfo(provider?: InjectedProvider | null): Promise<ChainInfo> {
  const injected = requireProvider(provider);
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
      "MetaMask already has a connection request open. Open the extension and finish or cancel it."
    );
  }
  if (code === 4001 || /user rejected|rejected/i.test(message)) {
    return new WalletError("wallet_rejected", "Wallet connection was rejected in MetaMask.");
  }
  if (/not found|install metamask|wallet unavailable/i.test(message)) {
    return new WalletError("wallet_unavailable", "MetaMask not found. Install MetaMask and try again.");
  }
  if (/multiple wallet/i.test(message)) {
    return new WalletError(
      "wallet_conflict",
      "Multiple wallet extensions were detected. Disable extra wallet extensions or make MetaMask the active provider."
    );
  }
  return new WalletError("wallet_unknown", message || "Wallet connection failed.");
}

export function formatWalletShort(wallet: string | null | undefined): string {
  if (!wallet) return "No wallet";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export function getConnectButtonLabel(snapshot: Pick<WalletSnapshot, "status" | "activeWallet" | "connectedWallet" | "connecting">): string {
  if (snapshot.connecting || snapshot.status === "prompting") return "Check MetaMask";
  if (snapshot.status === "attention" || snapshot.status === "error") return "Retry Connection";
  if (snapshot.connectedWallet) return "Reconnect Wallet";
  if (snapshot.activeWallet) return "Connect Wallet";
  return "Connect Wallet";
}
