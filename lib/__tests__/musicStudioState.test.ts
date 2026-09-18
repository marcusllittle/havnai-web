import { describe, expect, it } from "vitest";
import { DEFAULT_MUSIC_FORM, restoreMusicForm } from "../musicStudioState";

describe("restoreMusicForm", () => {
  it("restores supported creation settings", () => {
    expect(restoreMusicForm(JSON.stringify({
      prompt: "late night jazz",
      style: "smoky trio",
      lyrics: "",
      instrumental: true,
      duration: 90,
      bpm: "88",
      key: "F Minor",
      seed: "12",
    }))).toEqual({
      prompt: "late night jazz",
      style: "smoky trio",
      lyrics: "",
      instrumental: true,
      duration: 90,
      bpm: "88",
      key: "F Minor",
      seed: "12",
    });
  });

  it("falls back safely for corrupt or unsupported values", () => {
    expect(restoreMusicForm("not-json")).toEqual(DEFAULT_MUSIC_FORM);
    expect(restoreMusicForm(JSON.stringify({ duration: 17 }))).toMatchObject({ duration: 60 });
  });
});
