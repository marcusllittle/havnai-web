import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryFeed, type HistoryItem } from "../HistoryFeed";

const items: HistoryItem[] = [
  { jobId: "image-one", prompt: "A coast at dawn", imageUrl: "/coast.webp", timestamp: 1 },
  { jobId: "video-one", prompt: "A slow camera move", videoUrl: "/clip.mp4", timestamp: 2 },
];
describe("Recent creations", () => {
  let container: HTMLDivElement, root: Root;
  const onSelect = vi.fn(), onClear = vi.fn();
  const button = (label: string) => Array.from(container.querySelectorAll("button")).find(item => item.textContent === label)!;
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => root.render(<HistoryFeed items={items} activeJobId="video-one" onSelect={onSelect} onClear={onClear} />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
  it("names image and video controls and opens the selected result", async () => {
    const video = container.querySelector<HTMLButtonElement>('[aria-label="Open video: A slow camera move"]')!;
    expect(video.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[aria-label="Open image: A coast at dawn"]')).not.toBeNull();
    await act(async () => video.click());
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });
  it("keeps failed media identifiable and opens its details", async () => {
    await act(async () => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.textContent).toContain("Preview unavailable");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open image: A coast at dawn"]')!.click());
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });
  it("requires explicit confirmation and supports canceling history removal", async () => {
    await act(async () => button("Clear history").click());
    expect(onClear).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Items saved to Collection stay there.");
    await act(async () => button("Keep history").click());
    expect(container.querySelector(".studio-history-confirm")).toBeNull();
    await act(async () => button("Clear history").click());
    await act(async () => button("Clear recent history").click());
    expect(onClear).toHaveBeenCalledOnce();
  });
});
