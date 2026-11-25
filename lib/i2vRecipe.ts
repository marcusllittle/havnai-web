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

export type StudioAspect = "9:16" | "16:9";
export type StudioPreset = "fast_upscaled" | "native_quality";

export interface StudioClipSettings {
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
  guidance?: number;
}

/**
 * Sizes the LTX worker treats as native 720p. 720 is not divisible by 32, so the
 * request uses 704; the worker maps these exact pairs to 720x1280 and 1280x720.
 */
export function ltxNativeSize(aspect: StudioAspect): FrameSize {
  return aspect === "16:9" ? { width: 1280, height: 704 } : { width: 704, height: 1280 };
}

export function orientFrame(base: FrameSize, aspect: StudioAspect): FrameSize {
  const landscape = base.width > base.height;
  if (landscape === (aspect === "16:9")) return base;
  return { width: base.height, height: base.width };
}

/**
 * Wan 2.2's worker snaps every non-720p request onto the same measured 480p
 * frames, and 720p is not a supported default. Both quality choices therefore
 * resolve to one clip. LTX accepts a separate native size.
 */
export function qualityModesDistinct(model: { id?: string; pipeline?: string; model_family?: string } | null | undefined): boolean {
  return !isWan22Model(model);
}

export const WAN_SINGLE_QUALITY_HINT =
  "Wan 2.2 uses one measured clip: 480p and 4 steps. Native Quality is not available for this model.";

export function studioClipSettings(
  model: { id?: string; pipeline?: string; model_family?: string } | null | undefined,
  aspect: StudioAspect,
  durationSeconds: number,
  source: FrameSize,
  preset: StudioPreset,
): StudioClipSettings {
  if (isWan22Model(model)) {
    const size = orientFrame(wanSize(source.width, source.height), aspect);
    return {
      width: size.width,
      height: size.height,
      frames: wanFrames(durationSeconds),
      fps: WAN22_CLIP.fps,
      steps: WAN22_CLIP.steps,
      guidance: WAN22_CLIP.guidance,
    };
  }
  if (isLtx23Model(model)) {
    const size = preset === "native_quality"
      ? ltxNativeSize(aspect)
      : orientFrame(ltxSize(source.width, source.height), aspect);
    return {
      width: size.width,
      height: size.height,
      frames: durationSeconds >= LTX23_CLIP.durationSeconds ? LTX23_CLIP.frames : durationSeconds * LTX23_CLIP.fps + 1,
      fps: LTX23_CLIP.fps,
      steps: LTX23_CLIP.steps,
      guidance: LTX23_CLIP.guidance,
    };
  }
  return {};
}

export interface StudioAudioModel {
  id?: string;
  pipeline?: string;
  model_family?: string;
  capabilities?: string[];
  declared_capabilities?: string[];
  video_defaults?: { audio?: boolean };
}

export function modelGeneratesAudio(model: StudioAudioModel | null | undefined): boolean {
  if (!model) return false;
  const names = [...(model.capabilities || []), ...(model.declared_capabilities || [])];
  return names.includes("native_audio") || model.video_defaults?.audio === true;
}

export function modelAudioNotice(model: StudioAudioModel | null | undefined, audioFileSelected: boolean): string | null {
  if (!model || modelGeneratesAudio(model)) return null;
  if (audioFileSelected) {
    return "This model does not generate audio. If you add a track, the finished clip will not say whether it was included.";
  }
  return "This model does not generate audio. The clip will not include a soundtrack.";
}

function specParameters(spec: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const parameters = spec?.parameters;
  return parameters && typeof parameters === "object" ? parameters as Record<string, unknown> : undefined;
}

export function resultAudioNotice(job: {
  resolved_spec?: Record<string, unknown>;
  artifacts?: Array<{ kind?: string; metadata?: { metrics?: { native_audio?: unknown } } }>;
} | null | undefined): string | null {
  if (!job) return null;
  const parameters = specParameters(job.resolved_spec);
  let applied: boolean | null = typeof parameters?.native_audio === "boolean" ? parameters.native_audio : null;
  if (applied === null) {
    for (const artifact of job.artifacts || []) {
      const value = artifact.metadata?.metrics?.native_audio;
      if (typeof value === "boolean") {
        applied = value;
        break;
      }
      if (artifact.kind === "audio") {
        applied = true;
        break;
      }
    }
  }
  if (applied !== false) return null;
  const requested = Boolean(parameters?.audio_asset_id) || parameters?.audio === true;
  return requested
    ? "Audio was requested, but this clip does not include it."
    : "This clip does not include audio.";
}

export function videoWaitSeconds(model: { pipeline?: string; model_family?: string; id?: string } | null | undefined): number {
  if (isWan22Model(model)) return 90 * 60;
  if (isLtx23Model(model)) return 60 * 60;
  return 40 * 60;
}
