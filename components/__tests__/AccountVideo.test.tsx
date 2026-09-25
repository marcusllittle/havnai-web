import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VideoPage from "../../pages/video-studio";
import { pendingAccountJob } from "../../lib/accountJobSubmission";

const state = vi.hoisted(() => ({ configured: true, loading: false, error: "", account: { id: "alice" } as { id: string } | null, request: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
const job = { id: "video-one", owner_account_id: "alice", type: "image_to_video", status: "succeeded", stage: "succeeded", progress: 100, model: "video-model", resolved_spec: {},
  artifacts: [{ id: "artifact-video", kind: "video", url: "/v2/artifacts/artifact-video/content", filename: "out.mp4" }] };
let root: Root, host: HTMLDivElement;
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === name)!;
const change = (selector: string, value: string) => {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) })));
  state.account = { id: "alice" }; state.request.mockReset();
  sessionStorage.clear(); localStorage.clear();
  sessionStorage.setItem("havnai_studio_key", "legacy-must-not-use");
  localStorage.setItem("havnai_video_studio_job_id", "someone-elses-render");
  window.history.replaceState({}, "", "/video-studio");
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/v2/capabilities") return { models: [{ id: "video-model", available: true, capabilities: ["image_to_video"] }], nodes: [], video_v2_enabled: true, video_v2_available: true };
    if (path.startsWith("/v2/jobs?")) return { jobs: [] };
    if (path === "/v2/assets") return { id: "source-one", kind: "image", filename: "source.png" };
    if (path === "/v2/jobs" && init?.method === "POST") return job;
    if (path === "/v2/jobs/video-one") return job;
    throw new Error(`Unexpected route: ${path}`);
  });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("submits one account-owned clip without reading the legacy studio key or render", async () => {
  await act(async () => root.render(<StrictMode><VideoPage /></StrictMode>));
  expect(host.textContent).toContain("Make your image move.");
  await act(async () => { change("textarea", "A slow pan"); change(".source-fields input", "/source.png"); });
  await act(async () => { button("Generate clip").click(); button("Generate clip").click(); });
  const submissions = state.request.mock.calls.filter(([path, init]) => path === "/v2/jobs" && init?.method === "POST");
  expect(submissions).toHaveLength(1);
  const sent = JSON.parse(submissions[0][1].body);
  expect(sent).toMatchObject({ type: "image_to_video", prompt: "A slow pan", source_asset_id: "source-one", duration_seconds: 5 });
  expect(sent).not.toHaveProperty("wallet");
  expect(submissions[0][1].headers["Idempotency-Key"]).toBeTruthy();
  expect(host.querySelector("video")?.getAttribute("src")).toBe("/api/account-media/artifact-video");
  expect(localStorage.getItem("havnai_video_studio_job_id:alice")).toBe("video-one");
  expect(state.request.mock.calls.some(([path]) => path.includes("someone-elses-render") || path.includes("owner"))).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/source.png", expect.anything());
});

it("resumes a lost submission with the original uploaded asset and idempotency key", async () => {
  const normal = state.request.getMockImplementation()!;
  let first = true;
  state.request.mockImplementation(async (path, init) => {
    if (path === "/v2/jobs" && init?.method === "POST" && first) { first = false; throw new Error("Lost response"); }
    return normal(path, init);
  });
  await act(async () => root.render(<VideoPage />));
  await act(async () => { change("textarea", "A pan"); change(".source-fields input", "/source.png"); });
  await act(async () => button("Generate clip").click());
  const pending = pendingAccountJob(sessionStorage, "alice", "image_to_video")!;
  expect(button("Generate clip").disabled).toBe(true);
  await act(async () => button("Resume video request").click());
  const submissions = state.request.mock.calls.filter(([path, init]) => path === "/v2/jobs" && init?.method === "POST");
  expect(submissions).toHaveLength(2);
  expect(submissions[1][1].body).toBe(submissions[0][1].body);
  expect(submissions[1][1].headers["Idempotency-Key"]).toBe(pending.key);
  expect(state.request.mock.calls.filter(([path]) => path === "/v2/assets")).toHaveLength(1);
  expect(pendingAccountJob(sessionStorage, "alice", "image_to_video")).toBeNull();
  expect(host.querySelector("video")).not.toBeNull();
});

it("recovers an account render after remount and removes its private player on sign-out", async () => {
  localStorage.setItem("havnai_video_studio_job_id:alice", "video-one");
  await act(async () => root.render(<VideoPage />));
  expect(host.querySelector("video")).not.toBeNull();
  const signal = state.request.mock.calls.find(([path]) => path === "/v2/jobs/video-one")![1].signal as AbortSignal;
  state.account = null;
  await act(async () => root.render(<VideoPage />));
  expect(signal.aborted).toBe(true);
  expect(host.querySelector("video")).toBeNull();
  expect(host.querySelector('a[href="/sign-in"]')).not.toBeNull();
  expect(host.querySelector("#studio-access-key")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
