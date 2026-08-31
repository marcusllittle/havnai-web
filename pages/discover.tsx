import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Heart, Music2, Pause, Play, Search, Sparkles, TrendingUp } from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { useMusicPlayer } from "../components/MusicPlayer";
import { useWallet } from "../components/WalletProvider";
import {
  fetchMusicDiscover,
  setMusicPublicationLike,
  type MusicPublication,
} from "../lib/havnai";
import { formatMusicDuration } from "../lib/musicJobPresentation";

const GENRES = ["All", "Pop", "Hip hop", "Rock", "R&B", "Electronic", "Cinematic", "Country", "Jazz"];

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value || 0);
}

function TrackCard({
  publication,
  featured = false,
  playing,
  onPlay,
  onLike,
}: {
  publication: MusicPublication;
  featured?: boolean;
  playing: boolean;
  onPlay: (publication: MusicPublication) => void;
  onLike: (publication: MusicPublication) => void;
}) {
  return (
    <article className={`discover-track ${featured ? "is-featured" : ""}`}>
      <button
        type="button"
        className="discover-artwork"
        onClick={() => onPlay(publication)}
        aria-label={playing ? `Pause ${publication.title}` : `Play ${publication.title}`}
      >
        <Image src={publication.cover_art_url || "/music-default-cover.png"} alt="" fill sizes={featured ? "320px" : "180px"} unoptimized />
        <span>{playing ? <Pause size={featured ? 28 : 22} fill="currentColor" /> : <Play size={featured ? 28 : 22} fill="currentColor" />}</span>
      </button>
      <div className="discover-track-copy">
        <strong>{publication.title}</strong>
        <span>{publication.style || "HavnAI original"}</span>
      </div>
      <div className="discover-track-meta">
        <span>{publication.creator}</span>
        <span>{formatMusicDuration(publication.duration || 0)}</span>
      </div>
      <div className="discover-track-actions">
        <span>{formatCount(publication.play_count)} plays</span>
        <button
          type="button"
          className={publication.liked_by_me ? "is-liked" : ""}
          onClick={() => onLike(publication)}
          aria-label={publication.liked_by_me ? `Unlike ${publication.title}` : `Like ${publication.title}`}
          title={publication.liked_by_me ? "Unlike" : "Like"}
        >
          <Heart size={17} fill={publication.liked_by_me ? "currentColor" : "none"} />
          {formatCount(publication.like_count)}
        </button>
      </div>
    </article>
  );
}

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
  const activeWallet = wallet.activeWallet;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMusicDiscover({
      search: search.trim() || undefined,
      style: genre === "All" ? undefined : genre,
      sort,
      wallet: activeWallet,
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
  }, [activeWallet, genre, search, sort]);

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

  async function likePublication(publication: MusicPublication) {
    let signerWallet = activeWallet;
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
                <TrackCard
                  publication={featured}
                  featured
                  playing={currentTrack?.publicationId === featured.id && isPlaying}
                  onPlay={playPublication}
                  onLike={likePublication}
                />
              </section>
            )}

            <section className="discover-rail">
              <div className="discover-section-heading"><span><TrendingUp size={17} /> Popular now</span></div>
              <div className="discover-scroll">
                {popular.map((publication) => (
                  <TrackCard
                    key={publication.id}
                    publication={publication}
                    playing={currentTrack?.publicationId === publication.id && isPlaying}
                    onPlay={playPublication}
                    onLike={likePublication}
                  />
                ))}
              </div>
            </section>

            <section className="discover-rail">
              <div className="discover-section-heading"><span><Music2 size={17} /> New releases</span></div>
              <div className="discover-grid">
                {newTracks.map((publication) => (
                  <TrackCard
                    key={publication.id}
                    publication={publication}
                    featured={publication.id === queryTrack}
                    playing={currentTrack?.publicationId === publication.id && isPlaying}
                    onPlay={playPublication}
                    onLike={likePublication}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
