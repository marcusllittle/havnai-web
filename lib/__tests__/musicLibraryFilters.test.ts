import { describe, expect, it } from "vitest";
import type { MusicPublication } from "../havnai";
import { matchesMusicLibrarySearch } from "../musicLibraryFilters";

const publication: MusicPublication = {
  id: "music-1",
  creator_wallet: "0x1111111111111111111111111111111111111111",
  creator: "0x1111...1111",
  title: "Neon Harbor",
  style: "Dream pop, cinematic",
  tags: ["night drive", "synth"],
  duration: 90,
  bpm: 118,
  key: "A Minor",
  instrumental: true,
  cover_art_url: "/api/music/publications/music-1/cover.svg",
  audio_url: "/api/music/publications/music-1/audio",
  play_count: 4,
  like_count: 2,
  liked_by_me: false,
  saved_by_me: true,
  published_at: 1,
  updated_at: 1,
};

describe("matchesMusicLibrarySearch", () => {
  it("matches saved songs by title, creator wallet, style, and tags", () => {
    expect(matchesMusicLibrarySearch(publication, "harbor")).toBe(true);
    expect(matchesMusicLibrarySearch(publication, "0x1111")).toBe(true);
    expect(matchesMusicLibrarySearch(publication, "cinematic")).toBe(true);
    expect(matchesMusicLibrarySearch(publication, "night drive")).toBe(true);
  });

  it("trims search text and requires every term to match somewhere in the saved song", () => {
    expect(matchesMusicLibrarySearch(publication, "  neon synth  ")).toBe(true);
    expect(matchesMusicLibrarySearch(publication, "neon missing")).toBe(false);
    expect(matchesMusicLibrarySearch(publication, "")).toBe(true);
  });
});
