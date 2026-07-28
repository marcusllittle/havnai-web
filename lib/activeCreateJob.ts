export const ACTIVE_CREATE_JOB_KEY = "havnai_active_create_job_v1";
export const ACTIVE_CREATE_JOB_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type ActiveCreateJobMode = "image" | "face_swap" | "video";

export type ActiveCreateJob = {
  id: string;
  prompt: string;
  mode: ActiveCreateJobMode;
  startedAt: number;
};

const isActiveCreateJob = (value: unknown, now: number): value is ActiveCreateJob => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActiveCreateJob>;
  const validMode =
    candidate.mode === "image" ||
    candidate.mode === "face_swap" ||
    candidate.mode === "video";
  return (
    typeof candidate.id === "string" &&
    /^job-[A-Za-z0-9_-]+$/.test(candidate.id) &&
    typeof candidate.prompt === "string" &&
    validMode &&
    typeof candidate.startedAt === "number" &&
    Number.isFinite(candidate.startedAt) &&
    candidate.startedAt <= now + 60_000 &&
    now - candidate.startedAt <= ACTIVE_CREATE_JOB_MAX_AGE_MS
  );
};

export const saveActiveCreateJob = (job: ActiveCreateJob): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_CREATE_JOB_KEY, JSON.stringify(job));
  } catch {
    // Generation must continue when browser storage is unavailable.
  }
};

export const loadActiveCreateJob = (now = Date.now()): ActiveCreateJob | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_CREATE_JOB_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isActiveCreateJob(parsed, now)) return parsed;
  } catch {
    // Invalid or unavailable browser storage should not break the generator.
  }
  try {
    window.localStorage.removeItem(ACTIVE_CREATE_JOB_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
  return null;
};

export const clearActiveCreateJob = (expectedJobId?: string): void => {
  if (typeof window === "undefined") return;
  try {
    if (expectedJobId) {
      const active = loadActiveCreateJob();
      if (active && active.id !== expectedJobId) return;
    }
    window.localStorage.removeItem(ACTIVE_CREATE_JOB_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
};
