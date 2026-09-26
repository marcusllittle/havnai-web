import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutputCard } from "../OutputCard";

describe("Create result actions", () => {
  let container: HTMLDivElement, root: Root;
  const button = (label: string) => Array.from(container.querySelectorAll("button")).find(item => item.textContent === label)!;
  const render = (jobId = "job-one") => act(async () => root.render(<OutputCard jobId={jobId} imageUrl="https://example.com/output.webp?signature=abc" />));
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("preserves signed media URLs when retrying a failed preview", async () => {
    await render();
    await act(async () => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("preview couldn't load");
    await act(async () => button("Retry preview").click());
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/output.webp?signature=abc");
  });

  it("offers an explicit fallback and recovers after a failed download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    await render();
    await act(async () => button("Download image").click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("download couldn't finish");
    expect(container.querySelector("a")?.getAttribute("href")).toContain("signature=abc");
    expect(button("Download image").disabled).toBe(false);
  });

  it("ignores a stale download when the result changes", async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
    await render();
    await act(async () => button("Download image").click());
    expect(button("Downloading...").disabled).toBe(true);
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    await render("job-two");
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ ok: false }));
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(button("Download image").disabled).toBe(false);
  });

  it("keeps a full selectable ID when clipboard access fails", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    await render();
    await act(async () => button("Copy ID").click());
    expect(container.querySelector("code")?.textContent).toBe("job-one");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("copy it manually");
  });

  it("reports frame capture failure and releases the control", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    const onUseLastFrame = vi.fn();
    await act(async () => root.render(<OutputCard videoUrl="https://example.com/video.mp4" onUseLastFrame={onUseLastFrame} />));
    await act(async () => button("Use last frame").click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("last frame couldn't be captured");
    expect(button("Use last frame").disabled).toBe(false);
    expect(onUseLastFrame).not.toHaveBeenCalled();
  });
});
