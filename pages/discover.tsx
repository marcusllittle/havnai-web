import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { ArrowUpRight, AudioLines, Headphones, Music2, RefreshCw, Search, X } from "lucide-react";
import { AddToPlaylistDialog } from "../components/AddToPlaylistDialog";
import { MusicPublicationCard } from "../components/MusicPublicationCard";
import { SiteHeader } from "../components/SiteHeader";
import { useMusicPlayer } from "../components/MusicPlayer";
import { useWallet } from "../components/WalletProvider";
import { useMusicAccess, withMusicIdentity, MusicAccountNotice } from "../components/MusicAccountAccess";
import {
  type MusicPublication,
} from "../lib/havnai";

const GENRES = ["All", "Pop", "Hip hop", "Rock", "R&B", "Electronic", "Cinematic", "Country", "Jazz"];

function DiscoverPage() {
  const router = useRouter();
  const wallet = useWallet();
  const access = useMusicAccess();
  const { fetchMusicDiscover, setMusicPublicationLike, setMusicPublicationSaved } = access;
  const { currentTrack, isPlaying, playTrack, toggle } = useMusicPlayer();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [sort, setSort] = useState("newest");
  const [publications, setPublications] = useState<MusicPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [total, setTotal] = useState(0);
  const [playlistTarget, setPlaylistTarget] = useState<MusicPublication | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMusicDiscover({
      search: submittedSearch || undefined,
      style: genre === "All" ? undefined : genre,
      sort,
      // Browsing the public catalog never requires a wallet signature.
      limit: 48,
    })
      .then((response) => {
        if (active) {
          setPublications(response.publications);
          setTotal(response.total);
        }
      })
      .catch(() => {
        if (active) {
          setPublications([]);
          setError("We couldn’t reach the music catalog. Try again in a moment.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [genre, submittedSearch, sort, revision, fetchMusicDiscover]);

  const queryTrack = typeof router.query.track === "string" ? router.query.track : "";
  const filtered = Boolean(submittedSearch || genre !== "All");
  const featured = !filtered && sort === "newest" ? publications[0] : undefined;
  const tracks = featured ? publications.slice(1) : publications;
  const sectionTitle = submittedSearch ? `Results for “${submittedSearch}”` : genre !== "All" ? `${genre} discoveries` : sort === "popular" ? "Most played" : sort === "liked" ? "Most liked" : "Fresh from the community";

  function clearFilters() {
    setSearch("");
    setSubmittedSearch("");
    setGenre("All");
  }

  function playPublication(publication: MusicPublication) {
    if (!publication.audio_url) return;
    if (currentTrack?.publicationId === publication.id && isPlaying) {
      toggle();
      return;
    }
    const queue = publications.filter(item => item.audio_url).map(item => ({
      id: `publication-${item.id}`,
      publicationId: item.id,
      title: item.title,
      style: item.style || "HavnAI Music",
      audioUrl: item.audio_url!,
      artworkUrl: item.cover_art_url || "/music-default-cover.png",
      duration: item.duration || undefined,
    }));
    const index = queue.findIndex(item => item.publicationId === publication.id);
    if (index >= 0) playTrack(queue[index], queue, index);
  }

  function patchPublication(publicationId: string, patch: Partial<MusicPublication>) {
    setPublications((current) => current.map((item) => item.id === publicationId ? { ...item, ...patch } : item));
  }

  async function likePublication(publication: MusicPublication) {
    const signerWallet = await access.ensureListener();
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
    const signerWallet = await access.ensureListener();
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
      <MusicAccountNotice message={access.notice} />
      <main className="music-discover-page listening-page">
        <header className="listening-heading">
          <div>
            <span className="listening-eyebrow"><Headphones size={14} aria-hidden="true" /> Made here. Heard everywhere.</span>
            <h1>Find your next repeat.</h1>
            <p>Original sounds from the HavnAI community.</p>
          </div>
          <Link className="listening-create" href="/music">Make a song <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </header>

        <div className="listening-tools">
          <form className="listening-search" role="search" onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(search.trim()); }}>
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label="Search songs, styles, or creators" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Songs, styles, or creators" />
            {(search || submittedSearch) && <button type="button" className="listening-clear" aria-label="Clear search" onClick={() => { setSearch(""); setSubmittedSearch(""); }}><X size={17} aria-hidden="true" /></button>}
            <button className="listening-search-submit" type="submit">Search</button>
          </form>
          <Link className="listening-library" href="/music/library">Your music library <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>

        <nav className="discover-genres" aria-label="Browse by genre">
          {GENRES.map((item) => (
            <button key={item} type="button" aria-pressed={genre === item} className={genre === item ? "is-active" : ""} onClick={() => setGenre(item)}>
              {item}
            </button>
          ))}
        </nav>

        {loading ? (
          <section className="listening-loading" aria-label="Loading songs" aria-busy="true">
            <p role="status"><AudioLines size={17} aria-hidden="true" /> Finding your next listen…</p>
            <div className="discover-grid" aria-hidden="true">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="discover-skeleton" />)}</div>
          </section>
        ) : error ? (
          <section className="listening-empty" role="alert">
            <span className="listening-state-icon"><Headphones size={30} aria-hidden="true" /></span>
            <h2>The music is out of reach.</h2>
            <p>{error}</p>
            <button type="button" className="listening-create" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
          </section>
        ) : publications.length === 0 ? (
          <section className="listening-empty">
            <span className="listening-state-icon"><Music2 size={30} aria-hidden="true" /></span>
            <span className="listening-eyebrow">{filtered ? "Keep exploring" : "Every scene starts somewhere"}</span>
            <h2>{filtered ? "No songs in this mix yet." : "Be the first sound."}</h2>
            <p>{filtered ? "Try another genre or a different search. Your next favorite could be one click away." : "Make something only you could imagine. Publish your song from Music Studio and give this space its first repeat."}</p>
            {filtered ? <button type="button" className="listening-create" onClick={clearFilters}>Clear filters</button> : <Link className="listening-create" href="/music">Open Music Studio <ArrowUpRight size={16} aria-hidden="true" /></Link>}
          </section>
        ) : (
          <>
            {featured && (
              <section className="discover-feature" aria-label="Latest release">
                <div className="listening-spotlight-label"><AudioLines size={15} aria-hidden="true" /> A fresh arrival <span>Made with HavnAI</span></div>
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
              <div className="listening-section-heading">
                <div><h2>{sectionTitle}</h2><p>{publications.length < total ? `${publications.length} of ${total} songs` : `${publications.length} ${publications.length === 1 ? "song" : "songs"}`} to explore</p></div>
                <label><span className="listening-sr-only">Sort songs</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="popular">Most played</option><option value="liked">Most liked</option></select></label>
              </div>
              <div className="discover-grid">
                {tracks.map((publication) => (
                  <MusicPublicationCard
                    key={publication.id}
                    publication={publication}
                    highlighted={publication.id === queryTrack}
                    playing={currentTrack?.publicationId === publication.id && isPlaying}
                    onPlay={playPublication}
                    onLike={likePublication}
                    onSave={savePublication}
                    onAddToPlaylist={setPlaylistTarget}
                  />
                ))}
              </div>
              {featured && tracks.length === 0 && <p className="listening-catalog-note">You’re here early. More releases will appear as creators publish.</p>}
              {total > publications.length && <p className="listening-catalog-note">Showing the first {publications.length} songs. Search or choose a genre to explore more.</p>}
            </section>
          </>
        )}
      </main>
      <AddToPlaylistDialog
        publication={playlistTarget}
        walletAddress={wallet.connectedWallet}
        connectWallet={() => wallet.connect().catch(() => null)}
        onClose={() => setPlaylistTarget(null)}
      />
    </>
  );
}

export default withMusicIdentity(DiscoverPage);
