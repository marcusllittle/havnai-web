import { beforeEach, describe, expect, it } from "vitest";
import {
  addToLibrary,
  bulkRemoveFromLibrary,
  loadLibrary,
  mergeServerJobs,
  removeFromLibrary,
} from "../libraryStore";

const entry = (job_id: string, created_at: string) => ({
  job_id,
  created_at,
  type: "image" as const,
});

describe("libraryStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("mergeServerJobs", () => {
    it("adds server jobs the browser has never seen", () => {
      // The whole point: a cleared browser or a second device starts empty
      // and must still show the wallet's real history.
      const merged = mergeServerJobs([
        entry("a", "2026-01-02T00:00:00.000Z"),
        entry("b", "2026-01-01T00:00:00.000Z"),
      ]);

      expect(merged.map((e) => e.job_id)).toEqual(["a", "b"]);
      expect(loadLibrary()).toHaveLength(2);
    });

    it("keeps local entries the server did not return", () => {
      addToLibrary(entry("local-only", "2026-01-03T00:00:00.000Z"));

      const merged = mergeServerJobs([entry("from-server", "2026-01-01T00:00:00.000Z")]);

      expect(merged.map((e) => e.job_id)).toEqual(["local-only", "from-server"]);
    });

    it("does not duplicate a job present both locally and on the server", () => {
      addToLibrary(entry("shared", "2026-01-01T00:00:00.000Z"));

      const merged = mergeServerJobs([entry("shared", "2026-01-01T00:00:00.000Z")]);

      expect(merged).toHaveLength(1);
    });

    it("preserves the local preview hint, which the server does not store", () => {
      addToLibrary({
        ...entry("shared", "2026-01-01T00:00:00.000Z"),
        preview_hint: "/outputs/shared.png",
      });

      const merged = mergeServerJobs([entry("shared", "2026-01-01T00:00:00.000Z")]);

      expect(merged[0].preview_hint).toBe("/outputs/shared.png");
    });

    it("sorts newest first regardless of input order", () => {
      const merged = mergeServerJobs([
        entry("old", "2026-01-01T00:00:00.000Z"),
        entry("new", "2026-03-01T00:00:00.000Z"),
        entry("mid", "2026-02-01T00:00:00.000Z"),
      ]);

      expect(merged.map((e) => e.job_id)).toEqual(["new", "mid", "old"]);
    });
  });

  describe("deletion survives a server re-seed", () => {
    it("does not resurrect a removed job", () => {
      // Without tombstones, re-seeding from the server would silently undo
      // every delete on the next page load.
      addToLibrary(entry("unwanted", "2026-01-01T00:00:00.000Z"));
      removeFromLibrary("unwanted");

      const merged = mergeServerJobs([entry("unwanted", "2026-01-01T00:00:00.000Z")]);

      expect(merged.map((e) => e.job_id)).toEqual([]);
    });

    it("does not resurrect bulk-removed jobs", () => {
      addToLibrary(entry("a", "2026-01-01T00:00:00.000Z"));
      addToLibrary(entry("b", "2026-01-02T00:00:00.000Z"));
      bulkRemoveFromLibrary(new Set(["a", "b"]));

      const merged = mergeServerJobs([
        entry("a", "2026-01-01T00:00:00.000Z"),
        entry("b", "2026-01-02T00:00:00.000Z"),
        entry("c", "2026-01-03T00:00:00.000Z"),
      ]);

      expect(merged.map((e) => e.job_id)).toEqual(["c"]);
    });

    it("still lets a deleted job come back if the user regenerates it", () => {
      addToLibrary(entry("x", "2026-01-01T00:00:00.000Z"));
      removeFromLibrary("x");

      // An explicit re-add is a deliberate user action and must win over
      // the tombstone.
      addToLibrary(entry("x", "2026-01-05T00:00:00.000Z"));

      expect(loadLibrary().map((e) => e.job_id)).toEqual(["x"]);
    });
  });
});
