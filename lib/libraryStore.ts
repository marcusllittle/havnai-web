export type LibraryItemType = "image" | "video" | "unknown";

export interface LibraryEntry {
  job_id: string;
  created_at: string;
  type: LibraryItemType;
  preview_hint?: string;
}

const STORAGE_KEY = "havnai.library.v1";
const REMOVED_KEY = "havnai.library.removed.v1";
// The server is the source of truth now (GET /jobs/mine); this local list is
// a cache that also carries preview hints for jobs whose results have not
// been fetched yet. The cap only bounds localStorage quota.
const MAX_ENTRIES = 500;
const scopedKey = (key: string, account?: string) => account ? `${key}:${account}` : key;

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

export function loadLibrary(account?: string): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(scopedKey(STORAGE_KEY, account)));
}

export function saveLibrary(entries: LibraryEntry[], account?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(STORAGE_KEY, account), JSON.stringify(entries));
}

export function prune(entries: LibraryEntry[]): LibraryEntry[] {
  return entries.slice(0, MAX_ENTRIES);
}

export function addToLibrary(entry: LibraryEntry, account?: string): LibraryEntry[] {
  const existing = loadLibrary(account).filter((item) => item.job_id !== entry.job_id);
  const next = prune([entry, ...existing]);
  saveLibrary(next, account);
  return next;
}

/**
 * Job ids the user explicitly removed.
 *
 * Removal has to be remembered separately from the entry list: the list is
 * now re-seeded from the server on every visit, so a plain filter would put
 * deleted items straight back on the next page load.
 */
function loadRemoved(account?: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(scopedKey(REMOVED_KEY, account)) || "[]");
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveRemoved(ids: Set<string>, account?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(REMOVED_KEY, account), JSON.stringify([...ids].slice(-MAX_ENTRIES)));
}

export function removeFromLibrary(jobId: string, account?: string): LibraryEntry[] {
  const removed = loadRemoved(account);
  removed.add(jobId);
  saveRemoved(removed, account);
  const next = loadLibrary(account).filter((entry) => entry.job_id !== jobId);
  saveLibrary(next, account);
  return next;
}

export function bulkRemoveFromLibrary(jobIds: Set<string>, account?: string): LibraryEntry[] {
  const removed = loadRemoved(account);
  jobIds.forEach((id) => removed.add(id));
  saveRemoved(removed, account);
  const next = loadLibrary(account).filter((entry) => !jobIds.has(entry.job_id));
  saveLibrary(next, account);
  return next;
}

/**
 * Fold the wallet's server-side job history into the local list.
 *
 * Server entries win on existence, local entries win on `preview_hint`
 * (the server does not store one). Anything the user deleted stays gone.
 */
export function mergeServerJobs(serverEntries: LibraryEntry[], account?: string): LibraryEntry[] {
  const removed = loadRemoved(account);
  const byId = new Map<string, LibraryEntry>();
  for (const entry of loadLibrary(account)) {
    if (!removed.has(entry.job_id)) byId.set(entry.job_id, entry);
  }
  for (const entry of serverEntries) {
    if (removed.has(entry.job_id)) continue;
    const local = byId.get(entry.job_id);
    byId.set(entry.job_id, {
      ...entry,
      type: entry.type === "unknown" && local ? local.type : entry.type,
      preview_hint: local?.preview_hint ?? entry.preview_hint,
    });
  }
  const next = prune(
    [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
  );
  saveLibrary(next, account);
  return next;
}

export function isInLibrary(jobId: string, account?: string): boolean {
  return loadLibrary(account).some((entry) => entry.job_id === jobId);
}
