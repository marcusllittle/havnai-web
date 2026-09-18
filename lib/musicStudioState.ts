export const MUSIC_MODES = ["create", "remix", "repaint", "extract", "layer", "arrange"] as const;
export type MusicMode = (typeof MUSIC_MODES)[number];

/** Capability flag each mode needs from the selected checkpoint. */
export const MUSIC_MODE_CAPABILITY: Record<MusicMode, string> = {
  create: "text_to_music",
  remix: "cover",
  repaint: "repaint",
  extract: "extract",
  layer: "lego",
  arrange: "complete",
};

/** Modes that operate on a recording the creator supplies. */
export const MUSIC_MODES_NEEDING_SOURCE: ReadonlySet<MusicMode> = new Set<MusicMode>([
  "remix",
  "repaint",
  "extract",
  "layer",
  "arrange",
]);

/** Modes that act on exactly one named stem. */
export const MUSIC_MODES_NEEDING_TRACK: ReadonlySet<MusicMode> = new Set<MusicMode>(["extract", "layer"]);

export const MUSIC_TRACK_NAMES = [
  "vocals",
  "backing_vocals",
  "drums",
  "bass",
  "guitar",
  "keyboard",
  "percussion",
  "strings",
  "synth",
  "fx",
  "brass",
  "woodwinds",
] as const;
export type MusicTrackName = (typeof MUSIC_TRACK_NAMES)[number];

export const MUSIC_DURATIONS = [30, 60, 90, 120, 180, 240, 300, 420, 600] as const;
export const MUSIC_BATCH_SIZES = [1, 2, 4] as const;
export const MUSIC_AUDIO_FORMATS = ["mp3", "flac", "wav"] as const;
export const MUSIC_REPAINT_MODES = ["conservative", "balanced", "aggressive"] as const;

export const MUSIC_MODE_LABELS: Record<MusicMode, { title: string; blurb: string; cta: string }> = {
  create: { title: "Create", blurb: "Write a song from a description.", cta: "Create song" },
  remix: { title: "Remix", blurb: "Keep the structure, change the sound.", cta: "Remix track" },
  repaint: { title: "Repaint", blurb: "Regenerate one section, keep the rest.", cta: "Repaint section" },
  extract: { title: "Stems", blurb: "Pull a single track out of a mix.", cta: "Extract stem" },
  layer: { title: "Layer", blurb: "Add one instrument over your track.", cta: "Add layer" },
  arrange: { title: "Arrange", blurb: "Fill out a sparse take with more parts.", cta: "Arrange track" },
};

export function trackLabel(track: string): string {
  return track.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export interface MusicFormState {
  mode: MusicMode;
  model: string;
  prompt: string;
  style: string;
  lyrics: string;
  instrumental: boolean;
  duration: number;
  bpm: string;
  key: string;
  seed: string;
  batchSize: number;
  audioFormat: string;
  inferenceSteps: string;
  guidanceScale: string;
  /** Remix */
  coverStrength: number;
  /** Repaint, in seconds; end of -1 means "to the end of the track". */
  repaintStart: string;
  repaintEnd: string;
  repaintMode: string;
  /** Extract / Layer */
  trackName: MusicTrackName;
  /** Arrange */
  trackClasses: string[];
}

export const DEFAULT_MUSIC_FORM: MusicFormState = {
  mode: "create",
  model: "",
  prompt: "",
  style: "",
  lyrics: "",
  instrumental: false,
  duration: 60,
  bpm: "",
  key: "",
  seed: "",
  batchSize: 1,
  audioFormat: "mp3",
  inferenceSteps: "",
  guidanceScale: "",
  coverStrength: 0.6,
  repaintStart: "",
  repaintEnd: "",
  repaintMode: "balanced",
  trackName: "vocals",
  trackClasses: [],
};

function pickString(value: unknown, allowed: readonly string[], fallback: string): string {
  const candidate = String(value ?? "");
  return allowed.includes(candidate) ? candidate : fallback;
}

function pickNumber(value: unknown, allowed: readonly number[], fallback: number): number {
  const candidate = Number(value);
  return allowed.includes(candidate) ? candidate : fallback;
}

export function restoreMusicForm(raw: string | null): MusicFormState {
  if (!raw) return DEFAULT_MUSIC_FORM;
  try {
    const parsed = JSON.parse(raw) as Partial<MusicFormState>;
    const coverStrength = Number(parsed.coverStrength);
    const trackClasses = Array.isArray(parsed.trackClasses)
      ? parsed.trackClasses.filter((track): track is string =>
          typeof track === "string" && (MUSIC_TRACK_NAMES as readonly string[]).includes(track)
        )
      : [];
    return {
      mode: pickString(parsed.mode, MUSIC_MODES, "create") as MusicMode,
      model: String(parsed.model || ""),
      prompt: String(parsed.prompt || ""),
      style: String(parsed.style || ""),
      lyrics: String(parsed.lyrics || ""),
      instrumental: parsed.instrumental === true,
      duration: pickNumber(parsed.duration, MUSIC_DURATIONS, 60),
      bpm: String(parsed.bpm || ""),
      key: String(parsed.key || ""),
      seed: String(parsed.seed || ""),
      batchSize: pickNumber(parsed.batchSize, MUSIC_BATCH_SIZES, 1),
      audioFormat: pickString(parsed.audioFormat, MUSIC_AUDIO_FORMATS, "mp3"),
      inferenceSteps: String(parsed.inferenceSteps || ""),
      guidanceScale: String(parsed.guidanceScale || ""),
      coverStrength: Number.isFinite(coverStrength) && coverStrength >= 0 && coverStrength <= 1 ? coverStrength : 0.6,
      repaintStart: String(parsed.repaintStart || ""),
      repaintEnd: String(parsed.repaintEnd || ""),
      repaintMode: pickString(parsed.repaintMode, MUSIC_REPAINT_MODES, "balanced"),
      trackName: pickString(parsed.trackName, MUSIC_TRACK_NAMES, "vocals") as MusicTrackName,
      trackClasses,
    };
  } catch {
    return DEFAULT_MUSIC_FORM;
  }
}

/** A mode is offered only when the selected checkpoint reports the capability. */
export function availableModes(capabilities: readonly string[] | undefined): MusicMode[] {
  const declared = new Set(capabilities || []);
  if (!declared.size) return ["create"];
  return MUSIC_MODES.filter((mode) => declared.has(MUSIC_MODE_CAPABILITY[mode]));
}

/** Why the form cannot be submitted yet, or null when it is ready. */
export function musicFormBlocker(form: MusicFormState, hasSource: boolean): string | null {
  if (!form.model) return "No music model is online right now.";
  if (MUSIC_MODES_NEEDING_SOURCE.has(form.mode) && !hasSource) {
    return "Add the track you want to work from.";
  }
  const needsPrompt = form.mode === "create" || form.mode === "remix" || form.mode === "repaint";
  if (needsPrompt && !form.prompt.trim()) return "Describe what you want to hear.";
  if (form.mode === "arrange" && form.trackClasses.length === 0) {
    return "Pick at least one part to add.";
  }
  if (form.mode === "repaint") {
    const start = Number(form.repaintStart || 0);
    const end = form.repaintEnd === "" ? -1 : Number(form.repaintEnd);
    if (!Number.isFinite(start) || start < 0) return "Repaint start must be a positive time.";
    if (end !== -1 && (!Number.isFinite(end) || end <= start)) {
      return "Repaint end must come after the start.";
    }
  }
  return null;
}
