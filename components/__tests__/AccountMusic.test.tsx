import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import MusicPage from "../../pages/music";
import { DEFAULT_MUSIC_FORM } from "../../lib/musicStudioState";

const state = vi.hoisted(() => ({ configured: true, signedIn: true, loading: false,
  account: { id: "acct_alice" } as { id: string } | null, error: "", request: vi.fn(), connect: vi.fn(), legacyPublish: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ activeWallet: "0xfallback", connectedWallet: "0xconnected", connect: state.connect }) }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("next/image", () => ({ default: ({ fill, priority, ...props }: any) => <img {...props} /> }));
vi.mock("../MusicWaveform", () => ({ MusicWaveform: () => null }));
vi.mock("../MusicPlayer", () => ({ useMusicPlayer: () => ({ currentTrack: null, isPlaying: false, playTrack: vi.fn(), toggle: vi.fn() }) }));
vi.mock("../MusicComposer", () => ({ MusicComposer: ({ form, onSubmit, blocker, submitting }: any) =>
  <form onSubmit={onSubmit}><span data-draft>{form.prompt}</span><button disabled={Boolean(blocker || submitting)} type="submit">Create song</button></form> }));
vi.mock("../../lib/havnai", () => ({ fetchMusicDiscover: vi.fn(), publishMusicJob: state.legacyPublish, unpublishMusicPublication: vi.fn() }));

const song = { id: "job-one", owner_account_id: "acct_alice", type: "text_to_music", model: "ace_step_1_5_turbo",
  status: "succeeded", stage: "succeeded", progress: 100, resolved_spec: { parameters: { prompt: "A private song", duration: 60 } },
  artifacts: [{ id: "artifact-one", kind: "audio", filename: "song.mp3", content_type: "audio/mpeg", url: "/v2/artifacts/artifact-one/content" }] };
let root: Root, host: HTMLDivElement;
const button = (name: string) => [...host.querySelectorAll("button")].find(item => item.textContent?.trim() === name)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No owner or wallet transport allowed"); }));
  state.account = { id: "acct_alice" }; state.signedIn = true; state.request.mockReset(); state.connect.mockReset(); state.legacyPublish.mockReset();
  sessionStorage.clear(); localStorage.clear();
  sessionStorage.setItem("havnai_studio_key", "legacy-key-must-not-be-used");
  localStorage.setItem("havnai_music_studio_form_v1", JSON.stringify({ ...DEFAULT_MUSIC_FORM, prompt: "Legacy private draft" }));
  localStorage.setItem("havnai_music_studio_form_v1:acct_alice", JSON.stringify({ ...DEFAULT_MUSIC_FORM, prompt: "Alice draft" }));
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/v2/capabilities") return { models: [{ id: "ace_step_1_5_turbo", available: true, capabilities: ["text_to_music"] }] };
    if (path.startsWith("/v2/jobs?")) return { jobs: state.account?.id === "acct_alice" ? [song] : [] };
    if (path === "/v2/jobs") return { ...song, id: "job-created", status: "queued" };
    if (path === "/v2/music/publications" && init?.method === "POST") return { id: "publication-one", job_id: song.id };
    if (path === "/v2/music/publications") return { publications: [] };
    return {};
  });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });

it("opens and creates from an account draft without a studio key or wallet, including StrictMode", async () => {
  await act(async () => root.render(<StrictMode><MusicPage /></StrictMode>));
  expect(host.querySelector("[data-draft]")?.textContent).toBe("Alice draft");
  expect(button("Create song").disabled).toBe(false);
  await act(async () => { button("Create song").click(); button("Create song").click(); });
  const submissions = state.request.mock.calls.filter(([path]) => path === "/v2/jobs");
  expect(submissions).toHaveLength(1);
  expect(JSON.parse(submissions[0][1].body)).not.toHaveProperty("wallet");
  expect(submissions[0][1].headers["Idempotency-Key"]).toBeTruthy();
  expect(submissions[0][1].signal.aborted).toBe(false);
  expect(state.connect).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("publishes and unpublishes without signing and uses protected media URLs", async () => {
  await act(async () => root.render(<MusicPage />));
  expect(host.querySelector('a[href="/api/account-media/artifact-one"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click());
  await act(async () => button("Publish").click());
  await act(async () => host.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!.click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/publications", expect.objectContaining({ method: "POST" }));
  expect(state.legacyPublish).not.toHaveBeenCalled(); expect(state.connect).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click());
  await act(async () => button("Unpublish").click());
  expect(state.request).toHaveBeenCalledWith("/v2/music/publications/publication-one", expect.objectContaining({ method: "DELETE" }));
});

it("unblocks the composer when a resumed request is definitively rejected", async () => {
  sessionStorage.setItem("havnai.account-music-request.v1:acct_alice", JSON.stringify({
    key: "pending-request-key-one", body: { type: "text_to_music", prompt: "Original song" },
  }));
  const implementation = state.request.getMockImplementation()!;
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/v2/jobs") throw Object.assign(new Error("Choose a music model"), { code: "model_task_mismatch" });
    return implementation(path, init);
  });
  await act(async () => root.render(<MusicPage />));
  expect(button("Create song").disabled).toBe(true);
  await act(async () => button("Resume song request").click());
  expect(host.textContent).toContain("Choose a music model");
  expect(button("Resume song request")).toBeUndefined();
  expect(button("Create song").disabled).toBe(false);
  expect(sessionStorage.getItem("havnai.account-music-request.v1:acct_alice")).toBeNull();
});

it("clears private songs and aborts old requests on account switch, then gates signed-out access", async () => {
  await act(async () => root.render(<MusicPage />));
  const oldSignal = state.request.mock.calls[0][1].signal;
  state.account = { id: "acct_bob" };
  await act(async () => root.render(<MusicPage />));
  expect(oldSignal.aborted).toBe(true);
  expect(host.textContent).not.toContain("A private song");
  expect(host.textContent).not.toContain("Alice draft");
  expect(host.textContent).not.toContain("Legacy private draft");
  state.signedIn = false; state.account = null; state.request.mockClear();
  await act(async () => root.render(<MusicPage />));
  expect(host.querySelector('a[href="/sign-in"]')).not.toBeNull();
  expect(state.request).not.toHaveBeenCalled(); expect(state.connect).not.toHaveBeenCalled();
});
