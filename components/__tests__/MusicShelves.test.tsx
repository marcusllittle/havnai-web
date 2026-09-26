import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MusicLibraryPage from "../../pages/music/library";
import PlaylistPage from "../../pages/playlist/[id]";
import CreatorPage from "../../pages/creator/[wallet]";
import { AddToPlaylistDialog } from "../AddToPlaylistDialog";
import * as api from "../../lib/havnai";

const { wallet, router, player } = vi.hoisted(() => ({
  wallet: { connectedWallet: "0x1111111111111111111111111111111111111111" as string | null, connecting: false, connect: vi.fn() },
  router: { query: { id: "mix", wallet: "creator" }, push: vi.fn() },
  player: { currentTrack: null, isPlaying: false, playTrack: vi.fn(), playQueue: vi.fn(), toggle: vi.fn() },
}));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../WalletProvider", () => ({ useWallet: () => wallet }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => player }));
vi.mock("../../lib/havnai", async original => ({
  ...await original<typeof import("../../lib/havnai")>(),
  fetchMusicLibrary: vi.fn(), fetchMusicPlaylist: vi.fn(), fetchMusicCreator: vi.fn(), fetchMyMusicPlaylists: vi.fn(),
  createMusicPlaylist: vi.fn(), updateMusicPlaylist: vi.fn(), deleteMusicPlaylist: vi.fn(), reorderMusicPlaylistItems: vi.fn(),
}));
const song: api.MusicPublication = { id: "song-1", title: "Coastal motion", creator: "Studio North", creator_wallet: "creator", style: "Ambient", tags: [], instrumental: true, audio_url: "https://example.com/song.wav", duration: 120, play_count: 4, like_count: 1, liked_by_me: true, saved_by_me: true, published_at: 1, updated_at: 1 };
const playlist: api.MusicPlaylist = { id: "mix", owner_wallet: "owner", owner: "Studio North", title: "Evening mix", description: "Slow down", is_owner: true, is_public: false, artwork_seed: "a", artwork_tiles: [], track_count: 2, duration: 120, publications: [song, { ...song, id: "unavailable", title: "Unfinished", audio_url: undefined }], created_at: 1, updated_at: 1 };
const library = { publications: playlist.publications, recent_liked: [], playlists: [playlist], total: 2, limit: 80, offset: 0 };

describe("Music library and playlist experience", () => {
  let container: HTMLDivElement; let root: Root;
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.trim() === label)!;
  async function render(node: React.ReactNode) { await act(async () => root.render(node)); }
  async function fill(label: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    wallet.connectedWallet = "0x1111111111111111111111111111111111111111";
    wallet.connect.mockResolvedValue(wallet.connectedWallet);
    vi.mocked(api.fetchMusicLibrary).mockResolvedValue(library);
    vi.mocked(api.fetchMusicPlaylist).mockResolvedValue(playlist);
    vi.mocked(api.fetchMyMusicPlaylists).mockResolvedValue([]);
    vi.mocked(api.fetchMusicCreator).mockResolvedValue({ wallet: "creator", display_name: "Studio North", publications: [song], playlists: [], track_count: 1, play_count: 4, like_count: 1, sort: "newest" });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("offers a direct wallet connection without fetching private data as a guest", async () => {
    wallet.connectedWallet = null;
    await render(<MusicLibraryPage />);
    expect(api.fetchMusicLibrary).not.toHaveBeenCalled();
    await act(async () => button("Connect wallet").click());
    expect(wallet.connect).toHaveBeenCalledTimes(1);
    expect(container.querySelector('a[href="/discover"]')).not.toBeNull();
    wallet.connect.mockRejectedValueOnce(new Error("Connection declined"));
    await act(async () => button("Connect wallet").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Connection declined");
  });

  it("retries a failed library without claiming it is empty and filters locally", async () => {
    vi.mocked(api.fetchMusicLibrary).mockRejectedValueOnce(new Error("Offline"));
    await render(<MusicLibraryPage />);
    expect(container.textContent).toContain("Your library is out of reach.");
    expect(container.textContent).not.toContain("No saved songs");
    await act(async () => button("Try again").click());
    await fill("Search saved songs", "Coastal");
    expect(container.querySelectorAll(".discover-track")).toHaveLength(1);
    expect(api.fetchMusicLibrary).toHaveBeenCalledTimes(2);
    await act(async () => button("Play All").click());
    expect(player.playQueue).toHaveBeenCalledWith([expect.objectContaining({ publicationId: "song-1" })]);
  });

  it("keeps the playlist draft and reports a failed creation", async () => {
    vi.mocked(api.createMusicPlaylist).mockRejectedValueOnce(new Error("Signature rejected"));
    await render(<MusicLibraryPage />);
    await fill("New playlist name", "Late light");
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Create playlist"]')!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Signature rejected");
    expect(container.querySelector<HTMLInputElement>('input[aria-label="New playlist name"]')!.value).toBe("Late light");
    expect(container.querySelectorAll(".music-playlist-card")).toHaveLength(1);
  });

  it("clears the previous wallet's visible library when the wallet changes", async () => {
    await render(<MusicLibraryPage />);
    vi.mocked(api.fetchMusicLibrary).mockImplementationOnce(() => new Promise(() => {}));
    wallet.connectedWallet = "0x2222222222222222222222222222222222222222";
    await render(<MusicLibraryPage />);
    expect(container.querySelectorAll(".discover-track")).toHaveLength(0);
    expect(container.querySelectorAll(".music-playlist-card")).toHaveLength(0);
  });

  it("retains track order when reordering fails and excludes unavailable audio from playback", async () => {
    vi.mocked(api.reorderMusicPlaylistItems).mockRejectedValueOnce(new Error("Reorder failed"));
    await render(<PlaylistPage />);
    expect(container.querySelector<HTMLDetailsElement>(".shelf-editor")?.open).toBe(false);
    await act(async () => button("Play All").click());
    expect(player.playQueue).toHaveBeenCalledWith([expect.objectContaining({ publicationId: "song-1" })]);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Move Coastal motion down"]')!.click());
    expect(api.reorderMusicPlaylistItems).toHaveBeenCalledWith("mix", ["unavailable", "song-1"], wallet.connectedWallet);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Reorder failed");
    expect(container.querySelector(".discover-track-copy strong")?.textContent).toBe("Coastal motion");
  });

  it("retries creator loading and announces the selected sort", async () => {
    vi.mocked(api.fetchMusicCreator).mockRejectedValueOnce(new Error("Offline"));
    await render(<CreatorPage />);
    expect(container.textContent).toContain("Creator unavailable");
    await act(async () => button("Try again").click());
    await act(async () => button("Popular").click());
    expect(button("Popular").getAttribute("aria-pressed")).toBe("true");
    expect(api.fetchMusicCreator).toHaveBeenLastCalledWith("creator", { sort: "popular", viewerWallet: wallet.connectedWallet });
  });

  it("keeps playlist-dialog errors distinct from empty and supports keyboard dismissal", async () => {
    const close = vi.fn();
    vi.mocked(api.fetchMyMusicPlaylists).mockRejectedValueOnce(new Error("Offline"));
    await render(<AddToPlaylistDialog publication={song} walletAddress={wallet.connectedWallet} connectWallet={wallet.connect} onClose={close} />);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    expect(container.textContent).toContain("Your playlists are unavailable.");
    expect(container.textContent).not.toContain("No playlists yet");
    await act(async () => button("Reload playlists").click());
    expect(container.textContent).toContain("No playlists yet.");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
