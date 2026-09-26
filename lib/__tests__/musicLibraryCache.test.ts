import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedMusicLibrary, clearMusicLibraryCache } from "../musicLibraryCache";
afterEach(() => { clearMusicLibraryCache(); vi.useRealTimers(); });
describe("private music library cache", () => {
  it("shares concurrent reads and returning visits without another signature", async () => {
    const load = vi.fn().mockResolvedValue({ songs: ["song"] });
    await Promise.all([cachedMusicLibrary("wallet-a", load), cachedMusicLibrary("wallet-a", load)]);
    await cachedMusicLibrary("wallet-a", load);
    expect(load).toHaveBeenCalledTimes(1);
    await cachedMusicLibrary("wallet-b", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("expires reads and clears them when identity or library changes", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue([]);
    await cachedMusicLibrary("a", load);
    vi.advanceTimersByTime(15 * 60_000);
    await cachedMusicLibrary("a", load);
    clearMusicLibraryCache();
    await cachedMusicLibrary("a", load);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("does not retain a rejected wallet request", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("rejected")).mockResolvedValue([]);
    await expect(cachedMusicLibrary("a", load)).rejects.toThrow("rejected");
    await cachedMusicLibrary("a", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
