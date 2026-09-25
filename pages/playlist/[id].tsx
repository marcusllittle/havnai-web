import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ListMusic, Lock, Play, Trash2 } from "lucide-react";
import { AddToPlaylistDialog } from "../../components/AddToPlaylistDialog";
import { MusicPlaylistArtwork } from "../../components/MusicPlaylistArtwork";
import { MusicPublicationCard } from "../../components/MusicPublicationCard";
import { SiteHeader } from "../../components/SiteHeader";
import { useMusicPlayer, type PlayerTrack } from "../../components/MusicPlayer";
import { useWallet } from "../../components/WalletProvider";
import { useMusicAccess, withMusicIdentity, MusicAccountNotice } from "../../components/MusicAccountAccess";
import {
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

function PlaylistPage() {
  const router = useRouter();
  const wallet = useWallet();
  const access = useMusicAccess();
  const { fetchMusicPlaylist, updateMusicPlaylist, deleteMusicPlaylist, removeMusicPlaylistItem,
    reorderMusicPlaylistItems, setMusicPublicationLike, setMusicPublicationSaved } = access;
  const { currentTrack, isPlaying, playTrack, playQueue, toggle } = useMusicPlayer();
  const [playlist, setPlaylist] = useState<MusicPlaylist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<MusicPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const actionRef = useRef(false);
  const listenerId = access.listenerId;
  const playlistId = typeof router.query.id === "string" ? router.query.id : "";

  useEffect(() => {
    let active = true;
    if (!playlistId) return;
    setLoading(true);
    setError("");
    fetchMusicPlaylist(playlistId, listenerId)
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
  }, [listenerId, playlistId, refreshKey, fetchMusicPlaylist]);

  const queue = useMemo(() => (playlist?.publications || []).map(toTrack).filter(Boolean) as PlayerTrack[], [playlist]);

  async function ensureListener(): Promise<string | null> {
    return access.ensureListener();
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
    const signer = await ensureListener();
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
    const signer = await ensureListener();
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

  async function runAction(action: () => Promise<void>) {
    if (actionRef.current) return;
    actionRef.current = true; setBusy(true); setActionError("");
    try { await action(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Your playlist could not be updated."); }
    finally { actionRef.current = false; setBusy(false); }
  }

  async function saveDetails() {
    if (!playlist) return;
    const signer = await ensureListener();
    if (!signer) return;
    const updated = await updateMusicPlaylist(playlist.id, { wallet: signer, title, description });
    setPlaylist(updated);
  }

  async function togglePublic() {
    if (!playlist) return;
    const signer = await ensureListener();
    if (!signer) return;
    const updated = await updateMusicPlaylist(playlist.id, { wallet: signer, is_public: !playlist.is_public });
    setPlaylist(updated);
  }

  async function deletePlaylist() {
    if (!playlist) return;
    const signer = await ensureListener();
    if (!signer) return;
    await deleteMusicPlaylist(playlist.id, signer);
    await router.push("/music/library");
  }

  async function removeTrack(publication: MusicPublication) {
    if (!playlist) return;
    const signer = await ensureListener();
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
    const signer = await ensureListener();
    if (!signer) return;
    setPlaylist(await reorderMusicPlaylistItems(playlist.id, nextIds, signer));
  }

  return (
    <>
      <Head>
        <title>{playlist ? `${playlist.title} | HavnAI` : "Playlist | HavnAI"}</title>
      </Head>
      <SiteHeader />
      <MusicAccountNotice message={access.notice} />
      <main className="listening-page music-shelf-page music-playlist-page">
        <nav className="shelf-breadcrumbs" aria-label="Music navigation"><Link href="/discover">Discover</Link><span>/</span><Link href="/music/library">Your library</Link></nav>
        {loading ? (
          <div className="discover-skeleton" role="status" aria-label="Loading music" />
        ) : error || !playlist ? (
          <section className="music-empty">
            <Lock size={28} />
            <h1>Playlist unavailable</h1>
            <span>{error || "This playlist is private or no longer exists."}</span>
            <button className="listening-create" onClick={() => setRefreshKey(value => value + 1)}>Try again</button>
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
                  <span>{playlist.track_count} {playlist.track_count === 1 ? "track" : "tracks"}</span>
                  <span>{formatMusicDuration(playlist.duration || 0)}</span>
                </div>
                <button type="button" disabled={queue.length === 0} onClick={() => playQueue(queue)}>
                  <Play size={17} fill="currentColor" /> Play All
                </button>
              </div>
            </section>

            {playlist.is_owner && (
              <details className="shelf-editor"><summary>Edit playlist</summary><section className="music-playlist-editor">
                <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} aria-label="Playlist title" />
                <input value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} aria-label="Playlist description" placeholder="Description" />
                <button type="button" disabled={busy || !title.trim()} onClick={() => void runAction(saveDetails)}>Save</button>
                <button type="button" disabled={busy} onClick={() => void runAction(togglePublic)}>{playlist.is_public ? "Make Private" : "Make Public"}</button>
                <button type="button" disabled={busy} onClick={() => void runAction(deletePlaylist)} aria-label="Delete playlist"><Trash2 size={16} /></button>
              </section></details>
            )}
            {actionError && <p className="music-alert" role="alert">{actionError}</p>}
            <section className="music-track-list" aria-label="Playlist tracks">
              {playlist.publications.length === 0 ? (
                <section className="music-empty"><strong>No tracks</strong><span>Add songs from Discover or your Library.</span></section>
              ) : playlist.publications.map((publication, index) => (
                <div key={publication.id} className={`music-track-list-row ${playlist.is_owner ? "is-owned" : ""}`}>
                  {playlist.is_owner && (
                    <div className="music-reorder-controls">
                      <button type="button" disabled={busy || index === 0} onClick={() => void runAction(() => moveTrack(publication, -1))} aria-label={`Move ${publication.title} up`}><ArrowUp size={15} /></button>
                      <button type="button" disabled={busy || index === playlist.publications.length - 1} onClick={() => void runAction(() => moveTrack(publication, 1))} aria-label={`Move ${publication.title} down`}><ArrowDown size={15} /></button>
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
                  {playlist.is_owner && <button className="music-row-remove" type="button" disabled={busy} onClick={() => void runAction(() => removeTrack(publication))} aria-label={`Remove ${publication.title}`}><Trash2 size={16} /></button>}
                </div>
              ))}
            </section>
          </>
        )}
      </main>
      <AddToPlaylistDialog
        publication={target}
        walletAddress={wallet.connectedWallet}
        connectWallet={() => wallet.connect().catch(() => null)}
        onClose={() => setTarget(null)}
      />
    </>
  );
}

export default withMusicIdentity(PlaylistPage);
