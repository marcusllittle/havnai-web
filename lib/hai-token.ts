/**
 * HAI Token Service — Frontend ERC-20 interaction for HavnAI.
 *
 * Provides balance reads and transfer-to-treasury for the HAI token on Sepolia.
 * Uses ethers v6 (already in project dependencies).
 *
 * On-chain functions used (v0.1):
 *   - balanceOf(address) — read HAI balance
 *   - transfer(address, uint256) — send HAI to treasury
 *   - decimals() — token precision
 *
 * No approve/transferFrom needed. No payment contract needed.
 * Standard ERC-20 ABI is sufficient.
 */

import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import type { ContractTransactionResponse, Signer } from "ethers";

// Minimal ERC-20 ABI — only the functions we need for v0.1
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const HAI_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HAI_TOKEN_ADDRESS || "";
const HAI_TREASURY_WALLET = process.env.NEXT_PUBLIC_HAI_TREASURY_WALLET || "";

export function getHaiTokenAddress(): string {
  return HAI_TOKEN_ADDRESS;
}

export function getTreasuryAddress(): string {
  return HAI_TREASURY_WALLET;
}

/** Returns true when both token address and treasury are configured. */
export function isHaiFundingConfigured(): boolean {
  return HAI_TOKEN_ADDRESS.length > 0 && HAI_TREASURY_WALLET.length > 0;
}

// ---------------------------------------------------------------------------
// Contract helpers
// ---------------------------------------------------------------------------

/**
 * Get an ethers Contract instance for the HAI ERC-20 token.
 * Pass a Signer for write operations (transfer), or a Provider for read-only.
 */
export function getHaiTokenContract(signerOrProvider: Signer | BrowserProvider): Contract {
  if (!HAI_TOKEN_ADDRESS) {
    throw new Error("HAI token address not configured. Set NEXT_PUBLIC_HAI_TOKEN_ADDRESS.");
  }
  return new Contract(HAI_TOKEN_ADDRESS, ERC20_ABI, signerOrProvider);
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export interface HaiBalanceResult {
  /** Raw balance in smallest unit (wei-equivalent) */
  raw: bigint;
  /** Human-readable balance (e.g. "1000000.0") */
  formatted: string;
  /** Token decimals (typically 18) */
  decimals: number;
}

/** Cache decimals per session — won't change for a given token contract. */
let cachedDecimals: number | null = null;

/**
 * Read the HAI token balance for a wallet address.
 * Uses the connected browser provider (MetaMask).
 */
export async function readHaiBalance(
  walletAddress: string,
  provider: BrowserProvider
): Promise<HaiBalanceResult> {
  const contract = getHaiTokenContract(provider);
  const [rawBalance, decimals] = await Promise.all([
    contract.balanceOf(walletAddress) as Promise<bigint>,
    cachedDecimals !== null
      ? Promise.resolve(cachedDecimals)
      : (contract.decimals() as Promise<number>).then((d: number) => {
          cachedDecimals = Number(d);
          return cachedDecimals;
        }),
  ]);
  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, decimals),
    decimals,
  };
}

/**
 * Read HAI token decimals (cached after first call).
 */
export async function readHaiDecimals(provider: BrowserProvider): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;
  const contract = getHaiTokenContract(provider);
  const d = await contract.decimals();
  cachedDecimals = Number(d);
  return cachedDecimals;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface HaiTransferResult {
  /** Transaction hash */
  txHash: string;
  /** Wait for confirmations. Returns the receipt. */
  wait: (confirmations?: number) => Promise<any>;
}

/**
 * Transfer HAI tokens from the connected wallet to the treasury.
 *
 * @param signer - ethers Signer from the connected wallet
 * @param amountHuman - amount in human-readable units (e.g. "100" for 100 HAI)
 * @returns Transaction hash and a wait() function for confirmations
 */
export async function transferHaiToTreasury(
  signer: Signer,
  amountHuman: string
): Promise<HaiTransferResult> {
  if (!HAI_TREASURY_WALLET) {
    throw new Error("Treasury wallet not configured. Set NEXT_PUBLIC_HAI_TREASURY_WALLET.");
  }

  const contract = getHaiTokenContract(signer);

  // Get decimals to convert human amount to raw
  const decimals = cachedDecimals ?? Number(await contract.decimals());
  cachedDecimals = decimals;

  const rawAmount = parseUnits(amountHuman, decimals);

  const tx: ContractTransactionResponse = await contract.transfer(HAI_TREASURY_WALLET, rawAmount);

  return {
    txHash: tx.hash,
    wait: (confirmations = 2) => tx.wait(confirmations),
  };
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

function normalizeChainId(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("0x")) return raw;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed)) {
    return `0x${parsed.toString(16)}`;
  }
  return raw;
}

const SEPOLIA_CHAIN_ID = normalizeChainId(process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_ID || "0xaa36a7") || "0xaa36a7";

/**
 * Ensure the connected wallet is on the Sepolia network.
 * If not, request a chain switch via the wallet provider.
 */
export async function ensureSepoliaNetwork(injectedProvider: any): Promise<void> {
  if (!injectedProvider) throw new Error("No wallet provider found");
  const chainId = normalizeChainId(await injectedProvider.request({ method: "eth_chainId" }));
  if (chainId !== SEPOLIA_CHAIN_ID) {
    try {
      await injectedProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (error: any) {
      const code = Number(error?.code);
      if (code === 4001) {
        throw new Error("Network switch was rejected in MetaMask.");
      }
      if (code === -32002) {
        throw new Error("MetaMask already has a pending request. Open the extension and approve or cancel it.");
      }
      if (code === 4902) {
        // Chain not found in wallet; try adding Sepolia then switch again.
        await injectedProvider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xaa36a7",
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
        await injectedProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
        return;
      }
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Provider helper
// ---------------------------------------------------------------------------

/**
 * Get a BrowserProvider from the injected wallet provider.
 * Used when the caller has an InjectedProvider but needs an ethers BrowserProvider.
 */
export function getBrowserProvider(injectedProvider: any): BrowserProvider {
  return new BrowserProvider(injectedProvider);
}
