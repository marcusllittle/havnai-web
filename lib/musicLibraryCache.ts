// Private read results stay in this tab's memory, never in persistent storage.
const entries = new Map<string, { expires: number; promise: Promise<unknown> }>();
export function clearMusicLibraryCache() { entries.clear(); }
export function cachedMusicLibrary<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise as Promise<T>;
  const entry = { expires: Date.now() + 15 * 60_000, promise: Promise.resolve().then(load) };
  entries.set(key, entry);
  entry.promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
  return entry.promise;
}
