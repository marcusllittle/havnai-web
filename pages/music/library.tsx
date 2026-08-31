import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const connectedWallet = wallet.connectedWallet;

  useEffect(() => {
    let active = true;
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
  }, [connectedWallet]);

  const filteredSavedSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return savedSongs;
    return savedSongs.filter((publication) => {
      const haystack = [
        publication.title,
        publication.creator,
        publication.creator_wallet,
        publication.style,
        ...(publication.tags || []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
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

  async function savePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextSaved = !publication.saved_by_me;
    setSavedSongs((current) => current.map((item) => item.id === publication.id ? { ...item, saved_by_me: nextSaved } : item));
    try {
      const result = await setMusicPublicationSaved(publication.id, nextSaved, signer);
      if (!result.saved) setSavedSongs((current) => current.filter((item) => item.id !== publication.id));
    } catch {
      setSavedSongs((current) => current.map((item) => item.id === publication.id ? { ...item, saved_by_me: publication.saved_by_me } : item));
    }
  }

  async function likePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextLiked = !publication.liked_by_me;
    setSavedSongs((current) =>
      current.map((item) => item.id === publication.id ? { ...item, liked_by_me: nextLiked, like_count: Math.max(0, item.like_count + (nextLiked ? 1 : -1)) } : item)
    );
    try {
      const result = await setMusicPublicationLike(publication.id, nextLiked, signer);
      setSavedSongs((current) => current.map((item) => item.id === publication.id ? { ...item, liked_by_me: result.liked, like_count: result.like_count } : item));
    } catch {
      setSavedSongs((current) => current.map((item) => item.id === publication.id ? publication : item));
    }
  }

  async function createPlaylist() {
    const signer = await ensureWallet();
    if (!signer || !newPlaylistTitle.trim()) return;
    const playlist = await createMusicPlaylist({ wallet: signer, title: newPlaylistTitle.trim() });
    setPlaylists((current) => [playlist, ...current]);
    setNewPlaylistTitle("");
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

  return (
    <>
      <Head>
        <title>Music Library | HavnAI</title>
        <meta name="description" content="Saved HavnAI songs and playlists." />
      </Head>
      <SiteHeader />
      <main className="music-discover-page music-library-page">
        <section className="music-page-heading">
          <div>
            <span><Music2 size={18} /> Music Library</span>
            <h1>Saved songs and playlists</h1>
          </div>
          <form className="discover-search" onSubmit={(event) => event.preventDefault()}>
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your saved songs" />
          </form>
        </section>

        {!connectedWallet && (
          <section className="music-empty">
            <Music2 size={28} />
            <strong>Connect a wallet</strong>
            <span>Your saved songs and playlists are tied to your wallet.</span>
          </section>
        )}
        {error && <div className="music-alert" role="alert">{error}</div>}

        {connectedWallet && (
          <>
            <section className="music-library-toolbar">
              <button type="button" disabled={playableSaved.length === 0} onClick={() => playQueue(playableSaved)}>
                <ListMusic size={17} /> Play All
              </button>
              <form onSubmit={(event) => { event.preventDefault(); void createPlaylist(); }}>
                <input value={newPlaylistTitle} onChange={(event) => setNewPlaylistTitle(event.target.value)} placeholder="New playlist" />
                <button type="submit" disabled={!newPlaylistTitle.trim()} aria-label="Create playlist"><Plus size={18} /></button>
              </form>
            </section>

            <section className="discover-rail">
              <div className="discover-section-heading"><span><Music2 size={17} /> Saved Songs</span></div>
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
              <div className="discover-section-heading"><span><ListMusic size={17} /> Playlists</span></div>
              <div className="music-playlist-grid">
                {playlists.map((playlist) => (
                  <article key={playlist.id} className="music-playlist-card">
                    <Link href={`/playlist/${playlist.id}`}>
                      <MusicPlaylistArtwork title={playlist.title} artworkUrl={playlist.artwork_url} artworkTiles={playlist.artwork_tiles} />
                      <span>
                        <strong>{playlist.title}</strong>
                        <small>{playlist.track_count} tracks · {playlist.is_public ? "Public" : "Private"}</small>
                      </span>
                    </Link>
                    <div>
                      <button type="button" onClick={() => togglePlaylistVisibility(playlist)}>{playlist.is_public ? "Private" : "Public"}</button>
                      <button type="button" onClick={() => removePlaylist(playlist)} aria-label={`Delete ${playlist.title}`}><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {recentLiked.length > 0 && (
              <section className="discover-rail">
                <div className="discover-section-heading"><span>Recently Liked</span></div>
                <div className="discover-scroll">
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
