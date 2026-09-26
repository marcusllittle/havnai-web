import * as legacy from "./havnai";

export type MusicAccountRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
type PlaylistInput = { title: string; description?: string; is_public?: boolean };
type PendingPlaylist = PlaylistInput & { id: string };
const intentKey = (accountId: string) => `havnai.account-playlist-create.v1:${accountId}`;

export function pendingPlaylist(storage: Storage, accountId: string): PendingPlaylist | null {
  const raw = storage.getItem(intentKey(accountId));
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingPlaylist;
  if (!/^playlist-[a-f0-9-]{36}$/.test(value.id) || typeof value.title !== "string") {
    throw new Error("Your pending playlist request could not be read.");
  }
  return value;
}

export function accountMusicClient(accountId: string, request: MusicAccountRequest, getSignal: () => AbortSignal, getStorage: () => Storage) {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const signal = getSignal();
    signal.throwIfAborted();
    const result = await request<T>(path, { ...init, signal });
    signal.throwIfAborted();
    return result;
  }
  const playlistPath = (id: string) => `/v2/music/playlists/${encodeURIComponent(id)}`;
  async function playlist(path: string, init?: RequestInit) {
    return legacy.normalizeMusicPlaylist(await call<legacy.MusicPlaylist>(path, init));
  }
  async function personalize(publications: legacy.MusicPublication[]) {
    if (!publications.length) return publications;
    const result = await call<{ preferences: Record<string, Pick<legacy.MusicPublication, "liked_by_me" | "saved_by_me" | "like_count">> }>("/v2/music/preferences", {
      method: "POST", body: JSON.stringify({ publication_ids: publications.map(item => item.id) }),
    });
    return publications.map(item => ({ ...item, ...result.preferences[item.id] }));
  }
  return {
    personalize,
    fetchMusicLibrary: async (opts: Parameters<typeof legacy.fetchMusicLibrary>[0]) => {
      const params = new URLSearchParams();
      for (const key of ["limit", "offset", "search"] as const) if (opts[key] !== undefined) params.set(key, String(opts[key]));
      const result = await call<legacy.MusicLibraryResponse>(`/v2/music/library?${params}`);
      return { ...result, publications: result.publications.map(legacy.normalizeMusicPublication),
        recent_liked: result.recent_liked.map(legacy.normalizeMusicPublication), playlists: result.playlists.map(legacy.normalizeMusicPlaylist) };
    },
    fetchMyMusicPlaylists: async (_wallet?: string) => {
      const result = await call<{ playlists: legacy.MusicPlaylist[] }>("/v2/music/playlists");
      return result.playlists.map(legacy.normalizeMusicPlaylist);
    },
    fetchMusicPlaylist: (id: string, _wallet?: string | null) => playlist(playlistPath(id)),
    createMusicPlaylist: async (input: PlaylistInput & { wallet?: string }) => {
      const storage = getStorage();
      const body: PlaylistInput = { title: input.title.trim(), description: input.description || "", is_public: input.is_public || false };
      if (!body.title || body.title.length > 120 || (body.description?.length || 0) > 1000) {
        throw new Error("Use a playlist name of 1–120 characters and a description of at most 1,000 characters.");
      }
      let pending = pendingPlaylist(storage, accountId);
      if (pending && (pending.title !== body.title || pending.description !== body.description || pending.is_public !== body.is_public)) {
        throw new Error(`Finish creating “${pending.title}” before starting another playlist.`);
      }
      if (!pending) {
        pending = { ...body, id: `playlist-${crypto.randomUUID()}` };
        storage.setItem(intentKey(accountId), JSON.stringify(pending));
      }
      // Keep the intent until the complete UI action succeeds (including adding a song).
      const result = await playlist("/v2/music/playlists", { method: "POST", body: JSON.stringify(pending) });
      if (result.id !== pending.id || !result.is_owner) throw new Error("Could not confirm this playlist. Retry the original request.");
      return result;
    },
    finishPlaylistCreation: (id: string) => {
      getSignal().throwIfAborted();
      const storage = getStorage();
      if (pendingPlaylist(storage, accountId)?.id === id) storage.removeItem(intentKey(accountId));
    },
    updateMusicPlaylist: (id: string, input: Parameters<typeof legacy.updateMusicPlaylist>[1]) => {
      const { wallet: _wallet, ...body } = input;
      return playlist(playlistPath(id), { method: "PATCH", body: JSON.stringify(body) });
    },
    deleteMusicPlaylist: (id: string, _wallet?: string) => call<{ ok: boolean }>(playlistPath(id), { method: "DELETE" }),
    addMusicPlaylistItem: (id: string, publication: string, _wallet?: string) => playlist(`${playlistPath(id)}/items/${encodeURIComponent(publication)}`, { method: "PUT" }),
    removeMusicPlaylistItem: (id: string, publication: string, _wallet?: string) => playlist(`${playlistPath(id)}/items/${encodeURIComponent(publication)}`, { method: "DELETE" }),
    reorderMusicPlaylistItems: (id: string, publications: string[], _wallet?: string) => playlist(`${playlistPath(id)}/reorder`, { method: "PUT", body: JSON.stringify({ publication_ids: publications }) }),
    setMusicPublicationLike: (id: string, liked: boolean, _wallet?: string) => call<{ ok: boolean; liked: boolean; like_count: number }>(`/v2/music/publications/${encodeURIComponent(id)}/like`, { method: "PUT", body: JSON.stringify({ liked }) }),
    setMusicPublicationSaved: (id: string, saved: boolean, _wallet?: string) => call<{ ok: boolean; saved: boolean }>(`/v2/music/publications/${encodeURIComponent(id)}/save`, { method: "PUT", body: JSON.stringify({ saved }) }),
  };
}
