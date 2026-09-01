import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ListMusic, Music2, Play, UserRound } from "lucide-react";
import { AddToPlaylistDialog } from "../../components/AddToPlaylistDialog";
import { MusicPlaylistArtwork } from "../../components/MusicPlaylistArtwork";
import { MusicPublicationCard } from "../../components/MusicPublicationCard";
import { SiteHeader } from "../../components/SiteHeader";
import { useMusicPlayer, type PlayerTrack } from "../../components/MusicPlayer";
import { useWallet } from "../../components/WalletProvider";
import {
  fetchMusicCreator,
  setMusicPublicationLike,
  setMusicPublicationSaved,
  type MusicCreatorProfile,
  type MusicPublication,
} from "../../lib/havnai";
import { formatWalletShort } from "../../lib/wallet";

function compactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value || 0);
}

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

export default function CreatorPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { currentTrack, isPlaying, playTrack, playQueue, toggle } = useMusicPlayer();
  const [sort, setSort] = useState("newest");
  const [profile, setProfile] = useState<MusicCreatorProfile | null>(null);
  const [target, setTarget] = useState<MusicPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const creatorWallet = typeof router.query.wallet === "string" ? router.query.wallet : "";
  const connectedWallet = wallet.connectedWallet;

  useEffect(() => {
    let active = true;
    if (!creatorWallet) return;
    setLoading(true);
    setError("");
    fetchMusicCreator(creatorWallet, { sort, viewerWallet: connectedWallet })
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Creator could not load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [connectedWallet, creatorWallet, sort]);

  const queue = useMemo(() => (profile?.publications || []).map(toTrack).filter(Boolean) as PlayerTrack[], [profile]);

  async function ensureWallet(): Promise<string | null> {
    if (connectedWallet) return connectedWallet;
    return wallet.connect().catch(() => null);
  }

  function patchPublication(publication: MusicPublication, patch: Partial<MusicPublication>) {
    setProfile((current) => current ? {
      ...current,
      publications: current.publications.map((item) => item.id === publication.id ? { ...item, ...patch } : item),
    } : current);
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

  async function likePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextLiked = !publication.liked_by_me;
    patchPublication(publication, { liked_by_me: nextLiked, like_count: Math.max(0, publication.like_count + (nextLiked ? 1 : -1)) });
    try {
      const result = await setMusicPublicationLike(publication.id, nextLiked, signer);
      patchPublication(publication, { liked_by_me: result.liked, like_count: result.like_count });
    } catch {
      patchPublication(publication, { liked_by_me: publication.liked_by_me, like_count: publication.like_count });
    }
  }

  async function savePublication(publication: MusicPublication) {
    const signer = await ensureWallet();
    if (!signer) return;
    const nextSaved = !publication.saved_by_me;
    patchPublication(publication, { saved_by_me: nextSaved });
    try {
      const result = await setMusicPublicationSaved(publication.id, nextSaved, signer);
      patchPublication(publication, { saved_by_me: result.saved });
    } catch {
      patchPublication(publication, { saved_by_me: publication.saved_by_me });
    }
  }

  return (
    <>
      <Head>
        <title>{profile ? `${profile.display_name} | HavnAI` : "Creator | HavnAI"}</title>
      </Head>
      <SiteHeader />
      <main className="music-discover-page music-creator-page">
        {loading ? (
          <div className="discover-skeleton" />
        ) : error || !profile ? (
          <section className="music-empty">
            <UserRound size={28} />
            <strong>Creator unavailable</strong>
            <span>{error || "No public HavnAI music is published for this wallet."}</span>
          </section>
        ) : (
          <>
            <section className="music-creator-hero">
              <div><UserRound size={38} /></div>
              <div>
                <span>Creator</span>
                <h1>{profile.display_name}</h1>
                <p title={profile.wallet}>{formatWalletShort(profile.wallet)}</p>
                <dl>
                  <div><dt>Tracks</dt><dd>{compactCount(profile.track_count)}</dd></div>
                  <div><dt>Plays</dt><dd>{compactCount(profile.play_count)}</dd></div>
                  <div><dt>Likes</dt><dd>{compactCount(profile.like_count)}</dd></div>
                </dl>
                <button type="button" disabled={queue.length === 0} onClick={() => playQueue(queue)}>
                  <Play size={17} fill="currentColor" /> Play All
                </button>
              </div>
            </section>

            <nav className="discover-genres" aria-label="Creator music sort">
              {[
                ["newest", "Newest"],
                ["popular", "Popular"],
              ].map(([value, label]) => (
                <button key={value} type="button" className={sort === value ? "is-active" : ""} onClick={() => setSort(value)}>
                  {label}
                </button>
              ))}
            </nav>

            <section className="discover-rail">
              <div className="discover-section-heading"><span><Music2 size={17} /> Public Music</span></div>
              <div className="discover-grid">
                {profile.publications.map((publication) => (
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

            {profile.playlists.length > 0 && (
              <section className="discover-rail">
                <div className="discover-section-heading"><span><ListMusic size={17} /> Public Playlists</span></div>
                <div className="music-playlist-grid">
                  {profile.playlists.map((playlist) => (
                    <article key={playlist.id} className="music-playlist-card">
                      <Link href={`/playlist/${playlist.id}`}>
                        <MusicPlaylistArtwork title={playlist.title} artworkUrl={playlist.artwork_url} artworkTiles={playlist.artwork_tiles} />
                        <span>
                          <strong>{playlist.title}</strong>
                          <small>{playlist.track_count} tracks</small>
                        </span>
                      </Link>
                    </article>
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
      />
    </>
  );
}
