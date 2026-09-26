import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DiscoverPage from "../../pages/discover";
import { fetchMusicDiscover, type MusicPublication } from "../../lib/havnai";

const player = vi.hoisted(() => ({ currentTrack: null, isPlaying: false, playTrack: vi.fn(), toggle: vi.fn() }));
const wallet = vi.hoisted(() => ({ connectedWallet: "0x1111111111111111111111111111111111111111", connect: vi.fn() }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: {} }) }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../AddToPlaylistDialog", () => ({ AddToPlaylistDialog: () => null }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => player }));
vi.mock("../WalletProvider", () => ({ useWallet: () => wallet }));
vi.mock("../../lib/havnai", async importOriginal => ({
  ...await importOriginal<typeof import("../../lib/havnai")>(), fetchMusicDiscover: vi.fn(),
}));

function song(index: number): MusicPublication {
  return { id: `song-${index}`, title: `Song ${index}`, creator: "Artist", creator_wallet: "0xartist", style: "Jazz", tags: [], instrumental: false, audio_url: "https://example.com/song.wav", cover_art_url: "https://example.com/cover.png", play_count: 10, like_count: 2, liked_by_me: false, saved_by_me: false, published_at: index, updated_at: index };
}
const catalog = (count = 2) => ({ publications: Array.from({ length: count }, (_, index) => song(index)), total: count, limit: 48, offset: 0, sort: "newest" });

describe("Discover browsing", () => {
  let container: HTMLDivElement;
  let root: Root;
  const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent?.trim() === text)!;
  const changeSearch = (value: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(fetchMusicDiscover).mockResolvedValue(catalog());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("shows every fetched song once and gives playback a queue of available audio", async () => {
    const response = catalog(48);
    response.publications[1].audio_url = undefined;
    vi.mocked(fetchMusicDiscover).mockResolvedValue(response);
    await act(async () => root.render(<DiscoverPage />));
    expect(fetchMusicDiscover).toHaveBeenCalledWith(expect.not.objectContaining({ wallet: expect.anything() }));
    expect(wallet.connect).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".discover-track")).toHaveLength(48);
    expect(container.querySelectorAll(".is-featured")).toHaveLength(1);
    const unavailable = container.querySelector<HTMLButtonElement>('[aria-label="Play Song 1"]')!;
    expect(unavailable.disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Play Song 2"]')!.click());
    expect(player.playTrack).toHaveBeenCalledWith(expect.objectContaining({ publicationId: "song-2" }), expect.any(Array), 1);
    expect(player.playTrack.mock.calls[0][1]).toHaveLength(47);
  });

  it("submits a search deliberately and distinguishes unmatched filters from an empty catalog", async () => {
    await act(async () => root.render(<DiscoverPage />));
    await act(async () => changeSearch("  sunrise  "));
    expect(fetchMusicDiscover).toHaveBeenCalledTimes(1);
    vi.mocked(fetchMusicDiscover).mockResolvedValue(catalog(0));
    await act(async () => button("Search").click());
    expect(fetchMusicDiscover).toHaveBeenLastCalledWith(expect.objectContaining({ search: "sunrise" }));
    expect(container.textContent).toContain("No songs in this mix yet.");
    expect(container.textContent).not.toContain("Be the first sound.");
    vi.mocked(fetchMusicDiscover).mockResolvedValue(catalog());
    await act(async () => button("Clear filters").click());
    expect(container.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe("");
    expect(container.querySelectorAll(".discover-track")).toHaveLength(2);
  });

  it("offers retry on failure without claiming the catalog is empty", async () => {
    vi.mocked(fetchMusicDiscover).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => root.render(<DiscoverPage />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("out of reach");
    expect(container.textContent).not.toContain("Be the first sound.");
    await act(async () => button("Try again").click());
    expect(container.querySelectorAll(".discover-track")).toHaveLength(2);
  });

  it("keeps the latest genre response when an older request finishes later", async () => {
    let finishOld: (value: ReturnType<typeof catalog>) => void = () => {};
    vi.mocked(fetchMusicDiscover).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    await act(async () => root.render(<DiscoverPage />));
    await act(async () => button("Jazz").click());
    expect(button("Jazz").getAttribute("aria-pressed")).toBe("true");
    await act(async () => finishOld(catalog(0)));
    expect(container.querySelectorAll(".discover-track")).toHaveLength(2);
    expect(container.querySelector(".is-featured")).toBeNull();
  });

  it("uses fallback cover art when a remote cover fails", async () => {
    await act(async () => root.render(<DiscoverPage />));
    const cover = container.querySelector<HTMLImageElement>(".discover-artwork img")!;
    await act(async () => cover.dispatchEvent(new Event("error")));
    expect(new URL(cover.src).pathname).toBe("/music-default-cover.png");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Play Song 0"]')!.disabled).toBe(false);
  });
});
