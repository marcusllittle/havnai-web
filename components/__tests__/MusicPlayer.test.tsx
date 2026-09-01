import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MusicPlayerProvider, type PlayerTrack, useMusicPlayer } from "../MusicPlayer";

const tracks: PlayerTrack[] = [
  { id: "one", title: "First", style: "Synthwave", audioUrl: "/one.mp3", publicationId: "pub-one" },
  { id: "two", title: "Second", style: "Ambient", audioUrl: "/two.mp3", publicationId: "pub-two" },
];

function click(container: HTMLElement, selector: string) {
  const target = container.querySelector(selector);
  expect(target).not.toBeNull();
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function text(container: HTMLElement, selector: string): string {
  return container.querySelector(selector)?.textContent || "";
}

function PlayerProbe({ view, onRoute }: { view: string; onRoute: () => void }) {
  const player = useMusicPlayer();
  return (
    <section>
      <span data-testid="route">{view}</span>
      <span data-testid="current">{player.currentTrack?.id || "none"}</span>
      <span data-testid="index">{player.queueIndex}</span>
      <span data-testid="queue-length">{player.queue.length}</span>
      <button type="button" data-testid="play-all" onClick={() => player.playQueue(tracks)}>Play All</button>
      <button type="button" data-testid="next" onClick={player.next} disabled={!player.hasNext}>Next</button>
      <button type="button" data-testid="previous" onClick={player.previous} disabled={!player.hasPrevious}>Previous</button>
      <button type="button" data-testid="route-change" onClick={onRoute}>Route</button>
    </section>
  );
}

function Shell() {
  const [view, setView] = useState("discover");
  return (
    <MusicPlayerProvider>
      <PlayerProbe view={view} onRoute={() => setView("library")} />
    </MusicPlayerProvider>
  );
}

describe("MusicPlayerProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch);
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("plays a queue with previous, next, and automatic next-track playback", async () => {
    await act(async () => root.render(<Shell />));

    await act(async () => click(container, "[data-testid='play-all']"));
    expect(text(container, "[data-testid='current']")).toBe("one");
    expect(text(container, "[data-testid='index']")).toBe("0");
    expect(text(container, "[data-testid='queue-length']")).toBe("2");

    await act(async () => click(container, "[data-testid='next']"));
    expect(text(container, "[data-testid='current']")).toBe("two");
    expect(text(container, "[data-testid='index']")).toBe("1");

    await act(async () => click(container, "[data-testid='previous']"));
    expect(text(container, "[data-testid='current']")).toBe("one");
    expect(text(container, "[data-testid='index']")).toBe("0");

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    await act(async () => audio?.dispatchEvent(new Event("ended", { bubbles: true })));
    expect(text(container, "[data-testid='current']")).toBe("two");
    expect(text(container, "[data-testid='index']")).toBe("1");
  });

  it("keeps playback state when routed page content changes", async () => {
    await act(async () => root.render(<Shell />));

    await act(async () => click(container, "[data-testid='play-all']"));
    await act(async () => click(container, "[data-testid='route-change']"));

    expect(text(container, "[data-testid='route']")).toBe("library");
    expect(text(container, "[data-testid='current']")).toBe("one");
    expect(text(container, "[data-testid='queue-length']")).toBe("2");
  });
});
