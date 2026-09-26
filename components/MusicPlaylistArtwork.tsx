import Image from "next/image";
import { useState } from "react";

function PlaylistCover({ src, sizes }: { src: string; sizes: string }) {
  const [failed, setFailed] = useState<string>();
  return <Image src={failed === src ? "/music-default-cover.png" : src} alt="" fill sizes={sizes} unoptimized onError={() => setFailed(src)} />;
}

export function MusicPlaylistArtwork({
  title,
  artworkUrl,
  artworkTiles = [],
}: {
  title: string;
  artworkUrl?: string | null;
  artworkTiles?: string[];
}) {
  const tiles = artworkTiles.filter(Boolean).slice(0, 4);
  if (artworkUrl) {
    return (
      <span className="music-playlist-artwork">
        <PlaylistCover src={artworkUrl} sizes="220px" />
      </span>
    );
  }
  if (tiles.length > 0) {
    return (
      <span className={`music-playlist-artwork has-tiles tile-count-${tiles.length}`} role="img" aria-label={`${title} artwork`}>
        {tiles.map((tile, index) => (
          <span key={`${tile}-${index}`}>
            <PlaylistCover src={tile} sizes="110px" />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="music-playlist-artwork is-empty" role="img" aria-label={`${title} artwork`}>
      <span>H</span>
    </span>
  );
}
