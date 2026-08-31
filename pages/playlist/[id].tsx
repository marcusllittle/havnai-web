import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListMusic, Lock, Play, Trash2 } from "lucide-react";
import { AddToPlaylistDialog } from "../../components/AddToPlaylistDialog";
import { MusicPlaylistArtwork } from "../../components/MusicPlaylistArtwork";
import { MusicPublicationCard } from "../../components/MusicPublicationCard";
import { SiteHeader } from "../../components/SiteHeader";
import { useMusicPlayer, type PlayerTrack } from "../../components/MusicPlayer";
import { useWallet } from "../../components/WalletProvider";
import {
  deleteMusicPlaylist,
  fetchMusicPlaylist,
  removeMusicPlaylistItem,
  reorderMusicPlaylistItems,
  setMusicPublicationLike,
  setMusicPublicationSaved,
  updateMusicPlaylist,
  type MusicPlaylist,
  type MusicPublication,
} from "../../lib/havnai";
import { formatMusicDuration } from "../../lib/musicJobPresentation";

function toTrack(publication: MusicPublication): PlayerTrack | null {
  if (!publication.audio_url) return null;
  return {
    id: `publication-${publication.id}`,
    publicationId: publication.id,
    title: publication.title,
    style: publication.style || "HavnAI Music",
    audioUrl: publication.audio_url,
    artworkUrl: publication.cover_art_url || "/music-default-cover.png",
    duration: publication.duration || undefined,
  };
}

export default function PlaylistPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { currentTrack, isPlaying, playTrack, playQueue, toggle } = useMusicPlayer();
  const [playlist, setPlaylist] = useState<MusicPlaylist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<MusicPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const connectedWallet = wallet.connectedWallet;
  const playlistId = typeof router.query.id === "string" ? router.query.id : "";

  useEffect(() => {
    let active = true;
    if (!playlistId) return;
    setLoading(true);
    setError("");
    fetchMusicPlaylist(playlistId, connectedWallet)
      .then((result) => {
        if (!active) return;
        setPlaylist(result);
        setTitle(result.title);
        setDescription(result.description);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Playlist could not load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [connectedWallet, playlistId]);

  const queue = useMemo(() => (playlist?.publications || []).map(toTrack).filter(Boolean) as PlayerTrack[], [playlist]);

  async function ensureWallet(): Promise<string | null> {
    if (connectedWallet) return connectedWallet;
    return wallet.connect().catch(() => null);
  }

  function playPublication(publication: MusicPublication) {
    const track = toTrack(publication);
    if (!track) return;
    if (currentTrack?.publicationId === publication.id && isPlaying) {
      toggle();
      return;
    }
    const index = queue.findIndex((item) => item.publicationId === publication.id);
    playTrack(track, queue.length > 0 ? queue : [track], index >= 0 ? index : 0);
  }

  async function updatePublication(publication: MusicPublication, patch: Partial<MusicPublication>) {
    setPlaylist((current) => current ? {
      ...current,
      publications: current.publications.map((item) => item.id === publication.id ? { ...item, ...patch } : item),
    } : current);
  }

  async function likePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextLiked = !publication.liked_by_me;
    await updatePublication(publication, { liked_by_me: nextLiked, like_count: Math.max(0, publication.like_count + (nextLiked ? 1 : -1)) });
    try {
      const result = await setMusicPublicationLike(publication.id, nextLiked, signer);
      await updatePublication(publication, { liked_by_me: result.liked, like_count: result.like_count });
    } catch {
      await updatePublication(publication, { liked_by_me: publication.liked_by_me, like_count: publication.like_count });
    }
  }

  async function savePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextSaved = !publication.saved_by_me;
    await updatePublication(publication, { saved_by_me: nextSaved });
    try {
      const result = await setMusicPublicationSaved(publication.id, nextSaved, signer);
      await updatePublication(publication, { saved_by_me: result.saved });
    } catch {
      await updatePublication(publication, { saved_by_me: publication.saved_by_me });
    }
  }

  async function saveDetails() {
    if (!playlist) return;
    const signer = await ensureWallet();
    if (!signer) return;
    const updated = await updateMusicPlaylist(playlist.id, { wallet: signer, title, description });
    setPlaylist(updated);
  }

  async function togglePublic() {
    if (!playlist) return;
    const signer = await ensureWallet();
    if (!signer) return;
    const updated = await updateMusicPlaylist(playlist.id, { wallet: signer, is_public: !playlist.is_public });
    setPlaylist(updated);
  }

  async function deletePlaylist() {
    if (!playlist) return;
    const signer = await ensureWallet();
    if (!signer) return;
    await deleteMusicPlaylist(playlist.id, signer);
    await router.push("/music/library");
  }

  async function removeTrack(publication: MusicPublication) {
    if (!playlist) return;
    const signer = await ensureWallet();
    if (!signer) return;
    setPlaylist(await removeMusicPlaylistItem(playlist.id, publication.id, signer));
  }

  async function moveTrack(publication: MusicPublication, delta: -1 | 1) {
    if (!playlist) return;
    const ids = playlist.publications.map((item) => item.id);
    const index = ids.indexOf(publication.id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    const nextIds = [...ids];
    [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
    const signer = await ensureWallet();
    if (!signer) return;
    setPlaylist(await reorderMusicPlaylistItems(playlist.id, nextIds, signer));
  }

  return (
    <>
      <Head>
        <title>{playlist ? `${playlist.title} | HavnAI` : "Playlist | HavnAI"}</title>
      </Head>
      <SiteHeader />
      <main className="music-discover-page music-playlist-page">
        {loading ? (
          <div className="discover-skeleton" />
        ) : error || !playlist ? (
          <section className="music-empty">
            <Lock size={28} />
            <strong>Playlist unavailable</strong>
            <span>{error || "This playlist is private or no longer exists."}</span>
          </section>
        ) : (
          <>
            <section className="music-playlist-hero">
              <MusicPlaylistArtwork title={playlist.title} artworkUrl={playlist.artwork_url} artworkTiles={playlist.artwork_tiles} />
              <div>
                <span><ListMusic size={18} /> {playlist.is_public ? "Public playlist" : "Private playlist"}</span>
                <h1>{playlist.title}</h1>
                <Link href={playlist.owner_url || `/creator/${playlist.owner_wallet}`}>{playlist.owner}</Link>
                {playlist.description && <p>{playlist.description}</p>}
                <div>
                  <span>{playlist.track_count} tracks</span>
                  <span>{formatMusicDuration(playlist.duration || 0)}</span>
                </div>
                <button type="button" disabled={queue.length === 0} onClick={() => playQueue(queue)}>
                  <Play size={17} fill="currentColor" /> Play All
                </button>
              </div>
            </section>

            {playlist.is_owner && (
              <section className="music-playlist-editor">
                <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Playlist title" />
                <input value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Playlist description" placeholder="Description" />
                <button type="button" onClick={saveDetails}>Save</button>
                <button type="button" onClick={togglePublic}>{playlist.is_public ? "Make Private" : "Make Public"}</button>
                <button type="button" onClick={deletePlaylist} aria-label="Delete playlist"><Trash2 size={16} /></button>
              </section>
            )}

            <section className="music-track-list">
              {playlist.publications.length === 0 ? (
                <section className="music-empty"><strong>No tracks</strong><span>Add songs from Discover or your Library.</span></section>
              ) : playlist.publications.map((publication, index) => (
                <div key={publication.id} className="music-track-list-row">
                  {playlist.is_owner && (
                    <div className="music-reorder-controls">
                      <button type="button" disabled={index === 0} onClick={() => moveTrack(publication, -1)} aria-label={`Move ${publication.title} up`}><ArrowUp size={15} /></button>
                      <button type="button" disabled={index === playlist.publications.length - 1} onClick={() => moveTrack(publication, 1)} aria-label={`Move ${publication.title} down`}><ArrowDown size={15} /></button>
                    </div>
                  )}
                  <MusicPublicationCard
                    publication={publication}
                    playing={currentTrack?.publicationId === publication.id && isPlaying}
                    onPlay={playPublication}
                    onLike={likePublication}
                    onSave={savePublication}
                    onAddToPlaylist={setTarget}
                  />
                  {playlist.is_owner && <button className="music-row-remove" type="button" onClick={() => removeTrack(publication)} aria-label={`Remove ${publication.title}`}><Trash2 size={16} /></button>}
                </div>
              ))}
            </section>
          </>
        )}
      </main>
      <AddToPlaylistDialog
        publication={target}
        walletAddress={connectedWallet}
        connectWallet={() => wallet.connect().catch(() => null)}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
