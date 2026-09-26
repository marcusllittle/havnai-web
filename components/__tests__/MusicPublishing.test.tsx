import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MusicPage from "../../pages/music";
import { publishMusicJob } from "../../lib/havnai";
import { fetchMusicJobs } from "../../lib/musicStudioApi";

const CREATOR = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const wallet = vi.hoisted(() => ({
  activeWallet: null as string | null,
  connectedWallet: null as string | null,
  connect: vi.fn(),
}));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("next/image", () => ({ default: ({ fill, priority, ...props }: any) => <img {...props} /> }));
vi.mock("../MusicWaveform", () => ({ MusicWaveform: () => null }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => ({ currentTrack: null, isPlaying: false, playTrack: vi.fn(), toggle: vi.fn() }) }));
vi.mock("../WalletProvider", () => ({ useWallet: () => wallet }));
vi.mock("../../lib/havnai", () => ({ fetchMusicDiscover: vi.fn(), publishMusicJob: vi.fn(), unpublishMusicPublication: vi.fn() }));
vi.mock("../../lib/musicStudioApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/musicStudioApi")>(),
  fetchMusicJobs: vi.fn(), fetchMusicCapabilities: vi.fn(async () => ({ models: [] })),
}));

let root: Root, host: HTMLDivElement;
const button = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
  .find((element) => element.textContent?.trim() === label);

async function openPublish() {
  await act(async () => root.render(<MusicPage />));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click());
  expect(button("Publish")).toBeDefined();
  await act(async () => button("Publish")!.click());
}

beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  wallet.activeWallet = null; wallet.connectedWallet = null;
  wallet.connect.mockResolvedValue(CREATOR);
  sessionStorage.setItem("havnai_studio_key", "test-key");
  vi.mocked(fetchMusicJobs).mockResolvedValue([{
    id: "song-job", type: "text_to_music", status: "succeeded", stage: "done", progress: 100,
    model: "ace_step_1_5_turbo", wallet: CREATOR,
    resolved_spec: { parameters: { prompt: "My song", duration: 60 } },
    artifacts: [{ id: "audio-1", kind: "audio", filename: "song.mp3", content_type: "audio/mpeg", url: "/static/song.mp3" }],
  }]);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); sessionStorage.clear(); localStorage.clear();
  vi.useRealTimers(); vi.resetAllMocks(); vi.unstubAllGlobals();
});

it("lets a disconnected creator connect and publish without trusting the fallback wallet", async () => {
  wallet.activeWallet = OTHER;
  vi.mocked(publishMusicJob).mockResolvedValue({ id: "publication-1", job_id: "song-job" } as any);
  await openPublish();
  await act(async () => button("Connect and publish")!.click());
  expect(wallet.connect).toHaveBeenCalledOnce();
  expect(publishMusicJob).toHaveBeenCalledWith(expect.objectContaining({ wallet: CREATOR, job_id: "song-job" }), expect.anything());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("shows publishing errors inside the dialog and allows a retry", async () => {
  wallet.activeWallet = CREATOR; wallet.connectedWallet = CREATOR;
  vi.mocked(publishMusicJob).mockRejectedValueOnce(new Error("Publishing service unavailable"));
  await openPublish();
  await act(async () => button("Publish")!.click());
  expect(host.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe("Publishing service unavailable");
  expect(button("Publish")?.disabled).toBe(false);
  expect(wallet.connect).not.toHaveBeenCalled();
  vi.mocked(publishMusicJob).mockResolvedValueOnce({ id: "publication-1", job_id: "song-job" } as any);
  await act(async () => button("Publish")!.click());
  expect(publishMusicJob).toHaveBeenCalledTimes(2);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("reports a rejected connection inside the dialog without sending a publishing request", async () => {
  wallet.connect.mockRejectedValueOnce(new Error("Connection rejected"));
  await openPublish();
  await act(async () => button("Connect and publish")!.click());
  expect(host.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe("Connection rejected");
  expect(publishMusicJob).not.toHaveBeenCalled();
});

it("rejects a different creator account after connection before requesting a signature", async () => {
  wallet.connect.mockResolvedValueOnce(OTHER);
  await openPublish();
  await act(async () => button("Connect and publish")!.click());
  expect(host.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("creator wallet");
  expect(publishMusicJob).not.toHaveBeenCalled();
});

it("does not queue multiple wallet prompts while connecting", async () => {
  let completeConnection!: (wallet: string) => void;
  wallet.connect.mockReturnValueOnce(new Promise<string>((resolve) => { completeConnection = resolve; }));
  vi.mocked(publishMusicJob).mockResolvedValueOnce({ id: "publication-1", job_id: "song-job" } as any);
  await openPublish();
  await act(async () => {
    const dialog = host.querySelector('[role="dialog"]')!;
    dialog.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    dialog.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(wallet.connect).toHaveBeenCalledOnce();
  expect(publishMusicJob).not.toHaveBeenCalled();
  await act(async () => completeConnection(CREATOR));
  expect(publishMusicJob).toHaveBeenCalledOnce();
});
