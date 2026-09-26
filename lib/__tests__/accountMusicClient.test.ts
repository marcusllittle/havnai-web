import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accountMusicClient, pendingPlaylist } from "../accountMusicClient";

let controller: AbortController;
const request = vi.fn();
const client = (id = "alice") => accountMusicClient(id, request, () => controller.signal, () => sessionStorage);
beforeEach(() => { sessionStorage.clear(); request.mockReset(); controller = new AbortController(); });
afterEach(() => vi.restoreAllMocks());

it("retains a playlist ID across ambiguous creation and membership failures, and isolates accounts", async () => {
  request.mockRejectedValueOnce(new Error("Lost response"));
  await expect(client().createMusicPlaylist({ title: "Saved mix", wallet: "must-not-leak" })).rejects.toThrow("Lost response");
  const pending = pendingPlaylist(sessionStorage, "alice")!;
  expect(pending.id).toMatch(/^playlist-/);
  expect(pendingPlaylist(sessionStorage, "bob")).toBeNull();
  expect(JSON.parse(request.mock.calls[0][1].body)).not.toHaveProperty("wallet");
  await expect(client().createMusicPlaylist({ title: "Different mix" })).rejects.toThrow("Finish creating");
  request.mockResolvedValue({ ...pending, is_owner: true, publications: [] });
  await client().createMusicPlaylist({ title: "Saved mix" });
  expect(JSON.parse(request.mock.calls[1][1].body).id).toBe(pending.id);
  expect(pendingPlaylist(sessionStorage, "alice")).not.toBeNull();
  await client().addMusicPlaylistItem(pending.id, "song-one");
  client().finishPlaylistCreation(pending.id);
  expect(pendingPlaylist(sessionStorage, "alice")).toBeNull();
});

it("does not send any request when it cannot preserve the playlist intent", async () => {
  const blocked = accountMusicClient("alice", request, () => controller.signal, () => { throw new Error("Storage blocked"); });
  await expect(blocked.createMusicPlaylist({ title: "Mix" })).rejects.toThrow("Storage blocked");
  expect(request).not.toHaveBeenCalled();
});

it("rejects a late result after leaving the account view", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = client().fetchMusicPlaylist("private");
  controller.abort();
  finish({ id: "private", title: "Private title", publications: [] });
  await expect(pending).rejects.toThrow();
});

it("sends only intended metadata and explicit preference states", async () => {
  request.mockResolvedValue({ id: "playlist", publications: [] });
  await client().updateMusicPlaylist("playlist", { title: "New", wallet: "not-an-owner" });
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ title: "New" });
  await client().setMusicPublicationLike("song", false, "ignored");
  expect(request.mock.calls[1]).toEqual(["/v2/music/publications/song/like", expect.objectContaining({ method: "PUT", body: '{"liked":false}' })]);
  await client().removeMusicPlaylistItem("playlist", "song", "ignored");
  expect(request.mock.calls[2][1]).not.toHaveProperty("body");
});
