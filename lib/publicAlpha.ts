import type { WalletSnapshot, WalletSource } from "./wallet";

export const PUBLIC_ALPHA_LABEL = "Public Alpha";
export const SITE_SESSION_MESSAGE =
  "You are browsing with a HavnAI site session. Connect a wallet when you need signed funding, conversion, or marketplace actions.";

export type WalletCopyContext =
  | "generator"
  | "pricing"
  | "library"
  | "marketplace"
  | "wallet";

type WalletCopySnapshot = Pick<
  WalletSnapshot,
  "source" | "activeWallet" | "connectedWallet" | "error" | "message"
>;

export function getWalletSourceLabel(source: WalletSource): string {
  if (source === "connected") return "Wallet connected";
  if (source === "env") return "Site session";
  return "Guest session";
}

export function getWalletIdentityLabel(snapshot: Pick<WalletSnapshot, "source" | "activeWallet">): string {
  if (snapshot.activeWallet) return snapshot.activeWallet;
  return snapshot.source === "env" ? "HavnAI site session" : "Guest session";
}

export function getWalletStatusCopy(snapshot: WalletCopySnapshot, context: WalletCopyContext): string {
  if (snapshot.error?.message) return snapshot.error.message;

  switch (context) {
    case "generator":
      if (snapshot.source === "connected") {
        return "Generations and wallet-linked actions will use your connected wallet.";
      }
      if (snapshot.source === "env") {
        return "You can generate with the HavnAI site session. Connect a wallet for signed marketplace, conversion, and Sepolia funding actions.";
      }
      return "You can explore the generator in guest mode. Connect a wallet or use an active site session before submitting jobs.";
    case "pricing":
      if (snapshot.source === "connected") {
        return "Funding, balance history, and signed conversions use your connected wallet.";
      }
      if (snapshot.source === "env") {
        return "You are viewing Public Alpha balances through the HavnAI site session. Connect a wallet to fund with HAI, approve conversions, or use wallet checkout when it is available.";
      }
      return "You can review pricing in guest mode. Connect a wallet when you are ready to fund credits or use wallet checkout where it is available.";
    case "library":
      if (snapshot.source === "connected") {
        return "Saved outputs stay in this browser. Publishing a marketplace listing requires the connected wallet that owns the job.";
      }
      if (snapshot.source === "env") {
        return "This browser can show outputs tied to the HavnAI site session, but publishing still requires the matching connected wallet.";
      }
      return "Library storage stays local to this browser. Connect a wallet when you are ready to publish a listing.";
    case "marketplace":
      if (snapshot.source === "connected") {
        return "Purchases, listings, and delisting actions use your connected wallet for signatures.";
      }
      if (snapshot.source === "env") {
        return "The HavnAI site session can browse balances and history, but purchases and new listings still require a connected wallet.";
      }
      return "Browse the marketplace freely. Connect a wallet to buy, list, or manage wallet-linked activity.";
    case "wallet":
      if (snapshot.source === "connected") {
        return "This dashboard is showing your connected wallet, credit balances, and Sepolia activity.";
      }
      if (snapshot.source === "env") {
        return "This dashboard is showing the HavnAI site session. Connect a wallet for Sepolia actions and full wallet control.";
      }
      return "Connect a wallet to load balances, Sepolia activity, and signed wallet actions.";
    default:
      return snapshot.message || SITE_SESSION_MESSAGE;
  }
}

export function getCardCheckoutCopy(stripeEnabled: boolean): string {
  return stripeEnabled
    ? "Card checkout is live on this deployment."
    : "Card checkout is not live on this Public Alpha deployment yet.";
}
