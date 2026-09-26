import { describe, expect, it } from "vitest";
import { musicJobRequest } from "../musicStudioApi";
import {
  availableModes,
  musicFormBlocker,
  restoreMusicForm,
  DEFAULT_MUSIC_FORM,
  type MusicFormState,
} from "../musicStudioState";

function form(overrides: Partial<MusicFormState> = {}): MusicFormState {
  return { ...DEFAULT_MUSIC_FORM, model: "ace_step_1_5_base", prompt: "a song", ...overrides };
}

describe("availableModes", () => {
  it("offers only the modes the checkpoint reports", () => {
    expect(availableModes(["text_to_music", "cover", "repaint"])).toEqual(["create", "remix", "repaint"]);
  });

  it("offers the stem modes when the base checkpoint is online", () => {
    expect(availableModes(["text_to_music", "cover", "repaint", "extract", "lego", "complete"])).toEqual([
      "create",
      "remix",
      "repaint",
      "extract",
      "layer",
      "arrange",
    ]);
  });

  it("falls back to create when capabilities are unknown", () => {
    expect(availableModes(undefined)).toEqual(["create"]);
    expect(availableModes([])).toEqual(["create"]);
  });
});

describe("musicFormBlocker", () => {
  it("passes a complete create form", () => {
    expect(musicFormBlocker(form(), false)).toBeNull();
  });

  it("blocks when no model is online", () => {
    expect(musicFormBlocker(form({ model: "" }), false)).toMatch(/no music model/i);
  });

  it("blocks editing modes until a source track is attached", () => {
    expect(musicFormBlocker(form({ mode: "remix" }), false)).toMatch(/work from/i);
    expect(musicFormBlocker(form({ mode: "remix" }), true)).toBeNull();
  });

  it("does not demand a prompt for stem modes", () => {
    expect(musicFormBlocker(form({ mode: "extract", prompt: "" }), true)).toBeNull();
  });

  it("still demands a prompt for create", () => {
    expect(musicFormBlocker(form({ prompt: "   " }), false)).toMatch(/describe/i);
  });

  it("requires at least one part for arrange", () => {
    expect(musicFormBlocker(form({ mode: "arrange", trackClasses: [] }), true)).toMatch(/part/i);
    expect(musicFormBlocker(form({ mode: "arrange", trackClasses: ["bass"] }), true)).toBeNull();
  });

  it("rejects a repaint range that ends before it starts", () => {
    expect(
      musicFormBlocker(form({ mode: "repaint", repaintStart: "40", repaintEnd: "20" }), true)
    ).toMatch(/after the start/i);
  });

  it("accepts an open-ended repaint range", () => {
    expect(
      musicFormBlocker(form({ mode: "repaint", repaintStart: "40", repaintEnd: "" }), true)
    ).toBeNull();
  });
});

describe("musicJobRequest", () => {
  it("sends the create contract without edit-only fields", () => {
    const body = musicJobRequest(form({ batchSize: 4 }), { wallet: "0xabc" });
    expect(body).toMatchObject({
      type: "text_to_music",
      mode: "create",
      model: "ace_step_1_5_base",
      batch_size: 4,
      wallet: "0xabc",
    });
    expect(body).not.toHaveProperty("audio_asset_id");
    expect(body).not.toHaveProperty("track_name");
    expect(body).not.toHaveProperty("repainting_start");
  });

  it("attaches the source asset for editing modes only", () => {
    expect(musicJobRequest(form({ mode: "remix" }), { audioAssetId: "asset-1" })).toMatchObject({
      mode: "remix",
      audio_asset_id: "asset-1",
      audio_cover_strength: 0.6,
    });
    expect(musicJobRequest(form({ mode: "create" }), { audioAssetId: "asset-1" })).not.toHaveProperty(
      "audio_asset_id"
    );
  });

  it("maps a blank repaint end onto the engine's open-ended sentinel", () => {
    const body = musicJobRequest(
      form({ mode: "repaint", repaintStart: "30", repaintEnd: "" }),
      { audioAssetId: "asset-2" }
    );
    expect(body.repainting_start).toBe(30);
    expect(body.repainting_end).toBe(-1);
  });

  it("sends the track name for stem modes and track classes for arrange", () => {
    expect(
      musicJobRequest(form({ mode: "extract", trackName: "drums" }), { audioAssetId: "a" })
    ).toMatchObject({ track_name: "drums" });
    expect(
      musicJobRequest(form({ mode: "arrange", trackClasses: ["bass", "strings"] }), { audioAssetId: "a" })
    ).toMatchObject({ track_classes: ["bass", "strings"] });
  });

  it("drops lyrics when the track is instrumental", () => {
    expect(musicJobRequest(form({ instrumental: true, lyrics: "la la" }))).toMatchObject({ lyrics: "" });
  });

  it("omits blank optional tuning rather than sending empty strings", () => {
    const body = musicJobRequest(form({ bpm: "", key: "", seed: "", inferenceSteps: "" }));
    expect(body).not.toHaveProperty("bpm");
    expect(body).not.toHaveProperty("key");
    expect(body).not.toHaveProperty("seed");
    expect(body).not.toHaveProperty("inference_steps");
  });
});

describe("restoreMusicForm compatibility", () => {
  it("loads a draft saved before modes existed", () => {
    const legacy = JSON.stringify({
      prompt: "late night jazz",
      style: "smoky trio",
      lyrics: "verse one",
      instrumental: false,
      duration: 90,
      bpm: "88",
      key: "F Minor",
      seed: "12",
    });
    expect(restoreMusicForm(legacy)).toMatchObject({
      mode: "create",
      prompt: "late night jazz",
      lyrics: "verse one",
      duration: 90,
      batchSize: 1,
    });
  });

  it("discards a mode or track name it no longer recognises", () => {
    const restored = restoreMusicForm(
      JSON.stringify({ mode: "stemify", trackName: "kazoo", trackClasses: ["bass", "kazoo"] })
    );
    expect(restored.mode).toBe("create");
    expect(restored.trackName).toBe("vocals");
    expect(restored.trackClasses).toEqual(["bass"]);
  });
});
