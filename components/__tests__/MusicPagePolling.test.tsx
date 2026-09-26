import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MusicPage from "../../pages/music";
import { fetchMusicDiscover } from "../../lib/havnai";
import { fetchMusicJobs } from "../../lib/musicStudioApi";
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => ({ currentTrack: null, isPlaying: false, playTrack: vi.fn(), toggle: vi.fn() }) }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ activeWallet: "0x1111111111111111111111111111111111111111", connectedWallet: "0x1111111111111111111111111111111111111111", connect: vi.fn() }) }));
vi.mock("../../lib/havnai", () => ({ fetchMusicDiscover: vi.fn(), publishMusicJob: vi.fn(), unpublishMusicPublication: vi.fn() }));
vi.mock("../../lib/musicStudioApi", () => ({
  fetchMusicJobs: vi.fn(async () => []), fetchMusicCapabilities: vi.fn(async () => ({ models: [] })),
  fetchMusicJob: vi.fn(), createMusicJob: vi.fn(), cancelMusicJob: vi.fn(), musicMediaUrl: (url: string) => url,
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.setItem("havnai_studio_key", "test-key");
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); sessionStorage.clear(); localStorage.clear(); vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("opens, polls five times, and revisits Music without a signed catalog read", async () => {
  await act(async () => root.render(<MusicPage />));
  for (let i = 0; i < 5; i++) await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(fetchMusicJobs).toHaveBeenCalledTimes(6);
  expect(fetchMusicDiscover).not.toHaveBeenCalled();
  await act(async () => root.render(<div />));
  await act(async () => root.render(<MusicPage />));
  expect(fetchMusicDiscover).not.toHaveBeenCalled();
});
