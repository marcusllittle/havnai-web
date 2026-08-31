import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMusicDiscover, recordMusicPublicationPlay } from "../havnai";

describe("music discover API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads public music publications and resolves media URLs through the API proxy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publications: [{
        id: "music-1",
        job_id: "job-1",
        audio_artifact_id: "artifact-1",
        creator_wallet: "0x1111111111111111111111111111111111111111",
        creator: "0x1111...1111",
        title: "Neon Coast",
        style: "Dream pop",
        tags: ["Dream pop"],
        duration: 90,
        model: "ace_step_1_5_turbo",
        cover_art_seed: "abc",
        cover_art_url: "/api/music/publications/music-1/cover.svg",
        audio_url: "/static/outputs/artifacts/job-1/song.mp3",
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
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const response = await fetchMusicDiscover({ sort: "popular", wallet: "0x1111111111111111111111111111111111111111" });

    expect(response.publications[0].audio_url).toBe("/api/static/outputs/artifacts/job-1/song.mp3");
    expect(response.publications[0].cover_art_url).toBe("/api/music/publications/music-1/cover.svg");
    expect(response.publications[0].liked_by_me).toBe(true);
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
});
