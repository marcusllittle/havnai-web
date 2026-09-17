import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MusicStudioPage from "../../pages/music";
import VideoStudioPage from "../../pages/video-studio";
import { fetchMusicCapabilities, fetchMusicJobs } from "../../lib/musicStudioApi";
import { createVideoJob, fetchVideoCapabilities, fetchV1Jobs, uploadStudioAsset } from "../../lib/videoStudioApi";

vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => ({ currentTrack: null, isPlaying: false, playTrack: vi.fn(), toggle: vi.fn() }) }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ activeWallet: null, connectedWallet: null }) }));
vi.mock("../../lib/musicStudioApi", async original => ({ ...await original<typeof import("../../lib/musicStudioApi")>(), fetchMusicCapabilities: vi.fn(), fetchMusicJobs: vi.fn() }));
vi.mock("../../lib/videoStudioApi", async original => ({ ...await original<typeof import("../../lib/videoStudioApi")>(), fetchVideoCapabilities: vi.fn(), fetchV1Jobs: vi.fn(), uploadStudioAsset: vi.fn(), createVideoJob: vi.fn() }));

describe("Studio workspaces", () => {
  let container: HTMLDivElement;
  let root: Root;
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent?.trim() === label)!;
  function change(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    sessionStorage.clear(); localStorage.clear();
    sessionStorage.setItem("havnai_studio_key", "test-only-key");
    vi.mocked(fetchMusicCapabilities).mockResolvedValue({ models: [{ id: "music-test", available: true, capabilities: ["text_to_music"] }], nodes: [] });
    vi.mocked(fetchMusicJobs).mockResolvedValue([]);
    vi.mocked(fetchVideoCapabilities).mockResolvedValue({ models: [{ id: "video-test", available: true, capabilities: ["image_to_video"] }], nodes: [], video_v2_available: true, video_v2_enabled: true });
    vi.mocked(fetchV1Jobs).mockResolvedValue([]);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("keeps music lyrics and tuning when applying a starter", async () => {
    localStorage.setItem("havnai_music_studio_form_v1", JSON.stringify({ prompt: "Old draft", style: "Jazz", lyrics: "My chorus", duration: 90, instrumental: false, seed: "24", bpm: "100", key: "C" }));
    await act(async () => root.render(<MusicStudioPage />));
    await act(async () => button("Indie lift").click());
    expect(container.querySelector<HTMLTextAreaElement>(".music-prompt-field textarea")!.value).toContain("uplifting indie pop");
    expect(container.querySelector<HTMLTextAreaElement>(".music-lyrics textarea")!.value).toBe("My chorus");
    expect(container.querySelector<HTMLInputElement>('.music-advanced input[placeholder="Random"]')!.value).toBe("24");
    expect(button("Create song").disabled).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Leave studio"]')!.click());
    expect(container.querySelector<HTMLInputElement>("#studio-access-key")!.value).toBe("");
    expect(sessionStorage.getItem("havnai_studio_key")).toBeNull();
    expect(JSON.parse(localStorage.getItem("havnai_music_studio_form_v1")!).lyrics).toBe("My chorus");
  });

  it("shows rejected studio access and keeps the key editable for retry", async () => {
    sessionStorage.clear();
    vi.mocked(fetchMusicCapabilities).mockRejectedValueOnce(new Error("studio_access_denied"));
    await act(async () => root.render(<MusicStudioPage />));
    expect(document.activeElement).not.toBe(container.querySelector("input"));
    await act(async () => change("#studio-access-key", "bad-key"));
    await act(async () => button("Open Music Studio").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("not accepted");
    expect(sessionStorage.getItem("havnai_studio_key")).toBeNull();
    await act(async () => change("#studio-access-key", "retry-key"));
    await act(async () => button("Open Music Studio").click());
    expect(container.querySelector(".music-composer")).not.toBeNull();
  });

  it("requires video essentials and retains advanced settings in the submitted clip", async () => {
    vi.mocked(uploadStudioAsset).mockResolvedValue({ id: "source-id", kind: "image", filename: "source.png", sha256: "test" });
    vi.mocked(createVideoJob).mockResolvedValue({ id: "clip-id", status: "succeeded", stage: "completed", progress: 100, model: "video-test", resolved_spec: {}, artifacts: [] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["fixture"], { type: "image/png" }) }));
    await act(async () => root.render(<VideoStudioPage />));
    const details = container.querySelector<HTMLDetailsElement>(".studio-video-advanced")!;
    expect(details.open).toBe(false);
    expect(button("Generate clip").disabled).toBe(true);
    await act(async () => change("textarea", "A gentle pan"));
    expect(button("Generate clip").disabled).toBe(true);
    await act(async () => change(".source-fields input", "/api/static/outputs/source.png"));
    expect(button("Generate clip").disabled).toBe(false);
    await act(async () => details.querySelector("summary")!.click());
    await act(async () => change('input[type="number"]', "91"));
    await act(async () => button("Native Quality").click());
    await act(async () => button("16:9").click());
    await act(async () => details.querySelector("summary")!.click());
    expect(details.open).toBe(false);
    await act(async () => button("Generate clip").click());
    expect(createVideoJob).toHaveBeenCalledWith(expect.objectContaining({ prompt: "A gentle pan", sourceAssetId: "source-id", preset: "native_quality", aspectRatio: "16:9", seed: 91 }), "test-only-key");
    expect(container.textContent).toContain("Your clip is ready");
  });

  it("keeps generation unavailable when the studio has no video capacity", async () => {
    vi.mocked(fetchVideoCapabilities).mockResolvedValue({ models: [], nodes: [], video_v2_available: false, video_v2_enabled: true });
    await act(async () => root.render(<VideoStudioPage />));
    await act(async () => change("textarea", "A gentle pan"));
    await act(async () => change(".source-fields input", "/api/static/outputs/source.png"));
    expect(button("Generate clip").disabled).toBe(true);
    expect(container.textContent).toContain("No video node available");
  });
});
