import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Music2, Search, Sparkles, TrendingUp } from "lucide-react";
import { AddToPlaylistDialog } from "../components/AddToPlaylistDialog";
import { MusicPublicationCard } from "../components/MusicPublicationCard";
import { SiteHeader } from "../components/SiteHeader";
import { useMusicPlayer } from "../components/MusicPlayer";
import { useWallet } from "../components/WalletProvider";
import {
  fetchMusicDiscover,
  setMusicPublicationLike,
  setMusicPublicationSaved,
  type MusicPublication,
} from "../lib/havnai";

const GENRES = ["All", "Pop", "Hip hop", "Rock", "R&B", "Electronic", "Cinematic", "Country", "Jazz"];

export default function DiscoverPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { currentTrack, isPlaying, playTrack, toggle } = useMusicPlayer();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [sort, setSort] = useState("newest");
  const [publications, setPublications] = useState<MusicPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playlistTarget, setPlaylistTarget] = useState<MusicPublication | null>(null);
  const connectedWallet = wallet.connectedWallet;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMusicDiscover({
      search: search.trim() || undefined,
      style: genre === "All" ? undefined : genre,
      sort,
      wallet: connectedWallet,
      limit: 48,
    })
      .then((response) => {
        if (active) setPublications(response.publications);
      })
      .catch((reason) => {
        if (active) {
          setPublications([]);
          setError(reason instanceof Error ? reason.message : "Discover could not load.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [connectedWallet, genre, search, sort]);

  const featured = publications[0];
  const newTracks = publications.slice(0, 12);
  const popular = useMemo(
    () => [...publications].sort((left, right) => right.play_count - left.play_count || right.like_count - left.like_count).slice(0, 12),
    [publications]
  );
  const queryTrack = typeof router.query.track === "string" ? router.query.track : "";

  function playPublication(publication: MusicPublication) {
    if (!publication.audio_url) return;
    if (currentTrack?.publicationId === publication.id && isPlaying) {
      toggle();
      return;
    }
    playTrack({
      id: `publication-${publication.id}`,
      publicationId: publication.id,
      title: publication.title,
      style: publication.style || "HavnAI Music",
      audioUrl: publication.audio_url,
      artworkUrl: publication.cover_art_url || "/music-default-cover.png",
      duration: publication.duration || undefined,
    });
  }

  function patchPublication(publicationId: string, patch: Partial<MusicPublication>) {
    setPublications((current) => current.map((item) => item.id === publicationId ? { ...item, ...patch } : item));
  }

  async function likePublication(publication: MusicPublication) {
    let signerWallet = connectedWallet;
    if (!signerWallet) {
      signerWallet = await wallet.connect().catch(() => null);
    }
    if (!signerWallet) return;
    const nextLiked = !publication.liked_by_me;
    setPublications((current) =>
      current.map((item) =>
        item.id === publication.id
          ? { ...item, liked_by_me: nextLiked, like_count: Math.max(0, item.like_count + (nextLiked ? 1 : -1)) }
          : item
      )
    );
    try {
      const result = await setMusicPublicationLike(publication.id, nextLiked, signerWallet);
      setPublications((current) =>
        current.map((item) =>
          item.id === publication.id
            ? { ...item, liked_by_me: result.liked, like_count: result.like_count }
            : item
        )
      );
    } catch {
      setPublications((current) =>
        current.map((item) =>
          item.id === publication.id
            ? { ...item, liked_by_me: publication.liked_by_me, like_count: publication.like_count }
            : item
        )
      );
    }
  }

  async function savePublication(publication: MusicPublication) {
    let signerWallet = connectedWallet;
    if (!signerWallet) {
      signerWallet = await wallet.connect().catch(() => null);
    }
    if (!signerWallet) return;
    const nextSaved = !publication.saved_by_me;
    patchPublication(publication.id, { saved_by_me: nextSaved });
    try {
      const result = await setMusicPublicationSaved(publication.id, nextSaved, signerWallet);
      patchPublication(publication.id, { saved_by_me: result.saved });
    } catch {
      patchPublication(publication.id, { saved_by_me: publication.saved_by_me });
    }
  }

  return (
    <>
      <Head>
        <title>Discover | HavnAI</title>
        <meta name="description" content="Listen to public songs created on HavnAI." />
      </Head>
      <SiteHeader />
      <main className="music-discover-page">
        <section className="discover-hero">
          <div>
            <span><Sparkles size={18} /> HavnAI Discover</span>
            <h1>Public songs from the network</h1>
          </div>
          <form className="discover-search" onSubmit={(event) => event.preventDefault()}>
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search songs, styles, creators" />
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
              <option value="liked">Most liked</option>
            </select>
          </form>
        </section>

        <nav className="discover-genres" aria-label="Browse by genre">
          {GENRES.map((item) => (
            <button key={item} type="button" className={genre === item ? "is-active" : ""} onClick={() => setGenre(item)}>
              {item}
            </button>
          ))}
        </nav>

        {error && <div className="music-alert" role="alert">{error}</div>}

        {loading ? (
          <section className="discover-grid" aria-label="Loading songs">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="discover-skeleton" />)}
          </section>
        ) : publications.length === 0 ? (
          <section className="music-empty discover-empty">
            <Music2 size={28} />
            <strong>No public songs yet</strong>
            <span>Published Music Studio tracks will appear here.</span>
          </section>
        ) : (
          <>
            {featured && (
              <section className="discover-feature">
                <MusicPublicationCard
                  publication={featured}
                  featured
                  playing={currentTrack?.publicationId === featured.id && isPlaying}
                  onPlay={playPublication}
                  onLike={likePublication}
                  onSave={savePublication}
                  onAddToPlaylist={setPlaylistTarget}
                />
              </section>
            )}

            <section className="discover-rail">
              <div className="discover-section-heading"><span><TrendingUp size={17} /> Popular now</span></div>
              <div className="discover-scroll">
                {popular.map((publication) => (
                  <MusicPublicationCard
                    key={publication.id}
                    publication={publication}
                    playing={currentTrack?.publicationId === publication.id && isPlaying}
                    onPlay={playPublication}
                    onLike={likePublication}
                    onSave={savePublication}
                    onAddToPlaylist={setPlaylistTarget}
                  />
                ))}
              </div>
            </section>

            <section className="discover-rail">
              <div className="discover-section-heading"><span><Music2 size={17} /> New releases</span></div>
              <div className="discover-grid">
                {newTracks.map((publication) => (
                  <MusicPublicationCard
                    key={publication.id}
                    publication={publication}
                    featured={publication.id === queryTrack}
                    playing={currentTrack?.publicationId === publication.id && isPlaying}
                    onPlay={playPublication}
                    onLike={likePublication}
                    onSave={savePublication}
                    onAddToPlaylist={setPlaylistTarget}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      <AddToPlaylistDialog
        publication={playlistTarget}
        walletAddress={connectedWallet}
        connectWallet={() => wallet.connect().catch(() => null)}
        onClose={() => setPlaylistTarget(null)}
      />
    </>
  );
}
