import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListMusic, Music2, Plus, Search, Trash2 } from "lucide-react";
import { AddToPlaylistDialog } from "../../components/AddToPlaylistDialog";
import { MusicPlaylistArtwork } from "../../components/MusicPlaylistArtwork";
import { MusicPublicationCard } from "../../components/MusicPublicationCard";
import { SiteHeader } from "../../components/SiteHeader";
import { useMusicPlayer, type PlayerTrack } from "../../components/MusicPlayer";
import { useWallet } from "../../components/WalletProvider";
import {
  createMusicPlaylist,
  deleteMusicPlaylist,
  fetchMusicLibrary,
  setMusicPublicationLike,
  setMusicPublicationSaved,
  updateMusicPlaylist,
  type MusicPlaylist,
  type MusicPublication,
} from "../../lib/havnai";
import { matchesMusicLibrarySearch } from "../../lib/musicLibraryFilters";

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

export default function MusicLibraryPage() {
  const wallet = useWallet();
  const { currentTrack, isPlaying, playTrack, playQueue, toggle } = useMusicPlayer();
  const [search, setSearch] = useState("");
  const [savedSongs, setSavedSongs] = useState<MusicPublication[]>([]);
  const [recentLiked, setRecentLiked] = useState<MusicPublication[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [target, setTarget] = useState<MusicPublication | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const createPlaylistInFlightRef = useRef(false);
  const connectedWallet = wallet.connectedWallet;

  useEffect(() => {
    let active = true;
    setError("");
    setSavedSongs([]);
    setRecentLiked([]);
    setPlaylists([]);
    if (!connectedWallet) {
      setSavedSongs([]);
      setRecentLiked([]);
      setPlaylists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    fetchMusicLibrary({ wallet: connectedWallet, limit: 80 })
      .then((library) => {
        if (!active) return;
        setSavedSongs(library.publications);
        setRecentLiked(library.recent_liked);
        setPlaylists(library.playlists);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Library could not load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [connectedWallet, refreshKey]);

  const filteredSavedSongs = useMemo(() => {
    return savedSongs.filter((publication) => matchesMusicLibrarySearch(publication, search));
  }, [savedSongs, search]);
  const playableSaved = useMemo(() => filteredSavedSongs.map(toTrack).filter(Boolean) as PlayerTrack[], [filteredSavedSongs]);

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
    const queueIndex = playableSaved.findIndex((item) => item.publicationId === publication.id);
    playTrack(track, queueIndex >= 0 ? playableSaved : [track], queueIndex >= 0 ? queueIndex : 0);
  }

  function updateLikedPublication(publication: MusicPublication, liked: boolean, likeCount: number) {
    setSavedSongs((current) =>
      current.map((item) => item.id === publication.id ? { ...item, liked_by_me: liked, like_count: likeCount } : item)
    );
    setRecentLiked((current) => {
      if (!liked) return current.filter((item) => item.id !== publication.id);
      const nextPublication = { ...publication, liked_by_me: true, like_count: likeCount };
      return current.some((item) => item.id === publication.id)
        ? current.map((item) => item.id === publication.id ? { ...item, liked_by_me: true, like_count: likeCount } : item)
        : [nextPublication, ...current];
    });
  }

  function updateSavedPublication(publication: MusicPublication, saved: boolean) {
    setSavedSongs((current) => {
      if (!saved) return current.filter((item) => item.id !== publication.id);
      const nextPublication = { ...publication, saved_by_me: true };
      return current.some((item) => item.id === publication.id)
        ? current.map((item) => item.id === publication.id ? { ...item, saved_by_me: true } : item)
        : [nextPublication, ...current];
    });
    setRecentLiked((current) => current.map((item) => item.id === publication.id ? { ...item, saved_by_me: saved } : item));
  }

  async function savePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextSaved = !publication.saved_by_me;
    updateSavedPublication(publication, nextSaved);
    try {
      const result = await setMusicPublicationSaved(publication.id, nextSaved, signer);
      updateSavedPublication(publication, result.saved);
    } catch {
      updateSavedPublication(publication, publication.saved_by_me);
    }
  }

  async function likePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextLiked = !publication.liked_by_me;
    updateLikedPublication(publication, nextLiked, Math.max(0, publication.like_count + (nextLiked ? 1 : -1)));
    try {
      const result = await setMusicPublicationLike(publication.id, nextLiked, signer);
      updateLikedPublication(publication, result.liked, result.like_count);
    } catch {
      updateLikedPublication(publication, publication.liked_by_me, publication.like_count);
    }
  }

  async function createPlaylist() {
    if (createPlaylistInFlightRef.current) return;
    const title = newPlaylistTitle.trim();
    if (!title) return;
    createPlaylistInFlightRef.current = true;
    setBusy(true);
    setActionError("");
    try {
      const signer = await ensureWallet();
      if (!signer) return;
      const playlist = await createMusicPlaylist({ wallet: signer, title });
      setPlaylists((current) => [playlist, ...current]);
      setNewPlaylistTitle("");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Playlist could not be created.");
    } finally {
      setBusy(false);
      createPlaylistInFlightRef.current = false;
    }
  }

  async function togglePlaylistVisibility(playlist: MusicPlaylist) {
    const signer = await ensureWallet();
    if (!signer) return;
    const updated = await updateMusicPlaylist(playlist.id, { wallet: signer, is_public: !playlist.is_public });
    setPlaylists((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function removePlaylist(playlist: MusicPlaylist) {
    const signer = await ensureWallet();
    if (!signer) return;
    await deleteMusicPlaylist(playlist.id, signer);
    setPlaylists((current) => current.filter((item) => item.id !== playlist.id));
  }

  async function managePlaylist(action: () => Promise<void>) {
    if (createPlaylistInFlightRef.current) return;
    createPlaylistInFlightRef.current = true;
    setBusy(true); setActionError("");
    try { await action(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "The playlist change could not be saved."); }
    finally { setBusy(false); createPlaylistInFlightRef.current = false; }
  }

  return (
    <>
      <Head>
        <title>Music Library | HavnAI</title>
        <meta name="description" content="Saved HavnAI songs and playlists." />
      </Head>
      <SiteHeader />
      <main className="listening-page music-shelf-page music-library-page">
        <section className="listening-heading">
          <div>
            <span className="listening-eyebrow"><Music2 size={15} aria-hidden="true" /> Your listening space</span>
            <h1>Keep the songs that stay.</h1><p>Your saved tracks, favorite finds, and playlists. Browsing your library is free.</p>
          </div>
          <Link className="listening-create" href="/discover">Discover music</Link>
        </section>

        {!connectedWallet && (
          <section className="listening-empty">
            <span className="listening-state-icon"><Music2 size={30} aria-hidden="true" /></span>
            <h2>Your music, in one place.</h2>
            <p>Connect your wallet to find your saved songs and build your own playlists. The signature verifies ownership; it does not spend credits.</p>
            <button className="listening-create" disabled={wallet.connecting} onClick={() => { setActionError(""); void wallet.connect().catch(reason => setActionError(reason instanceof Error ? reason.message : "Wallet connection failed. Please try again.")); }}>{wallet.connecting ? "Connecting..." : "Connect wallet"}</button>
          </section>
        )}
        {error && <div className="listening-empty" role="alert"><h2>Your library is out of reach.</h2><p>{error}</p><button className="listening-create" onClick={() => setRefreshKey(value => value + 1)}>Try again</button></div>}
        {actionError && <p className="music-alert" role="alert">{actionError}</p>}

        {connectedWallet && !error && (
          <>
          <form className="listening-search shelf-search" onSubmit={(event) => event.preventDefault()}>
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label="Search saved songs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your saved songs" />
          </form>
            <section className="music-library-toolbar">
              <button type="button" disabled={playableSaved.length === 0} onClick={() => playQueue(playableSaved)}>
                <ListMusic size={17} /> Play All
              </button>
              <form onSubmit={(event) => { event.preventDefault(); void createPlaylist(); }}>
                <input value={newPlaylistTitle} onChange={(event) => setNewPlaylistTitle(event.target.value)} aria-label="New playlist name" placeholder="Name a new playlist" />
                <button type="submit" disabled={busy || !newPlaylistTitle.trim()} aria-label="Create playlist"><Plus size={18} aria-hidden="true" /><span>Create playlist</span></button>
              </form>
            </section>

            <section className="discover-rail">
              <div className="listening-section-heading"><h2>Saved songs</h2><span>{loading ? "Loading..." : `${filteredSavedSongs.length} ${filteredSavedSongs.length === 1 ? "track" : "tracks"}`}</span></div>
              {loading ? (
                <div className="discover-grid">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="discover-skeleton" />)}</div>
              ) : filteredSavedSongs.length === 0 ? (
                <section className="music-empty">
                  <strong>{savedSongs.length === 0 ? "No saved songs" : "No matching songs"}</strong>
                  <span>{savedSongs.length === 0 ? "Save tracks from Discover or creator pages." : "Try another title, creator, or style."}</span>
                </section>
              ) : (
                <div className="discover-grid">
                  {filteredSavedSongs.map((publication) => (
                    <MusicPublicationCard
                      key={publication.id}
                      publication={publication}
                      playing={currentTrack?.publicationId === publication.id && isPlaying}
                      onPlay={playPublication}
                      onLike={likePublication}
                      onSave={savePublication}
                      onAddToPlaylist={setTarget}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="discover-rail">
              <div className="listening-section-heading"><h2>Your playlists</h2></div>
              {!loading && playlists.length === 0 && <p className="shelf-note">Give your next playlist a name above, then add songs as you explore.</p>}
              <div className="music-playlist-grid">
                {playlists.map((playlist) => (
                  <article key={playlist.id} className="music-playlist-card">
                    <Link href={`/playlist/${playlist.id}`}>
                      <MusicPlaylistArtwork title={playlist.title} artworkUrl={playlist.artwork_url} artworkTiles={playlist.artwork_tiles} />
                      <span>
                        <strong>{playlist.title}</strong>
                        <small>{playlist.track_count} {playlist.track_count === 1 ? "track" : "tracks"} · {playlist.is_public ? "Public" : "Private"}</small>
                      </span>
                    </Link>
                    <div>
                      <button type="button" disabled={busy} onClick={() => void managePlaylist(() => togglePlaylistVisibility(playlist))}>{playlist.is_public ? "Make private" : "Make public"}</button>
                      <button type="button" disabled={busy} onClick={() => void managePlaylist(() => removePlaylist(playlist))} aria-label={`Delete ${playlist.title}`}><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {recentLiked.length > 0 && (
              <section className="discover-rail">
                <div className="listening-section-heading"><h2>Recently liked</h2></div>
                <div className="discover-grid">
                  {recentLiked.map((publication) => (
                    <MusicPublicationCard
                      key={publication.id}
                      publication={publication}
                      playing={currentTrack?.publicationId === publication.id && isPlaying}
                      onPlay={playPublication}
                      onLike={likePublication}
                      onSave={savePublication}
                      onAddToPlaylist={setTarget}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <AddToPlaylistDialog
        publication={target}
        walletAddress={connectedWallet}
        connectWallet={() => wallet.connect().catch(() => null)}
        onClose={() => setTarget(null)}
        onAdded={(playlist) => setPlaylists((current) => current.some((item) => item.id === playlist.id) ? current.map((item) => item.id === playlist.id ? playlist : item) : [playlist, ...current])}
      />
    </>
  );
}
