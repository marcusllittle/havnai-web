import type { WalletSnapshot, WalletSource } from "./wallet";

export const PUBLIC_ALPHA_LABEL = "Public Alpha";
export const SITE_SESSION_MESSAGE =
  "Using the HavnAI site session for browsing and Public Alpha actions until you connect a wallet.";

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
  return snapshot.source === "env" ? "HavnAI site session" : "Guest browsing";
}

export function getWalletStatusCopy(snapshot: WalletCopySnapshot, context: WalletCopyContext): string {
  if (snapshot.error?.message) return snapshot.error.message;

  switch (context) {
    case "generator":
      if (snapshot.source === "connected") {
        return "Submissions and signed actions use your connected wallet.";
      }
      if (snapshot.source === "env") {
        return "You are using the HavnAI site session. Connect your wallet for signed marketplace and payment actions.";
      }
      return "Browse and prepare prompts in guest mode. Connect your wallet before submitting wallet-linked jobs.";
    case "pricing":
      if (snapshot.source === "connected") {
        return "Funding, balance history, and signed conversions use your connected wallet.";
      }
      if (snapshot.source === "env") {
        return "You are viewing Public Alpha balances through the HavnAI site session. Connect your wallet to fund with HAI, sign conversions, or use wallet-based checkout when it is available.";
      }
      return "Browse pricing in guest mode. Connect your wallet to fund credits or use wallet-based checkout when it is available.";
    case "library":
      if (snapshot.source === "connected") {
        return "Library browsing works for every saved output. Publishing a marketplace listing requires the connected wallet that owns the job.";
      }
      if (snapshot.source === "env") {
        return "This library can show outputs tied to your site session, but publishing still requires the matching connected wallet.";
      }
      return "Library storage stays local to this browser. Connect your wallet when you are ready to publish a listing.";
    case "marketplace":
      if (snapshot.source === "connected") {
        return "Purchases and new listings use your connected wallet for signatures.";
      }
      if (snapshot.source === "env") {
        return "The HavnAI site session can browse balances and history, but purchases and new listings still require a connected wallet signature.";
      }
      return "Browse the marketplace in guest mode. Connect your wallet to buy, list, or manage wallet-linked activity.";
    case "wallet":
      if (snapshot.source === "connected") {
        return "This dashboard is showing your connected wallet and its Public Alpha balances.";
      }
      if (snapshot.source === "env") {
        return "This dashboard is showing the HavnAI site session. Connect your wallet for signed Sepolia actions and full wallet control.";
      }
      return "Connect your wallet to load balances, Sepolia activity, and signed wallet actions.";
    default:
      return snapshot.message || SITE_SESSION_MESSAGE;
  }
}

export function getCardCheckoutCopy(stripeEnabled: boolean): string {
  return stripeEnabled
    ? "Card checkout is available on this deployment."
    : "Card checkout is not live on this Public Alpha deployment yet.";
}
