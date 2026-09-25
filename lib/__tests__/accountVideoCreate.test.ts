import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { submitAccountCreateVideo } from "../accountVideoCreate";
import { pendingAccountJob } from "../accountJobSubmission";

const job = { id: "video-job", owner_account_id: "alice" };
beforeEach(() => sessionStorage.clear());
afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });

it("uploads the source once and recovers the original video request after a lost response", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) })));
  let uploads = 0, submissions = 0;
  const request = vi.fn(async (path: string) => {
    if (path === "/v2/assets") return { id: `asset-${++uploads}`, kind: "image" };
    if (++submissions === 1) throw new Error("Lost response");
    return job;
  }) as any;
  const access = { request, signal: new AbortController().signal };
  await expect(submitAccountCreateVideo(sessionStorage, "alice", access, { prompt: "Clouds", model: "ltx", initImage: "/api/account-media/image",
    width: 640, height: 512, frames: 97, fps: 24, guidance: 0, steps: 20, seed: 0, strength: 0.4, negativePrompt: "blur", sfwMode: true })).rejects.toThrow("Lost response");
  expect(pendingAccountJob(sessionStorage, "alice", "create_video")).not.toBeNull();
  expect(pendingAccountJob(sessionStorage, "alice", "image_to_video")).toBeNull();
  await submitAccountCreateVideo(sessionStorage, "alice", access);
  expect(uploads).toBe(1);
  const posts = request.mock.calls.filter(([path]: [string]) => path === "/v2/jobs");
  expect(posts[1][1].body).toBe(posts[0][1].body);
  expect(posts[1][1].headers).toEqual(posts[0][1].headers);
  expect(JSON.parse(posts[0][1].body)).toMatchObject({ type: "image_to_video", source_asset_id: "asset-1", guidance: 0, seed: 0, sfw_mode: true, strength: 0.4 });
  expect(JSON.parse(posts[0][1].body)).not.toHaveProperty("wallet");
  expect(JSON.parse(posts[0][1].body)).not.toHaveProperty("init_image");
});

it("uses the text-to-video contract when no source is supplied", async () => {
  const request = vi.fn().mockResolvedValue(job);
  await submitAccountCreateVideo(sessionStorage, "alice", { request, signal: new AbortController().signal }, { prompt: "Clouds", model: "ltx" });
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ type: "text_to_video", prompt: "Clouds" });
});

it("allows correcting a rejected video source without losing ambiguous requests", async () => {
  const request = vi.fn().mockRejectedValue(Object.assign(new Error("Invalid source"), { code: "invalid_video_source" }));
  await expect(submitAccountCreateVideo(sessionStorage, "alice", { request, signal: new AbortController().signal }, { prompt: "Clouds", model: "ltx" })).rejects.toThrow();
  expect(pendingAccountJob(sessionStorage, "alice", "create_video")).toBeNull();
});

it("stops before reading a private image after the account scope is aborted", async () => {
  const request = vi.fn(), read = vi.fn(); vi.stubGlobal("fetch", read);
  const controller = new AbortController(); controller.abort();
  await expect(submitAccountCreateVideo(sessionStorage, "alice", { request, signal: controller.signal }, { prompt: "Clouds", initImage: "/private", model: "ltx" })).rejects.toThrow();
  expect(read).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});
