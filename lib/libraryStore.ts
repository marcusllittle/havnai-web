export type LibraryItemType = "image" | "video" | "unknown";

export interface LibraryEntry {
  job_id: string;
  created_at: string;
  type: LibraryItemType;
  preview_hint?: string;
}

const STORAGE_KEY = "havnai.library.v1";
const MAX_ENTRIES = 200;

function safeParse(raw: string | null): LibraryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.job_id === "string")
      .map((entry) => ({
        job_id: String(entry.job_id),
        created_at: typeof entry.created_at === "string" ? entry.created_at : new Date().toISOString(),
        type:
          entry.type === "image" || entry.type === "video" || entry.type === "unknown"
            ? entry.type
            : "unknown",
        preview_hint: typeof entry.preview_hint === "string" ? entry.preview_hint : undefined,
      }));
  } catch {
    return [];
  }
}

export function loadLibrary(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function saveLibrary(entries: LibraryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function prune(entries: LibraryEntry[]): LibraryEntry[] {
  return entries.slice(0, MAX_ENTRIES);
}

export function addToLibrary(entry: LibraryEntry): LibraryEntry[] {
  const existing = loadLibrary().filter((item) => item.job_id !== entry.job_id);
  const next = prune([entry, ...existing]);
  saveLibrary(next);
  return next;
}

export function removeFromLibrary(jobId: string): LibraryEntry[] {
  const next = loadLibrary().filter((entry) => entry.job_id !== jobId);
  saveLibrary(next);
  return next;
}

export function isInLibrary(jobId: string): boolean {
  return loadLibrary().some((entry) => entry.job_id === jobId);
}
