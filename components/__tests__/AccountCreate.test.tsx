import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CreatePage from "../../pages/create";
import { loadLibrary } from "../../lib/libraryStore";

const state = vi.hoisted(() => ({ configured: true, signedIn: true, loading: false, error: "",
  account: { id: "acct_alice" } as { id: string } | null, request: vi.fn(), connect: vi.fn(), sse: vi.fn(),
  router: { isReady: true, query: { prompt: "A blue coast" } as Record<string, string> } }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("next/router", () => ({ useRouter: () => state.router }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ activeWallet: "0xlegacy", connectedWallet: "0xlegacy", source: "connected", connect: state.connect }) }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../JobDetailsDrawer", () => ({ JobDetailsDrawer: () => null }));
vi.mock("../OutputCard", () => ({ OutputCard: ({ imageUrl, onRefineImage }: any) => <div>{imageUrl && <img src={imageUrl} alt="Output" />}<button onClick={onRefineImage}>Refine image</button></div> }));
vi.mock("../../lib/sse", async original => ({ ...await original<typeof import("../../lib/sse")>(), getJobSSE: state.sse }));
const job = { id: "job-image", owner_account_id: "acct_alice", type: "image", model: "Studio SDXL", status: "succeeded",
  stage: "succeeded", progress: 100, created_at: 100, completed_at: 105,
  resolved_spec: { parameters: { prompt: "A blue coast" } },
  artifacts: [{ id: "art-image", kind: "image", filename: "image.png", sha256: "", url: "/v2/artifacts/art-image/content" }] };
let host: HTMLDivElement, root: Root;
const button = (label: string) => [...host.querySelectorAll("button")].find(item => item.textContent?.trim() === label)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear(); sessionStorage.clear();
  state.account = { id: "acct_alice" }; state.signedIn = true;
  state.request.mockReset(); state.connect.mockReset(); state.sse.mockReset();
  state.request.mockImplementation(async (path: string) => {
    if (path === "/v2/account/credits") return { available_units: 10000, scale: 1000 };
    if (path === "/v2/jobs" || path === "/v2/jobs/job-image") return job;
    throw new Error(`Unexpected account request: ${path}`);
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/models/list")) return { ok: true, json: async () => ({ models: [{ name: "Studio SDXL", tier: "A", available: true, pipeline: "sdxl", task_type: "IMAGE_GEN", face_swap_available: true }] }) };
    if (url.includes("/loras/list")) return { ok: true, json: async () => ({ loras: [] }) };
    throw new Error(`Legacy or unexpected request: ${url}`);
  }));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it("generates once without wallet calls and stores account-only recovery and history", async () => {
  localStorage.setItem("havnai_test_history_v1", JSON.stringify([{ jobId: "legacy", prompt: "Private legacy draft", timestamp: 10 }]));
  await act(async () => root.render(<StrictMode><CreatePage /></StrictMode>));
  expect(host.textContent).not.toContain("Private legacy draft");
  expect(host.textContent).toContain("10.0 credits available");
  await act(async () => { button("Generate image").click(); button("Generate image").click(); });
  const submissions = state.request.mock.calls.filter(([path]) => path === "/v2/jobs");
  expect(submissions).toHaveLength(1);
  expect(JSON.parse(submissions[0][1].body)).toMatchObject({ type: "image", prompt: "A blue coast", model: "Studio SDXL" });
  expect(JSON.parse(submissions[0][1].body)).not.toHaveProperty("wallet");
  expect(host.querySelector('img[src="/api/account-media/art-image"]')).not.toBeNull();
  expect(loadLibrary("acct_alice").map(item => item.job_id)).toEqual(["job-image"]);
  expect(loadLibrary()).toEqual([]);
  expect(loadLibrary("acct_bob")).toEqual([]);
  await act(async () => button("Refine image").click());
  expect(host.querySelector<HTMLInputElement>("#image-reference-url")?.value).toBe("/api/account-media/art-image");
  expect(state.connect).not.toHaveBeenCalled(); expect(state.sse).not.toHaveBeenCalled();
});

it("passes account identity tags to the server without a wallet signature", async () => {
  state.router.query = { prompt: "[IDENTITY ANCHOR: pilot] A blue coast" };
  try {
    await act(async () => root.render(<CreatePage />));
    await act(async () => button("Generate image").click());
    const submission = state.request.mock.calls.find(([path]) => path === "/v2/jobs")!;
    expect(JSON.parse(submission[1].body).prompt).toBe("[IDENTITY ANCHOR: pilot] A blue coast");
    expect(state.connect).not.toHaveBeenCalled();
  } finally { state.router.query = { prompt: "A blue coast" }; }
});

it("generates and recovers a single account video without legacy or wallet calls", async () => {
  const publicRead = vi.mocked(fetch).getMockImplementation()!;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/models/list")) return { ok: true, json: async () => ({ models: [{ name: "ltx_video_dev", tier: "A", available: true,
      pipeline: "ltx_video", task_type: "LTX_VIDEO_GEN", capabilities: ["text_to_video"], video_defaults: { width: 640, height: 384, frames: 49, fps: 16 } }] }) };
    return publicRead(url, init);
  }));
  let submissions = 0;
  state.request.mockImplementation(async (path: string) => {
    if (path === "/v2/account/credits") return { available_units: 10000, scale: 1000 };
    if (path === "/v2/jobs" && ++submissions === 1) throw new Error("Connection lost");
    return { ...job, type: "text_to_video", artifacts: [{ id: "art-video", kind: "video", url: "/v2/artifacts/art-video/content" }] };
  });
  await act(async () => root.render(<CreatePage />));
  await act(async () => button("Video").click());
  await act(async () => button("Generate video").click());
  expect(button("Generate video").disabled).toBe(true);
  await act(async () => button("Resume video request").click());
  const posts = state.request.mock.calls.filter(([path]) => path === "/v2/jobs");
  expect(posts).toHaveLength(2);
  expect(posts[1][1].body).toEqual(posts[0][1].body);
  expect(JSON.parse(posts[0][1].body)).toMatchObject({ type: "text_to_video", model: "ltx_video_dev", width: 640, height: 384 });
  expect(JSON.parse(posts[0][1].body)).not.toHaveProperty("wallet");
  expect(state.connect).not.toHaveBeenCalled(); expect(state.sse).not.toHaveBeenCalled();
  expect(loadLibrary("acct_alice")[0].type).toBe("video");
});

it("runs two account clips and saves the private merged result without wallet calls", async () => {
  const publicRead = vi.mocked(fetch).getMockImplementation()!;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/models/list")) return { ok: true, json: async () => ({ models: [{ name: "ltx_video_dev", available: true,
      pipeline: "ltx_video", task_type: "LTX_VIDEO_GEN", capabilities: ["text_to_video", "image_to_video"], video_defaults: { width: 640, height: 384, frames: 49, fps: 16 } }] }) };
    return publicRead(url, init);
  }));
  const chain: any = { id: "chain-one", owner_account_id: "acct_alice", template: { prompt: "Coast" }, total: 2, auto_stitch: true, state: "active", jobs: [] };
  const video = (id: string) => ({ ...job, id, type: "text_to_video", artifacts: [{ id: `art-${id}`, kind: "video", url: `/v2/artifacts/art-${id}/content` }] });
  state.request.mockImplementation(async (path: string) => {
    if (path === "/v2/account/credits") return { available_units: 10000, scale: 1000 };
    if (path === "/v2/video-chains") return chain;
    if (path.endsWith("/next")) {
      const id = `clip-${chain.jobs.length}`;
      chain.jobs.push({ id, index: chain.jobs.length, status: "succeeded" });
      if (chain.jobs.length === 2) chain.state = "rendered";
      return { chain: { ...chain }, job: video(id) };
    }
    if (path.endsWith("/stitch")) return { chain: { ...chain, state: "complete", result_job_id: "merged" }, job: video("merged") };
    if (path === "/v2/video-chains/chain-one") return { ...chain };
    if (path.startsWith("/v2/jobs/")) return video(path.split("/").at(-1)!);
    throw new Error(`Unexpected request ${path}`);
  });
  await act(async () => root.render(<CreatePage />));
  await act(async () => button("Video").click());
  expect(state.request.mock.calls.filter(([path]) => path.includes("video-chains"))).toHaveLength(0);
  await act(async () => host.querySelector<HTMLButtonElement>(".studio-settings-toggle")!.click());
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>("#extend-chunks")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { button("Generate video").click(); button("Generate video").click(); });
  expect(state.request.mock.calls.filter(([path]) => path === "/v2/video-chains")).toHaveLength(1);
  expect(state.request.mock.calls.filter(([path]) => path.endsWith("/next"))).toHaveLength(2);
  expect(state.request.mock.calls.filter(([path]) => path.endsWith("/stitch"))).toHaveLength(1);
  expect(host.textContent).toContain("stitched into a single video");
  expect(loadLibrary("acct_alice").map(item => item.job_id)).toContain("merged");
  expect(state.connect).not.toHaveBeenCalled(); expect(state.sse).not.toHaveBeenCalled();
});

it("stops further sequence submissions while an accepted clip is still running", async () => {
  const chain: any = { id: "chain-one", owner_account_id: "acct_alice", template: { prompt: "Coast" }, total: 2, auto_stitch: true, state: "active", jobs: [] };
  let pollSignal: AbortSignal | undefined;
  state.request.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === "/v2/account/credits") return { available_units: 10000, scale: 1000 };
    if (path.startsWith("/v2/video-chains?")) return { chains: [{ ...chain }] };
    if (path.endsWith("/next")) return { chain, job: { ...job, id: "clip-running", type: "text_to_video", status: "running" } };
    if (path === "/v2/video-chains/chain-one") {
      if (init.method === "DELETE") chain.state = "stopped";
      return { ...chain };
    }
    if (path === "/v2/jobs/clip-running") return new Promise((_, reject) => {
      pollSignal = init.signal!;
      pollSignal.addEventListener("abort", () => reject(pollSignal!.reason), { once: true });
    });
    throw new Error(`Unexpected request ${path}`);
  });
  await act(async () => root.render(<CreatePage />));
  await act(async () => button("Saved video sequences").click());
  await act(async () => button("Resume sequence").click());
  expect(pollSignal).toBeDefined();
  await act(async () => button("Stop remaining clips").click());
  expect(pollSignal!.aborted).toBe(true);
  expect(state.request.mock.calls.filter(([path]) => path.endsWith("/next"))).toHaveLength(1);
  expect(host.textContent).toContain("Sequence stopped. Any submitted clip keeps running.");
  expect(button("Stop remaining clips")).toBeUndefined();
});

it("resumes an ambiguous image request with its original idempotency key", async () => {
  const implementation = state.request.getMockImplementation()!;
  let submissions = 0;
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/v2/jobs" && ++submissions === 1) throw new Error("Connection lost");
    return implementation(path, init);
  });
  await act(async () => root.render(<CreatePage />));
  await act(async () => button("Generate image").click());
  expect(button("Generate image").disabled).toBe(true);
  await act(async () => button("Resume image request").click());
  const posts = state.request.mock.calls.filter(([path]) => path === "/v2/jobs");
  expect(posts).toHaveLength(2);
  expect(posts[1][1].headers).toEqual(posts[0][1].headers);
  expect(posts[1][1].body).toBe(posts[0][1].body);
  expect(button("Generate image").disabled).toBe(false);
});

it("recovers only this account's active image and clears the private view on sign-out", async () => {
  localStorage.setItem("havnai_active_create_job_v1:acct_alice", JSON.stringify({ id: job.id, mode: "image", prompt: "Saved prompt", startedAt: Date.now() }));
  await act(async () => root.render(<StrictMode><CreatePage /></StrictMode>));
  expect(host.querySelector('img[src="/api/account-media/art-image"]')).not.toBeNull();
  const signal = state.request.mock.calls.find(([path]) => path === "/v2/jobs/job-image")![1].signal;
  state.signedIn = false; state.account = null; state.request.mockClear();
  await act(async () => root.render(<CreatePage />));
  expect(signal.aborted).toBe(true);
  expect(host.querySelector('img[src="/api/account-media/art-image"]')).toBeNull();
  expect(host.querySelector('a[href="/sign-in"]')).not.toBeNull();
  expect(state.request).not.toHaveBeenCalled(); expect(state.connect).not.toHaveBeenCalled();
});

it("submits and resumes a face swap with two private uploads and no wallet signature", async () => {
  const publicRead = vi.mocked(fetch).getMockImplementation()!;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/input-")) return { ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) };
    return publicRead(url, init);
  }));
  let uploads = 0, posts = 0;
  state.request.mockImplementation(async (path: string) => {
    if (path === "/v2/account/credits") return { available_units: 10000, scale: 1000 };
    if (path === "/v2/assets") return { id: `asset-${++uploads}`, kind: "image" };
    if (path === "/v2/jobs" && ++posts === 1) throw new Error("Connection lost");
    return { ...job, type: "face_swap" };
  });
  await act(async () => root.render(<CreatePage />));
  await act(async () => button("Face swap").click());
  const setInput = (id: string, value: string) => {
    const element = host.querySelector<HTMLInputElement>(id)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  await act(async () => { setInput("#base-image-url", "/input-base"); setInput("#face-source-url", "/input-face"); });
  await act(async () => { button("Run face swap").click(); button("Run face swap").click(); });
  expect(uploads).toBe(2);
  expect(posts).toBe(1);
  await act(async () => button("Resume face swap").click());
  expect(uploads).toBe(2);
  const submissions = state.request.mock.calls.filter(([path]) => path === "/v2/jobs");
  expect(submissions).toHaveLength(2);
  expect(submissions[1][1].headers).toEqual(submissions[0][1].headers);
  expect(submissions[1][1].body).toEqual(submissions[0][1].body);
  expect(JSON.parse(submissions[0][1].body)).toMatchObject({ type: "face_swap", source_asset_id: "asset-1", face_asset_id: "asset-2" });
  expect(JSON.parse(submissions[0][1].body)).not.toHaveProperty("wallet");
  expect(host.querySelector('img[src="/api/account-media/art-image"]')).not.toBeNull();
  expect(state.connect).not.toHaveBeenCalled();
});
