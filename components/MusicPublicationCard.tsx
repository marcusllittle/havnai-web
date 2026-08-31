import Image from "next/image";
import Link from "next/link";
import { Bookmark, Heart, ListPlus, Pause, Play } from "lucide-react";
import type { MusicPublication } from "../lib/havnai";
import { formatMusicDuration } from "../lib/musicJobPresentation";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value || 0);
}

export function publicationCreatorHref(publication: MusicPublication): string {
  return publication.creator_url || `/creator/${publication.creator_wallet}`;
}

export function MusicPublicationCard({
  publication,
  featured = false,
  playing,
  onPlay,
  onLike,
  onSave,
  onAddToPlaylist,
}: {
  publication: MusicPublication;
  featured?: boolean;
  playing: boolean;
  onPlay: (publication: MusicPublication) => void;
  onLike?: (publication: MusicPublication) => void;
  onSave?: (publication: MusicPublication) => void;
  onAddToPlaylist?: (publication: MusicPublication) => void;
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
        <Link href={publicationCreatorHref(publication)}>{publication.creator}</Link>
        <span>{formatMusicDuration(publication.duration || 0)}</span>
      </div>
      <div className="discover-track-actions">
        <span>{formatCount(publication.play_count)} plays</span>
        <div>
          {onSave && (
            <button
              type="button"
              className={publication.saved_by_me ? "is-saved" : ""}
              onClick={() => onSave(publication)}
              aria-label={publication.saved_by_me ? `Remove ${publication.title} from library` : `Save ${publication.title}`}
              title={publication.saved_by_me ? "Saved" : "Save"}
            >
              <Bookmark size={16} fill={publication.saved_by_me ? "currentColor" : "none"} />
            </button>
          )}
          {onAddToPlaylist && (
            <button
              type="button"
              onClick={() => onAddToPlaylist(publication)}
              aria-label={`Add ${publication.title} to playlist`}
              title="Add to playlist"
            >
              <ListPlus size={16} />
            </button>
          )}
          {onLike && (
            <button
              type="button"
              className={publication.liked_by_me ? "is-liked" : ""}
              onClick={() => onLike(publication)}
              aria-label={publication.liked_by_me ? `Unlike ${publication.title}` : `Like ${publication.title}`}
              title={publication.liked_by_me ? "Unlike" : "Like"}
            >
              <Heart size={16} fill={publication.liked_by_me ? "currentColor" : "none"} />
              {formatCount(publication.like_count)}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
