import { useEffect, useRef, useState } from "react";
import { ListMusic, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMusicAccess, withMusicIdentity, MusicAccountNotice } from "./MusicAccountAccess";
import {
  type MusicPlaylist,
  type MusicPublication,
} from "../lib/havnai";

function PlaylistDialog({
  publication,
  walletAddress,
  connectWallet,
  onClose,
  onAdded,
}: {
  publication: MusicPublication | null;
  walletAddress?: string | null;
  connectWallet: () => Promise<string | null>;
  onClose: () => void;
  onAdded?: (playlist: MusicPlaylist) => void;
}) {
  const access = useMusicAccess();
  const { fetchMyMusicPlaylists, createMusicPlaylist, addMusicPlaylistItem } = access;
  const listenerId = access.configured ? access.listenerId : walletAddress;
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [title, setTitle] = useState(access.pendingTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actionInFlightRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!publication) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') || []);
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handleKey); if (previous?.isConnected) previous.focus(); };
  }, [publication?.id]);

  useEffect(() => {
    let active = true;
    setError("");
    setPlaylists([]);
    if (!publication || !listenerId) { setBusy(false); return; }
    setBusy(true);
    fetchMyMusicPlaylists(listenerId)
      .then((items) => {
        if (active) setPlaylists(items);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Playlists could not load.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [publication, listenerId, refreshKey, fetchMyMusicPlaylists]);

  if (!publication) return null;

  async function resolveWallet(): Promise<string | null> {
    if (access.configured) return access.ensureListener();
    if (walletAddress) return walletAddress;
    return connectWallet();
  }

  async function addToPlaylist(playlistId: string) {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setBusy(true);
    setError("");
    try {
      const signer = await resolveWallet();
      if (!signer) return;
      const playlist = await addMusicPlaylistItem(playlistId, publication.id, signer);
      onAdded?.(playlist);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Song could not be added.");
    } finally {
      actionInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function createAndAdd() {
    if (actionInFlightRef.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) return;
    actionInFlightRef.current = true;
    setBusy(true);
    setError("");
    try {
      const signer = await resolveWallet();
      if (!signer) return;
      const playlist = await createMusicPlaylist({ wallet: signer, title: nextTitle });
      const updated = await addMusicPlaylistItem(playlist.id, publication.id, signer);
      access.finishPlaylistCreation(playlist.id);
      onAdded?.(updated);
      setTitle("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Playlist could not be created.");
    } finally {
      actionInFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="music-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="music-dialog" role="dialog" aria-modal="true" aria-label="Add to playlist" onMouseDown={(event) => event.stopPropagation()}>
        <div className="music-dialog-heading">
          <span><ListMusic size={17} /> Add to playlist</span>
          <button type="button" onClick={onClose} aria-label="Close" title="Close"><X size={18} /></button>
        </div>
        <div className="music-dialog-track">
          <strong>{publication.title}</strong>
          <span>{publication.creator}</span>
        </div>
        {error && <p className="music-dialog-error" role="alert">{error}</p>}
        <MusicAccountNotice message={access.notice} />
        {error && listenerId && <button type="button" disabled={busy} onClick={() => setRefreshKey(value => value + 1)}>Reload playlists</button>}
        {!listenerId && (access.configured ? <Link href="/sign-in">Sign in to manage playlists</Link> : <button type="button" onClick={() => void connectWallet().catch(() => setError("Wallet connection failed. Please try again."))}>Connect wallet</button>)}
        <div className="music-playlist-picker">
          {busy && playlists.length === 0 ? (
            <span>Loading playlists</span>
          ) : playlists.length === 0 ? (
            <span>{error ? "Your playlists are unavailable." : !listenerId ? "Sign in to see your playlists." : "No playlists yet. Start one below."}</span>
          ) : (
            playlists.map((playlist) => (
              <button key={playlist.id} type="button" disabled={busy} onClick={() => addToPlaylist(playlist.id)}>
                <strong>{playlist.title}</strong>
                <span>{playlist.track_count} {playlist.track_count === 1 ? "track" : "tracks"}</span>
              </button>
            ))
          )}
        </div>
        <form
          className="music-dialog-create"
          onSubmit={(event) => {
            event.preventDefault();
            void createAndAdd();
          }}
        >
          <input aria-label="New playlist name" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New playlist name" />
          <button type="submit" disabled={busy || !title.trim() || (access.configured && !listenerId)} aria-label="Create playlist">
            <Plus size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}

export const AddToPlaylistDialog = withMusicIdentity(PlaylistDialog);
