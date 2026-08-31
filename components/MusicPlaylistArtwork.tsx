import Image from "next/image";

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
        <Image src={artworkUrl} alt="" fill sizes="220px" unoptimized />
      </span>
    );
  }
  if (tiles.length > 0) {
    return (
      <span className={`music-playlist-artwork has-tiles tile-count-${tiles.length}`} aria-label={`${title} artwork`}>
        {tiles.map((tile, index) => (
          <span key={`${tile}-${index}`}>
            <Image src={tile} alt="" fill sizes="110px" unoptimized />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="music-playlist-artwork is-empty" aria-label={`${title} artwork`}>
      <span>H</span>
    </span>
  );
}
