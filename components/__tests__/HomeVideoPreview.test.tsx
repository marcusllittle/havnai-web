import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { HomeVideoPreview } from "../HomeVideoPreview";

vi.mock("next/image", () => ({ default: ({ fill, ...props }: any) => <img {...props} /> }));
let host: HTMLDivElement, root: Root;
let intersect: (entries: { isIntersecting: boolean }[]) => void;
let motion: () => void;
let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let disconnect: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  preference = { matches: false, addEventListener: vi.fn((_event, callback) => { motion = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => preference));
  disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {} disconnect() { disconnect(); }
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = (src?: string) => act(async () => root.render(<HomeVideoPreview src={src} poster="/poster.webp" alt="Video artwork" />));

it("renders only the poster when no approved video has been supplied", async () => {
  await render();
  expect(host.querySelector("video")).toBeNull();
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/poster.webp");
  expect(window.matchMedia).not.toHaveBeenCalled();
});
it("defers the video until visible, plays muted inline, and pauses outside the viewport", async () => {
  await render("/preview.mp4");
  expect(host.querySelector("video")).toBeNull();
  await act(async () => intersect([{ isIntersecting: true }]));
  const video = host.querySelector("video")!;
  expect(video.getAttribute("preload")).toBe("none");
  expect(video.muted).toBe(true); expect(video.loop).toBe(true); expect(video.playsInline).toBe(true);
  expect(video.play).toHaveBeenCalled();
  vi.mocked(video.pause).mockClear();
  await act(async () => intersect([{ isIntersecting: false }]));
  expect(video.pause).toHaveBeenCalled();
});
it("keeps the poster for reduced motion, including a preference change during playback", async () => {
  preference.matches = true;
  await render("/preview.mp4");
  await act(async () => intersect([{ isIntersecting: true }]));
  expect(host.querySelector("video")).toBeNull();
  await act(async () => { preference.matches = false; motion(); });
  expect(host.querySelector("video")).not.toBeNull();
  await act(async () => { preference.matches = true; motion(); });
  expect(host.querySelector("video")).toBeNull();
});
it("falls back to the poster on a missing or unsupported clip", async () => {
  await render("/preview.mp4");
  await act(async () => intersect([{ isIntersecting: true }]));
  await act(async () => host.querySelector("video")!.dispatchEvent(new Event("error")));
  expect(host.querySelector("video")).toBeNull();
  expect(host.querySelector("button")).toBeNull();
  expect(host.querySelector("img")).not.toBeNull();
});
it("handles blocked autoplay without an unhandled rejection and offers manual playback", async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("Autoplay blocked"));
  await render("/preview.mp4");
  await act(async () => intersect([{ isIntersecting: true }]));
  expect(host.querySelector("video")?.className).not.toBe("is-playing");
  expect(host.querySelector("button")?.getAttribute("aria-label")).toBe("Play video preview");
  await act(async () => host.querySelector("button")!.click());
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});
it("offers a pause control, pauses hidden tabs, and cleans up observers", async () => {
  await render("/preview.mp4");
  await act(async () => intersect([{ isIntersecting: true }]));
  const video = host.querySelector("video")!;
  await act(async () => video.dispatchEvent(new Event("playing")));
  expect(host.querySelector("button")?.getAttribute("aria-label")).toBe("Pause video preview");
  await act(async () => host.querySelector("button")!.click());
  expect(video.pause).toHaveBeenCalled();
  await act(async () => host.querySelector("button")!.click());
  vi.mocked(video.pause).mockClear();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(video.pause).toHaveBeenCalled();
  await act(async () => root.render(<div />));
  expect(disconnect).toHaveBeenCalled();
  expect(preference.removeEventListener).toHaveBeenCalled();
});
