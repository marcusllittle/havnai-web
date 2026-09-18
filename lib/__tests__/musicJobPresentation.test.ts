import { describe, expect, it } from "vitest";
import { formatMusicDuration, musicJobError, musicJobTitle, musicStageLabel } from "../musicJobPresentation";
import type { MusicJob } from "../musicStudioApi";

function job(overrides: Partial<MusicJob> = {}): MusicJob {
  return {
    id: "job-1",
    type: "text_to_music",
    status: "queued",
    stage: "queued",
    progress: 0,
    model: "ace_step_1_5_turbo",
    resolved_spec: { parameters: { prompt: "neon rain over an empty highway" } },
    artifacts: [],
    ...overrides,
  };
}

describe("music job presentation", () => {
  it("maps infrastructure stages to product language", () => {
    expect(musicStageLabel(job({ status: "leased", stage: "leased" }))).toBe("Preparing");
    expect(musicStageLabel(job({ status: "running", stage: "generation" }))).toBe("Creating");
    expect(musicStageLabel(job({ status: "uploading", stage: "uploading" }))).toBe("Finishing");
    expect(musicStageLabel(job({ status: "succeeded", stage: "succeeded" }))).toBe("Ready");
  });

  it("builds a useful title and time label", () => {
    expect(musicJobTitle(job())).toBe("Neon Rain Over An Empty Highway");
    expect(formatMusicDuration(91)).toBe("1:31");
  });

  it("identifies a completed job with a missing audio artifact", () => {
    expect(musicJobError(job({ status: "succeeded" }))).toContain("audio file is unavailable");
  });
});
