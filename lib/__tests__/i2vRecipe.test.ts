import { describe, expect, it } from "vitest";
import { ltxSize, wanFrames, wanSize } from "../i2vRecipe";

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
});
