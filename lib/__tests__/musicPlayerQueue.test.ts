import { describe, expect, it } from "vitest";
import { adjacentQueueIndex, playableQueue, resolveQueueSelection, restoreQueueSelection } from "../musicPlayerQueue";

const tracks = [
  { id: "one", audioUrl: "/one.mp3" },
  { id: "missing", audioUrl: "" },
  { id: "two", audioUrl: "/two.mp3" },
];

describe("music player queue helpers", () => {
  it("keeps only playable tracks in queue order", () => {
    expect(playableQueue(tracks).map((track) => track.id)).toEqual(["one", "two"]);
  });

  it("selects the clicked track inside a playable queue", () => {
    const resolved = resolveQueueSelection(tracks[2], tracks);

    expect(resolved.queue.map((track) => track.id)).toEqual(["one", "two"]);
    expect(resolved.index).toBe(1);
    expect(resolved.track?.id).toBe("two");
  });

  it("keeps the selected track and queue index aligned", () => {
    const resolved = resolveQueueSelection(tracks[0], tracks, 50);

    expect(resolved.index).toBe(0);
    expect(resolved.track?.id).toBe("one");
  });

  it("falls back to a requested playable queue index when the selected track is unavailable", () => {
    const resolved = resolveQueueSelection(tracks[1], tracks, 50);

    expect(resolved.index).toBe(1);
    expect(resolved.track?.id).toBe("two");
  });

  it("returns no selected track when nothing is playable", () => {
    const resolved = resolveQueueSelection({ id: "silent", audioUrl: "" }, [{ id: "silent", audioUrl: "" }]);

    expect(resolved.queue).toEqual([]);
    expect(resolved.track).toBeNull();
  });

  it("guards previous and next boundaries", () => {
    expect(adjacentQueueIndex(2, 0, -1)).toBeNull();
    expect(adjacentQueueIndex(2, 0, 1)).toBe(1);
    expect(adjacentQueueIndex(2, 1, 1)).toBeNull();
  });

  it("restores a stale stored track to the first playable queue entry", () => {
    const resolved = restoreQueueSelection({ id: "stale", audioUrl: "/gone.mp3" }, tracks);

    expect(resolved.index).toBe(0);
    expect(resolved.track?.id).toBe("one");
    expect(resolved.queue.map((track) => track.id)).toEqual(["one", "two"]);
  });

  it("ignores corrupt stored queue entries while restoring playback", () => {
    const resolved = restoreQueueSelection(null, [{ nope: true }, tracks[1], tracks[2]]);

    expect(resolved.index).toBe(0);
    expect(resolved.track?.id).toBe("two");
    expect(resolved.queue).toEqual([tracks[2]]);
  });
});
