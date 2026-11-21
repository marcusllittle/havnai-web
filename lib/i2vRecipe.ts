/** Measured image-to-video settings from the RTX 3060, November 20-21. */

export type FrameSize = { width: number; height: number };

export function isWan22Model(model: { id?: string; pipeline?: string; model_family?: string } | null | undefined): boolean {
  const pipeline = String(model?.pipeline || "").toLowerCase();
  const family = String(model?.model_family || "").toLowerCase();
  const id = String(model?.id || "").toLowerCase();
  return pipeline === "wan22-i2v" || family === "wan22_i2v" || id === "wan22-i2v-a14b";
}

export function isLtx23Model(model: { id?: string; pipeline?: string; model_family?: string } | null | undefined): boolean {
  const pipeline = String(model?.pipeline || "").toLowerCase();
  const family = String(model?.model_family || "").toLowerCase();
  const id = String(model?.id || "").toLowerCase();
  return pipeline === "ltx23_wangp" || family === "ltx23_wangp" || id === "ltx23_wangp_distilled";
}

export function wanSize(sourceWidth = 0, sourceHeight = 0): FrameSize {
  if (!(sourceWidth > 0 && sourceHeight > 0)) return { width: 480, height: 832 };
  const portrait = sourceHeight >= sourceWidth;
  const ratio = portrait ? sourceWidth / sourceHeight : sourceHeight / sourceWidth;
  const tall = Math.abs(ratio - 480 / 832) <= Math.abs(ratio - 480 / 704);
  const frame = tall ? { width: 480, height: 832 } : { width: 480, height: 704 };
  return portrait ? frame : { width: frame.height, height: frame.width };
}

export function wanFrames(seconds: number): number {
  if (seconds >= 8) return 129;
  if (seconds >= 5) return 81;
  return 49;
}

export function ltxSize(sourceWidth = 0, sourceHeight = 0): FrameSize {
  if (sourceWidth > sourceHeight && sourceWidth > 0) return { width: 832, height: 448 };
  return { width: 448, height: 832 };
}

export const LTX23_CLIP = { frames: 217, fps: 24, steps: 8, guidance: 1, durationSeconds: 9 } as const;
export const WAN22_CLIP = { fps: 16, steps: 4, guidance: 1, flowShift: 5, durationSeconds: 8 } as const;

export function videoWaitSeconds(model: { pipeline?: string; model_family?: string; id?: string } | null | undefined): number {
  if (isWan22Model(model)) return 90 * 60;
  if (isLtx23Model(model)) return 60 * 60;
  return 40 * 60;
}
