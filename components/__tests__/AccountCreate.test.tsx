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
    if (url.endsWith("/models/list")) return { ok: true, json: async () => ({ models: [{ name: "Studio SDXL", tier: "A", available: true, pipeline: "sdxl", task_type: "IMAGE_GEN" }] }) };
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
