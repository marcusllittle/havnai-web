import type { VideoJobRequest } from "./havnai";

export const ACTIVE_VIDEO_CHAIN_KEY = "havnai_active_video_chain_v1";
export const ACTIVE_VIDEO_CHAIN_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type ActiveVideoChain = {
  prompt: string;
  total: number;
  currentIndex: number;
  currentJobId?: string;
  completedJobIds: string[];
  autoStitch: boolean;
  request: VideoJobRequest;
  startedAt: number;
};

const isJobId = (value: unknown): value is string =>
  typeof value === "string" && /^job-[A-Za-z0-9_-]+$/.test(value);

const isActiveVideoChain = (value: unknown, now: number): value is ActiveVideoChain => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActiveVideoChain>;
  if (
    typeof candidate.prompt !== "string" ||
    !Number.isInteger(candidate.total) ||
    Number(candidate.total) < 2 ||
    Number(candidate.total) > 7 ||
    !Number.isInteger(candidate.currentIndex) ||
    Number(candidate.currentIndex) < 0 ||
    Number(candidate.currentIndex) > Number(candidate.total) ||
    typeof candidate.autoStitch !== "boolean" ||
    !candidate.request ||
    typeof candidate.request !== "object" ||
    typeof candidate.request.prompt !== "string" ||
    typeof candidate.request.model !== "string" ||
    !Array.isArray(candidate.completedJobIds) ||
    !candidate.completedJobIds.every(isJobId) ||
    candidate.completedJobIds.length > Number(candidate.currentIndex) ||
    typeof candidate.startedAt !== "number" ||
    !Number.isFinite(candidate.startedAt) ||
    candidate.startedAt > now + 60_000 ||
    now - candidate.startedAt > ACTIVE_VIDEO_CHAIN_MAX_AGE_MS
  ) {
    return false;
  }
  if (candidate.currentJobId !== undefined && !isJobId(candidate.currentJobId)) return false;
  if (Number(candidate.currentIndex) < Number(candidate.total) && !candidate.currentJobId) {
    return candidate.completedJobIds.length === Number(candidate.currentIndex);
  }
  return true;
};

export const saveActiveVideoChain = (chain: ActiveVideoChain): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_VIDEO_CHAIN_KEY, JSON.stringify(chain));
  } catch {
    // A render must continue when browser storage is unavailable.
  }
};

export const loadActiveVideoChain = (now = Date.now()): ActiveVideoChain | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_VIDEO_CHAIN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isActiveVideoChain(parsed, now)) return parsed;
  } catch {
    // Invalid or unavailable browser storage should not break the generator.
  }
  try {
    window.localStorage.removeItem(ACTIVE_VIDEO_CHAIN_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
  return null;
};

export const clearActiveVideoChain = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_VIDEO_CHAIN_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
};
