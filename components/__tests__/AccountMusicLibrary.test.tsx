import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import LibraryPage from "../../pages/music/library";
import PlaylistPage from "../../pages/playlist/[id]";
import DiscoverPage from "../../pages/discover";
import CreatorPage from "../../pages/creator/[wallet]";
import { fetchMusicDiscover, fetchMusicCreator, type MusicPublication } from "../../lib/havnai";

const state = vi.hoisted(() => ({ configured: true, loading: false, account: { id: "alice" } as { id: string } | null,
  request: vi.fn(), connect: vi.fn(), error: "", query: {} as Record<string, string>, push: vi.fn(), playQueue: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ connectedWallet: "0xlegacy", connect: state.connect }) }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: state.query, push: state.push }) }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => ({ currentTrack: null, isPlaying: false, playTrack: vi.fn(), playQueue: state.playQueue, toggle: vi.fn() }) }));
vi.mock("../../lib/havnai", async original => ({ ...await original<typeof import("../../lib/havnai")>(), fetchMusicDiscover: vi.fn(), fetchMusicCreator: vi.fn() }));

const song: MusicPublication = { id: "song", title: "My song", creator_wallet: "", creator: "Artist", creator_url: "/creator/creator_public",
  style: "Jazz", tags: [], instrumental: false, audio_url: "/api/music/publications/song/audio", like_count: 1, play_count: 0,
  liked_by_me: true, saved_by_me: true, published_at: 1, updated_at: 1 };
const playlist = () => ({ id: "playlist-one", title: "Private mix", description: "", owner_wallet: "", owner: "Artist", is_public: false,
  is_owner: true, publications: [song], track_count: 1, artwork_tiles: [], artwork_seed: "seed", created_at: 1, updated_at: 1 });
let host: HTMLDivElement, root: Root;
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.getAttribute("aria-label") === name || item.textContent?.trim() === name)!;
const input = (name: string, value: string) => {
  const field = host.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected wallet transport"); }));
  state.account = { id: "alice" }; state.query = {}; state.request.mockReset(); state.connect.mockReset(); state.push.mockReset();
  sessionStorage.clear();
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith("/v2/music/library")) return { publications: [song], recent_liked: [], playlists: [playlist()], total: 1, limit: 80, offset: 0 };
    if (path === "/v2/music/preferences") return { preferences: { song: { liked_by_me: true, saved_by_me: true, like_count: 1 } } };
    if (path.endsWith("/save")) return { ok: true, saved: JSON.parse(String(init?.body)).saved };
    if (path.endsWith("/like")) return { ok: true, liked: JSON.parse(String(init?.body)).liked, like_count: 0 };
    if (path === "/v2/music/playlists" && init?.method === "POST") return { ...playlist(), ...JSON.parse(String(init.body)) };
    if (path === "/v2/music/playlists") return { playlists: [playlist()] };
    if (path.startsWith("/v2/music/playlists/")) return init?.method === "PATCH" ? { ...playlist(), ...JSON.parse(String(init.body)) } : playlist();
    throw new Error(`Unexpected account route: ${path}`);
  });
  vi.mocked(fetchMusicDiscover).mockResolvedValue({ publications: [{ ...song, liked_by_me: false, saved_by_me: false }], total: 1, limit: 48, offset: 0, sort: "newest" });
  vi.mocked(fetchMusicCreator).mockResolvedValue({ wallet: "", display_name: "Artist", track_count: 1, play_count: 0, like_count: 1, publications: [song], playlists: [], sort: "newest" });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("loads a signed-in library, changes preferences, creates and shares playlists without wallet calls", async () => {
  await act(async () => root.render(<StrictMode><LibraryPage /></StrictMode>));
  expect(host.textContent).toContain("Private mix");
  await act(async () => button("Unlike My song").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/publications/song/like", expect.objectContaining({ method: "PUT", body: '{"liked":false}' }));
  await act(async () => button("Remove My song from library").click());
  expect(host.textContent).toContain("No saved songs");
  await act(async () => input("New playlist name", "New mix"));
  await act(async () => { button("Create playlist").click(); button("Create playlist").click(); });
  const creates = state.request.mock.calls.filter(([path, init]) => path === "/v2/music/playlists" && init?.method === "POST");
  expect(creates).toHaveLength(1);
  expect(JSON.parse(creates[0][1].body)).toEqual(expect.objectContaining({ title: "New mix", is_public: false }));
  expect(JSON.parse(creates[0][1].body)).not.toHaveProperty("wallet");
  await act(async () => button("Make public").click());
  expect(host.textContent).toContain("Make private");
  expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("clears private library state on account switch and rejects late responses", async () => {
  let finish!: (value: unknown) => void;
  state.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<LibraryPage />));
  const signal = state.request.mock.calls[0][1].signal as AbortSignal;
  state.account = null;
  await act(async () => root.render(<LibraryPage />));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ publications: [song], recent_liked: [], playlists: [playlist()], total: 1 }));
  expect(host.textContent).not.toContain("Private mix"); expect(host.textContent).not.toContain("My song");
  expect(host.querySelector('a[href="/sign-in"]')).not.toBeNull();
  expect(state.connect).not.toHaveBeenCalled();
});

it("edits account playlist metadata, visibility, and membership without wallet calls", async () => {
  state.query = { id: "playlist-one" };
  await act(async () => root.render(<PlaylistPage />));
  await act(async () => input("Playlist title", "Renamed mix"));
  await act(async () => button("Save").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/playlists/playlist-one", expect.objectContaining({ method: "PATCH", body: '{"title":"Renamed mix","description":""}' }));
  await act(async () => button("Make Public").click());
  expect(button("Make Private")).toBeTruthy();
  await act(async () => button("Remove My song").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/playlists/playlist-one/items/song", expect.objectContaining({ method: "DELETE" }));
  expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("personalizes Discover and adds a song to an account playlist without signing", async () => {
  await act(async () => root.render(<DiscoverPage />));
  expect(button("Unlike My song")).toBeTruthy();
  expect(button("Remove My song from library")).toBeTruthy();
  await act(async () => button("Add My song to playlist").click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => button("Private mix1 track").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/playlists/playlist-one/items/song", expect.objectContaining({ method: "PUT" }));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("uses public creator browsing and account preferences instead of wallet read signatures", async () => {
  state.query = { wallet: "0xpubliccreator" };
  await act(async () => root.render(<CreatorPage />));
  expect(fetchMusicCreator).toHaveBeenLastCalledWith("0xpubliccreator", { sort: "newest", viewerWallet: undefined });
  await act(async () => button("Unlike My song").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/publications/song/like", expect.objectContaining({ method: "PUT" }));
  expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("keeps guest Discover public and offers sign-in for saves even with a connected wallet", async () => {
  state.account = null;
  await act(async () => root.render(<DiscoverPage />));
  await act(async () => button("Save My song").click());
  expect(host.textContent).toContain("Sign in to save songs");
  expect(state.request).not.toHaveBeenCalled(); expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("loads saved songs beyond the first page without duplicating records", async () => {
  state.request.mockImplementation(async (path: string) => ({ publications: path.includes("offset=1") ? [song, { ...song, id: "second", title: "Older song" }] : [song],
    recent_liked: [], playlists: [], total: 2, limit: 80, offset: path.includes("offset=1") ? 1 : 0 }));
  await act(async () => root.render(<LibraryPage />));
  await act(async () => button("Load more saved songs").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/library?limit=80&offset=1", expect.anything());
  expect(host.querySelectorAll(".discover-track")).toHaveLength(2);
  expect(host.textContent).toContain("Older song");
  expect(button("Load more saved songs")).toBeUndefined();
});

it("reports a failed save and restores its previous state without wallet fallback", async () => {
  await act(async () => root.render(<DiscoverPage />));
  state.request.mockRejectedValueOnce(new Error("Library service unavailable. Please retry."));
  await act(async () => button("Remove My song from library").click());
  expect(host.textContent).toContain("Library service unavailable. Please retry.");
  expect(button("Remove My song from library")).toBeTruthy();
  expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
