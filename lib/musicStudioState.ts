export interface MusicFormState {
  prompt: string;
  style: string;
  lyrics: string;
  instrumental: boolean;
  duration: number;
  bpm: string;
  key: string;
  seed: string;
}

export const DEFAULT_MUSIC_FORM: MusicFormState = {
  prompt: "",
  style: "",
  lyrics: "",
  instrumental: false,
  duration: 60,
  bpm: "",
  key: "",
  seed: "",
};

export function restoreMusicForm(raw: string | null): MusicFormState {
  if (!raw) return DEFAULT_MUSIC_FORM;
  try {
    const parsed = JSON.parse(raw) as Partial<MusicFormState>;
    const duration = Number(parsed.duration);
    return {
      prompt: String(parsed.prompt || ""),
      style: String(parsed.style || ""),
      lyrics: String(parsed.lyrics || ""),
      instrumental: parsed.instrumental === true,
      duration: [30, 60, 90, 120, 180].includes(duration) ? duration : 60,
      bpm: String(parsed.bpm || ""),
      key: String(parsed.key || ""),
      seed: String(parsed.seed || ""),
    };
  } catch {
    return DEFAULT_MUSIC_FORM;
  }
}
