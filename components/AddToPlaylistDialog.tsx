import { useEffect, useState } from "react";
import { ListMusic, Plus, X } from "lucide-react";
import {
  addMusicPlaylistItem,
  createMusicPlaylist,
  fetchMyMusicPlaylists,
  type MusicPlaylist,
  type MusicPublication,
} from "../lib/havnai";

export function AddToPlaylistDialog({
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
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    setPlaylists([]);
    if (!publication || !walletAddress) return;
    setBusy(true);
    fetchMyMusicPlaylists(walletAddress)
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
  }, [publication, walletAddress]);

  if (!publication) return null;

  async function resolveWallet(): Promise<string | null> {
    if (walletAddress) return walletAddress;
    return connectWallet();
  }

  async function addToPlaylist(playlistId: string) {
    const signer = await resolveWallet();
    if (!signer) return;
    setBusy(true);
    setError("");
    try {
      const playlist = await addMusicPlaylistItem(playlistId, publication.id, signer);
      onAdded?.(playlist);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Song could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    const signer = await resolveWallet();
    if (!signer || !title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const playlist = await createMusicPlaylist({ wallet: signer, title: title.trim() });
      const updated = await addMusicPlaylistItem(playlist.id, publication.id, signer);
      onAdded?.(updated);
      setTitle("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Playlist could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="music-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="music-dialog" role="dialog" aria-modal="true" aria-label="Add to playlist" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span><ListMusic size={17} /> Add to playlist</span>
          <button type="button" onClick={onClose} aria-label="Close" title="Close"><X size={18} /></button>
        </header>
        <div className="music-dialog-track">
          <strong>{publication.title}</strong>
          <span>{publication.creator}</span>
        </div>
        {error && <p className="music-dialog-error" role="alert">{error}</p>}
        <div className="music-playlist-picker">
          {busy && playlists.length === 0 ? (
            <span>Loading playlists</span>
          ) : playlists.length === 0 ? (
            <span>No playlists yet</span>
          ) : (
            playlists.map((playlist) => (
              <button key={playlist.id} type="button" disabled={busy} onClick={() => addToPlaylist(playlist.id)}>
                <strong>{playlist.title}</strong>
                <span>{playlist.track_count} tracks</span>
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
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New playlist name" />
          <button type="submit" disabled={busy || !title.trim()} aria-label="Create playlist">
            <Plus size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
