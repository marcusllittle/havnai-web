import { afterEach, describe, expect, it, vi } from "vitest";
import { createMusicJob, musicMediaUrl } from "../musicStudioApi";

describe("music studio API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("submits the text_to_music contract and studio credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "job-1",
      type: "text_to_music",
      status: "queued",
      stage: "queued",
      progress: 0,
      model: "ace_step_1_5_turbo",
      resolved_spec: {},
      artifacts: [],
    }), { status: 202, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await createMusicJob({
      model: "ace_step_1_5_turbo",
      prompt: "sunrise house track",
      style: "deep house",
      lyrics: "",
      instrumental: true,
      duration: 60,
      bpm: 122,
      key: "C Minor",
      seed: 9,
    }, "studio-secret");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/owner/v1/jobs");
    expect((init.headers as Headers).get("X-HavnAI-Studio-Key")).toBe("studio-secret");
    expect(JSON.parse(init.body)).toMatchObject({ type: "text_to_music", instrumental: true, bpm: 122 });
  });

  it("routes coordinator artifact paths through the local API proxy", () => {
    expect(musicMediaUrl("/static/outputs/audio/job-1.mp3")).toBe("/api/static/outputs/audio/job-1.mp3");
    expect(musicMediaUrl("https://cdn.example/song.mp3")).toBe("https://cdn.example/song.mp3");
  });
});
