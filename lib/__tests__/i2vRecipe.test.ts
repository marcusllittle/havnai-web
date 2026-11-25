import { describe, expect, it } from "vitest";
import {
  ltxSize,
  modelAudioNotice,
  modelGeneratesAudio,
  qualityModesDistinct,
  resultAudioNotice,
  studioClipSettings,
  wanFrames,
  wanSize,
} from "../i2vRecipe";

const wan = { id: "wan22-i2v-a14b", pipeline: "wan22-i2v", model_family: "wan22_i2v" };
const ltx = {
  id: "ltx23_wangp_distilled",
  pipeline: "ltx23_wangp",
  model_family: "ltx23_wangp",
  declared_capabilities: ["image_to_video", "native_audio"],
  video_defaults: { audio: true },
};

describe("image-to-video recipe", () => {
  it("picks a Wan frame from the source aspect", () => {
    expect(wanSize(480, 832)).toEqual({ width: 480, height: 832 });
    expect(wanSize(480, 700)).toEqual({ width: 480, height: 704 });
    expect(wanSize(832, 480)).toEqual({ width: 832, height: 480 });
    expect(wanSize()).toEqual({ width: 480, height: 832 });
  });

  it("maps Wan duration to the measured frame counts", () => {
    expect(wanFrames(8)).toBe(129);
    expect(wanFrames(5)).toBe(81);
    expect(wanFrames(3)).toBe(49);
  });

  it("picks an LTX frame from the source aspect", () => {
    expect(ltxSize()).toEqual({ width: 448, height: 832 });
    expect(ltxSize(1280, 720)).toEqual({ width: 832, height: 448 });
  });

  it("keeps Wan on one measured clip and gives LTX a separate native size", () => {
    const source = { width: 0, height: 0 };
    const wanFast = studioClipSettings(wan, "9:16", 8, source, "fast_upscaled");
    const wanNative = studioClipSettings(wan, "9:16", 8, source, "native_quality");
    expect(qualityModesDistinct(wan)).toBe(false);
    expect(wanFast).toEqual(wanNative);
    expect(wanFast).toEqual({ width: 480, height: 832, frames: 129, fps: 16, steps: 4, guidance: 1 });
    expect(studioClipSettings(wan, "16:9", 8, source, "fast_upscaled")).toEqual({
      width: 832, height: 480, frames: 129, fps: 16, steps: 4, guidance: 1,
    });

    const ltxFast = studioClipSettings(ltx, "16:9", 9, { width: 1280, height: 720 }, "fast_upscaled");
    const ltxNative = studioClipSettings(ltx, "16:9", 9, { width: 1280, height: 720 }, "native_quality");
    expect(qualityModesDistinct(ltx)).toBe(true);
    expect(ltxFast).toEqual({ width: 832, height: 448, frames: 217, fps: 24, steps: 8, guidance: 1 });
    expect(ltxNative).toEqual({ width: 1280, height: 704, frames: 217, fps: 24, steps: 8, guidance: 1 });
    expect(studioClipSettings(ltx, "9:16", 9, source, "native_quality")).toMatchObject({ width: 704, height: 1280, steps: 8 });
    expect(studioClipSettings(ltx, "9:16", 9, source, "fast_upscaled")).toMatchObject({ width: 448, height: 832, steps: 8 });
    expect(studioClipSettings({ id: "video-test" }, "16:9", 8, source, "native_quality")).toEqual({});
  });

  it("warns when a model cannot generate audio and when a finished clip left it out", () => {
    expect(modelGeneratesAudio(ltx)).toBe(true);
    expect(modelGeneratesAudio(wan)).toBe(false);
    expect(modelGeneratesAudio({ ...wan, video_defaults: { audio: true } })).toBe(true);
    expect(modelAudioNotice(wan, false)).toContain("does not generate audio");
    expect(modelAudioNotice(wan, true)).toContain("will not say whether it was included");
    expect(modelAudioNotice(ltx, true)).toBeNull();
    expect(resultAudioNotice({
      resolved_spec: { parameters: { audio_asset_id: "track-1" } },
      artifacts: [{ kind: "video", metadata: { metrics: { native_audio: false } } }],
    })).toContain("does not include it");
    expect(resultAudioNotice({
      resolved_spec: { parameters: { audio: true } },
      artifacts: [{ kind: "video", metadata: { metrics: { native_audio: false } } }],
    })).toContain("does not include it");
    expect(resultAudioNotice({
      resolved_spec: {},
      artifacts: [{ kind: "video", metadata: { metrics: { native_audio: false } } }],
    })).toBe("This clip does not include audio.");
    expect(resultAudioNotice({
      resolved_spec: { parameters: { audio_asset_id: "track-1" } },
      artifacts: [{ kind: "video", metadata: { metrics: { native_audio: true } } }],
    })).toBeNull();
    expect(resultAudioNotice({ resolved_spec: { parameters: { audio_asset_id: "track-1" } }, artifacts: [] })).toBeNull();
  });
});
