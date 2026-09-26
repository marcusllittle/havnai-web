import type { MusicPublication } from "./havnai";

export function matchesMusicLibrarySearch(publication: MusicPublication, search: string): boolean {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    publication.title,
    publication.creator,
    publication.creator_wallet,
    publication.style,
    ...(publication.tags || []),
  ].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
