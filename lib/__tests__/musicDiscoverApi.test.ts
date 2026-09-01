import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addMusicPlaylistItem,
  createMusicPlaylist,
  deleteMusicPlaylist,
  fetchMusicCreator,
  fetchMusicDiscover,
  fetchMusicLibrary,
  fetchMusicPlaylist,
  fetchMyMusicPlaylists,
  recordMusicPublicationPlay,
  removeMusicPlaylistItem,
  reorderMusicPlaylistItems,
  setMusicPublicationSaved,
  updateMusicPlaylist,
} from "../havnai";

const TEST_WALLET = vi.hoisted(() => "0x1111111111111111111111111111111111111111");

vi.mock("ethers", () => ({
  BrowserProvider: class {
    async getSigner() {
      return {
        getAddress: async () => TEST_WALLET,
        signMessage: async () => "0xsigned",
      };
    }
  },
  getAddress: (value: string) => value,
}));

vi.mock("../wallet", () => {
  class WalletError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = "WalletError";
      this.code = code;
    }
  }
  const provider = {
    request: async () => "0x1",
  };
  return {
    ensureInjectedProvider: async () => ({ provider, hasProvider: true, hasConflict: false, error: null }),
    getAllProviders: () => [provider],
    isUsableWallet: (wallet: string | null | undefined) => Boolean(wallet && wallet !== "0x0000000000000000000000000000000000000000"),
    normalizeWalletError: (error: Error) => ({ code: "wallet_unknown", message: error.message }),
    readConnectedAccounts: async () => [TEST_WALLET],
    requestAccounts: async () => [TEST_WALLET],
    WALLET: TEST_WALLET,
    WalletError,
    ZERO_WALLET: "0x0000000000000000000000000000000000000000",
  };
});

describe("music discover API", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function nonceResponse(message = "Sign music action") {
    return new Response(JSON.stringify({
      nonce: "nonce-1",
      message,
      issued_at: "2026-08-31T00:00:00Z",
      expires_at: "2026-08-31T00:05:00Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  function playlistResponse(overrides: Record<string, unknown> = {}) {
    return new Response(JSON.stringify({
      id: "playlist-1",
      owner_wallet: TEST_WALLET,
      owner: "0x1111...1111",
      title: "Night Set",
      description: "",
      is_public: false,
      is_owner: true,
      artwork_url: "/api/music/playlists/playlist-1/cover.svg",
      artwork_tiles: [],
      track_count: 0,
      publications: [],
      ...overrides,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  it("loads public music publications and resolves media URLs through the API proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publications: [{
        id: "music-1",
        creator_wallet: "0x1111111111111111111111111111111111111111",
        creator: "0x1111...1111",
        title: "Neon Coast",
        style: "Dream pop",
        tags: ["Dream pop"],
        duration: 90,
        cover_art_url: "/api/music/publications/music-1/cover.svg",
        audio_url: "/api/music/publications/music-1/audio",
        play_count: 4,
        like_count: 2,
        liked_by_me: true,
        published_at: 100,
        updated_at: 100,
      }],
      total: 1,
      limit: 24,
      offset: 0,
      sort: "popular",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchMusicDiscover({ sort: "popular" });

    expect(fetchMock).toHaveBeenCalledWith("/api/music/discover?sort=popular", expect.objectContaining({
      headers: expect.any(Object),
    }));
    expect(response.publications[0].audio_url).toBe("/api/music/publications/music-1/audio");
    expect(response.publications[0].cover_art_url).toBe("/api/music/publications/music-1/cover.svg");
    expect(response.publications[0].liked_by_me).toBe(true);
    expect(response.publications[0].saved_by_me).toBe(false);
    expect(response.publications[0].job_id).toBeUndefined();
    expect(response.publications[0].audio_artifact_id).toBeUndefined();
    expect(response.publications[0].model).toBeUndefined();
    expect(response.publications[0].cover_art_seed).toBeUndefined();
  });

  it("loads personalized discover state with a signed wallet read", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nonce: "nonce-1",
        message: "Sign discover access",
        issued_at: "2026-08-31T00:00:00Z",
        expires_at: "2026-08-31T00:05:00Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publications: [{
          id: "music-1",
          job_id: "job-1",
          creator_wallet: TEST_WALLET,
          creator: "0x1111...1111",
          title: "Saved Track",
          cover_art_url: "/api/music/publications/music-1/cover.svg",
          audio_url: "/static/outputs/song.mp3",
          play_count: 4,
          like_count: 2,
          liked_by_me: true,
          saved_by_me: true,
        }],
        total: 1,
        limit: 48,
        offset: 0,
        sort: "popular",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchMusicDiscover({ sort: "popular", wallet: TEST_WALLET, limit: 48 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"music_library_read"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/discover", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
    expect(response.publications[0].saved_by_me).toBe(true);
    expect(response.publications[0].liked_by_me).toBe(true);
    expect(response.publications[0].job_id).toBe("job-1");
  });

  it("times out stalled music read requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const request = expect(fetchMusicDiscover()).rejects.toThrow("Request timed out. Please try again.");

    await vi.advanceTimersByTimeAsync(12_000);
    await request;
  });

  it("records play telemetry after the player threshold", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      counted: true,
      play_count: 5,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await recordMusicPublicationPlay("music-1", {
      seconds_listened: 7,
      session_id: "listener-1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/music/publications/music-1/play");
    expect(JSON.parse(init.body)).toMatchObject({ seconds_listened: 7, session_id: "listener-1" });
  });

  it("loads saved music library payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nonce: "nonce-1",
        message: "Sign library access",
        issued_at: "2026-08-31T00:00:00Z",
        expires_at: "2026-08-31T00:05:00Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
      publications: [{
        id: "music-1",
        creator_wallet: "0x1111111111111111111111111111111111111111",
        creator: "0x1111...1111",
        title: "Saved Track",
        style: "Pop",
        tags: [],
        cover_art_url: "/api/music/publications/music-1/cover.svg",
        audio_url: "/static/outputs/song.mp3",
        play_count: 3,
        like_count: 1,
        liked_by_me: false,
        saved_by_me: true,
      }],
      recent_liked: [],
      playlists: [{ id: "playlist-1", owner_wallet: "0x1111111111111111111111111111111111111111", title: "Mix", track_count: 0 }],
      total: 1,
      limit: 80,
      offset: 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchMusicLibrary({ wallet: TEST_WALLET, search: "saved" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"music_library_read"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/library", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
    expect(response.publications[0].saved_by_me).toBe(true);
    expect(response.publications[0].job_id).toBeUndefined();
    expect(response.playlists[0].title).toBe("Mix");
  });

  it("loads owned playlists with signed wallet access", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(nonceResponse("Sign playlists access"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        playlists: [{
          id: "playlist-1",
          owner_wallet: TEST_WALLET,
          title: "Library Mix",
          is_public: false,
          track_count: 3,
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const playlists = await fetchMyMusicPlaylists(TEST_WALLET);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"playlist_read"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/playlists/mine", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
    expect(playlists[0]).toMatchObject({ id: "playlist-1", title: "Library Mix", track_count: 3 });
  });

  it("saves and unsaves publications with signed wallet writes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(nonceResponse("Sign save"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(nonceResponse("Sign unsave"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, saved: false }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(setMusicPublicationSaved("music-1", true, TEST_WALLET)).resolves.toMatchObject({ saved: true });
    await expect(setMusicPublicationSaved("music-1", false, TEST_WALLET)).resolves.toMatchObject({ saved: false });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"music_save"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/publications/music-1/save", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"music_unsave"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/music/publications/music-1/save", expect.objectContaining({
      method: "DELETE",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
  });

  it("creates, updates, and deletes playlists with owner-scoped signatures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(nonceResponse("Sign create"))
      .mockResolvedValueOnce(playlistResponse({ title: "Night Set", description: "Late drive", is_public: true }))
      .mockResolvedValueOnce(nonceResponse("Sign update"))
      .mockResolvedValueOnce(playlistResponse({ title: "Afterhours", description: "Updated", is_public: false }))
      .mockResolvedValueOnce(nonceResponse("Sign delete"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMusicPlaylist({ wallet: TEST_WALLET, title: "Night Set", description: "Late drive", is_public: true }))
      .resolves.toMatchObject({ title: "Night Set", is_public: true });
    await expect(updateMusicPlaylist("playlist-1", { wallet: TEST_WALLET, title: "Afterhours", description: "Updated", is_public: false }))
      .resolves.toMatchObject({ title: "Afterhours", is_public: false });
    await expect(deleteMusicPlaylist("playlist-1", TEST_WALLET)).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      body: expect.stringContaining('"purpose":"playlist_create"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/playlists", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"is_public":true'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/wallet/nonce", expect.objectContaining({
      body: expect.stringContaining('"purpose":"playlist_update"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/music/playlists/playlist-1", expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"title":"Afterhours"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/wallet/nonce", expect.objectContaining({
      body: expect.stringContaining('"purpose":"playlist_delete"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(6, "/api/music/playlists/playlist-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("adds, removes, and reorders playlist tracks with signed playlist item writes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(nonceResponse("Sign add"))
      .mockResolvedValueOnce(playlistResponse({ track_count: 1, publications: [{ id: "music-1", title: "First" }] }))
      .mockResolvedValueOnce(nonceResponse("Sign remove"))
      .mockResolvedValueOnce(playlistResponse({ track_count: 0, publications: [] }))
      .mockResolvedValueOnce(nonceResponse("Sign reorder"))
      .mockResolvedValueOnce(playlistResponse({ publications: [{ id: "music-2", title: "Second" }, { id: "music-1", title: "First" }] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(addMusicPlaylistItem("playlist-1", "music-1", TEST_WALLET)).resolves.toMatchObject({ track_count: 1 });
    await expect(removeMusicPlaylistItem("playlist-1", "music-1", TEST_WALLET)).resolves.toMatchObject({ track_count: 0 });
    await expect(reorderMusicPlaylistItems("playlist-1", ["music-2", "music-1"], TEST_WALLET))
      .resolves.toMatchObject({ publications: [{ id: "music-2" }, { id: "music-1" }] });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      body: expect.stringContaining('"purpose":"playlist_add"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/playlists/playlist-1/items", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"publication_id":"music-1"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/wallet/nonce", expect.objectContaining({
      body: expect.stringContaining('"purpose":"playlist_remove"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/music/playlists/playlist-1/items/music-1", expect.objectContaining({ method: "DELETE" }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/wallet/nonce", expect.objectContaining({
      body: expect.stringContaining('"purpose":"playlist_reorder"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(6, "/api/music/playlists/playlist-1/reorder", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"publication_ids":["music-2","music-1"]'),
    }));
  });

  it("loads public playlist details with ordered tracks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "playlist-1",
      owner_wallet: "0x1111111111111111111111111111111111111111",
      owner: "0x1111...1111",
      title: "Night Set",
      description: "Two tracks",
      is_public: true,
      is_owner: false,
      artwork_url: "/api/music/playlists/playlist-1/cover.svg",
      artwork_tiles: [
        "/api/music/publications/music-1/cover.svg",
        "/api/music/publications/music-2/cover.svg",
      ],
      track_count: 2,
      duration: 120,
      publications: [{ id: "music-1", title: "First", creator: "0x1111...1111" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const playlist = await fetchMusicPlaylist("playlist-1");

    expect(playlist.title).toBe("Night Set");
    expect(playlist.publications[0].title).toBe("First");
    expect(playlist.artwork_url).toBe("/api/music/playlists/playlist-1/cover.svg");
    expect(playlist.artwork_tiles).toEqual([
      "/api/music/publications/music-1/cover.svg",
      "/api/music/publications/music-2/cover.svg",
    ]);
  });

  it("uses signed access when a playlist is private to the connected wallet", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nonce: "nonce-1",
        message: "Sign playlist access",
        issued_at: "2026-08-31T00:00:00Z",
        expires_at: "2026-08-31T00:05:00Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "playlist-private",
        owner_wallet: TEST_WALLET,
        owner: "0x1111...1111",
        title: "Private Mix",
        is_public: false,
        is_owner: true,
        artwork_url: "",
        artwork_tiles: ["/api/music/publications/music-1/cover.svg"],
        track_count: 1,
        publications: [{ id: "music-1", title: "Saved Track", creator: "0x1111...1111" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const playlist = await fetchMusicPlaylist("playlist-private", TEST_WALLET);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"playlist_read"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/music/playlists/playlist-private/access", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
    expect(playlist.is_owner).toBe(true);
    expect(playlist.artwork_tiles).toEqual(["/api/music/publications/music-1/cover.svg"]);
    expect(playlist.publications[0].id).toBe("music-1");
  });

  it("loads creator music and public playlists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      wallet: "0x1111111111111111111111111111111111111111",
      display_name: "0x1111...1111",
      track_count: 1,
      play_count: 9,
      like_count: 4,
      sort: "popular",
      publications: [{ id: "music-1", title: "Creator Track", creator: "0x1111...1111" }],
      playlists: [{ id: "playlist-1", title: "Public Mix", track_count: 1 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const creator = await fetchMusicCreator("0x1111111111111111111111111111111111111111", { sort: "popular" });

    expect(creator.track_count).toBe(1);
    expect(creator.publications[0].title).toBe("Creator Track");
    expect(creator.playlists[0].title).toBe("Public Mix");
  });

  it("loads personalized creator music with a signed wallet read", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nonce: "nonce-1",
        message: "Sign creator access",
        issued_at: "2026-08-31T00:00:00Z",
        expires_at: "2026-08-31T00:05:00Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        wallet: TEST_WALLET,
        display_name: "0x1111...1111",
        track_count: 1,
        play_count: 9,
        like_count: 4,
        sort: "newest",
        publications: [{ id: "music-1", title: "Creator Track", creator: "0x1111...1111", saved_by_me: true }],
        playlists: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const creator = await fetchMusicCreator(TEST_WALLET, { viewerWallet: TEST_WALLET });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/wallet/nonce", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"purpose":"music_library_read"'),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/music/creator/${TEST_WALLET}`, expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"signature":"0xsigned"'),
    }));
    expect(creator.publications[0].saved_by_me).toBe(true);
  });
});
