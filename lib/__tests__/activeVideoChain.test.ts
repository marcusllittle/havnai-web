import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_VIDEO_CHAIN_KEY,
  ACTIVE_VIDEO_CHAIN_MAX_AGE_MS,
  clearActiveVideoChain,
  loadActiveVideoChain,
  saveActiveVideoChain,
  shouldPrepareNextVideoClip,
} from "../activeVideoChain";

const chain = {
  prompt: "continuous camera move",
  total: 7,
  currentIndex: 2,
  currentJobId: "job-current",
  completedJobIds: ["job-one", "job-two"],
  autoStitch: true,
  request: {
    prompt: "continuous camera move",
    model: "ltx23_wangp_distilled",
    frames: 97,
    fps: 24,
  },
  startedAt: 1_000,
};

describe("active video chain persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("restores an in-progress chain", () => {
    saveActiveVideoChain(chain);
    expect(loadActiveVideoChain(2_000)).toEqual(chain);
  });

  it("restores the gap between completed and next clip submission", () => {
    const betweenClips = {
      ...chain,
      currentIndex: 2,
      currentJobId: undefined,
    };
    saveActiveVideoChain(betweenClips);
    expect(loadActiveVideoChain(2_000)).toEqual(betweenClips);
  });

  it("removes expired or malformed chains", () => {
    window.localStorage.setItem(
      ACTIVE_VIDEO_CHAIN_KEY,
      JSON.stringify({ ...chain, currentJobId: "bad-id" })
    );
    expect(loadActiveVideoChain(2_000)).toBeNull();

    saveActiveVideoChain(chain);
    expect(loadActiveVideoChain(1_000 + ACTIVE_VIDEO_CHAIN_MAX_AGE_MS + 1)).toBeNull();
  });

  it("clears a completed chain", () => {
    saveActiveVideoChain(chain);
    clearActiveVideoChain();
    expect(loadActiveVideoChain()).toBeNull();
  });

  it("only prepares a continuation frame when another clip remains", () => {
    expect(shouldPrepareNextVideoClip(0, 2)).toBe(true);
    expect(shouldPrepareNextVideoClip(1, 2)).toBe(false);
    expect(shouldPrepareNextVideoClip(2, 3)).toBe(false);
  });
});
