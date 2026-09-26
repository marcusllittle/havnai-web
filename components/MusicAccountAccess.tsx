import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useAccount } from "./AccountProvider";
import { useWallet } from "./WalletProvider";
import * as legacy from "../lib/havnai";
import { accountMusicClient, pendingPlaylist } from "../lib/accountMusicClient";

const legacyMusicApi = {
  fetchMusicDiscover: legacy.fetchMusicDiscover, fetchMusicCreator: legacy.fetchMusicCreator,
  fetchMusicLibrary: legacy.fetchMusicLibrary, fetchMyMusicPlaylists: legacy.fetchMyMusicPlaylists,
  fetchMusicPlaylist: legacy.fetchMusicPlaylist, createMusicPlaylist: legacy.createMusicPlaylist,
  updateMusicPlaylist: legacy.updateMusicPlaylist, deleteMusicPlaylist: legacy.deleteMusicPlaylist,
  addMusicPlaylistItem: legacy.addMusicPlaylistItem, removeMusicPlaylistItem: legacy.removeMusicPlaylistItem,
  reorderMusicPlaylistItems: legacy.reorderMusicPlaylistItems,
  setMusicPublicationLike: legacy.setMusicPublicationLike, setMusicPublicationSaved: legacy.setMusicPublicationSaved,
  finishPlaylistCreation: (_id: string) => {},
};

/** Drop private views, unfinished handlers, and dialogs when the listener changes. */
export function withMusicIdentity<P extends object>(Component: ComponentType<P>) {
  return function MusicIdentityPage(props: P) {
    const account = useAccount();
    const wallet = useWallet();
    const identity = account.configured ? `account:${account.account?.id || "guest"}` : `wallet:${wallet.connectedWallet || "guest"}`;
    return <Component key={identity} {...props} />;
  };
}

export function MusicAccountNotice({ message }: { message: string }) {
  return message ? <p className="music-alert" role="alert">{message} {message.startsWith("Sign in") && <Link href="/sign-in">Sign in</Link>}</p> : null;
}

export function useMusicAccess() {
  const account = useAccount();
  const wallet = useWallet();
  const [notice, setNotice] = useState("");
  const lifetime = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  const listenerId = account.configured ? account.account?.id || null : wallet.connectedWallet;
  const api = useMemo(() => {
    if (!account.configured) return legacyMusicApi;
    const unavailable = async (): Promise<never> => { throw new Error("Sign in to use your music library."); };
    const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
      try { return await account.request<T>(path, init); }
      catch (reason) {
        if (!init?.signal?.aborted) setNotice(reason instanceof Error ? reason.message : "Your music changes could not be saved. Please try again.");
        throw reason;
      }
    };
    const client = accountMusicClient(account.account?.id || "guest", account.account ? request : unavailable,
      () => lifetime.current.signal, () => window.sessionStorage);
    return {
      ...client,
      fetchMusicDiscover: async (opts: Parameters<typeof legacy.fetchMusicDiscover>[0]) => {
        const result = await legacy.fetchMusicDiscover({ ...opts, wallet: undefined });
        return account.account ? { ...result, publications: await client.personalize(result.publications) } : result;
      },
      fetchMusicCreator: async (id: string, opts: Parameters<typeof legacy.fetchMusicCreator>[1] = {}) => {
        const result = await legacy.fetchMusicCreator(id, { ...opts, viewerWallet: undefined });
        return account.account ? { ...result, publications: await client.personalize(result.publications) } : result;
      },
      fetchMusicPlaylist: (id: string, _wallet?: string | null) => account.account
        ? client.fetchMusicPlaylist(id) : legacy.fetchMusicPlaylist(id),
    };
  }, [account.configured, account.account?.id, account.request]);
  async function ensureListener() {
    if (listenerId) return listenerId;
    if (account.configured) {
      setNotice(account.loading ? "Your account is loading. Please try again in a moment." : "Sign in to save songs and manage playlists.");
      return null;
    }
    return wallet.connect().catch(() => null);
  }
  function pendingTitle() {
    if (!account.configured || !account.account || typeof window === "undefined") return "";
    try { return pendingPlaylist(window.sessionStorage, account.account.id)?.title || ""; }
    catch { return ""; }
  }
  return { ...api, listenerId, ensureListener, notice, configured: account.configured,
    loadingAccount: account.loading, accountError: account.error, pendingTitle };
}
