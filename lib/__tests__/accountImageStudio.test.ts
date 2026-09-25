import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { accountJobView, fetchAccountJobView, submitAccountImage } from "../accountImageStudio";
import type { V1Job } from "../videoStudioApi";

const account = "acct_alice";
const job: V1Job = { id: "job-one", owner_account_id: account, type: "image", model: "sdxl",
  status: "queued", stage: "queued", progress: 0, resolved_spec: { parameters: { prompt: "A blue sky" } }, artifacts: [] };
beforeEach(() => sessionStorage.clear());
afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });

it("uploads source and mask privately, retains controls, and resumes without repeating uploads", async () => {
  const read = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) }));
  vi.stubGlobal("fetch", read);
  let uploads = 0, submissions = 0;
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/v2/assets") {
      expect((init?.body as FormData).get("kind")).toBe("image");
      return { id: `asset-${++uploads}`, kind: "image" };
    }
    if (++submissions === 1) throw new Error("Connection lost");
    return job;
  }) as any;
  const access = { request, signal: new AbortController().signal };
  await expect(submitAccountImage(sessionStorage, account, access, {
    prompt: "A blue sky", model: "sdxl", negativePrompt: "blur", options: {
      initImage: "/api/account-media/source", inpaintMask: "data:image/png;base64,aW1hZ2U=",
      img2imgStrength: 0.4, preserveReferenceAspect: true, steps: 30, guidance: 6, seed: 42,
      loras: [{ name: "style", weight: 0.5 }], sfwMode: true,
    },
  })).rejects.toThrow("Connection lost");
  const first = request.mock.calls.find(([path]: [string]) => path === "/v2/jobs")[1];
  const body = JSON.parse(first.body);
  expect(body).toMatchObject({ source_asset_id: "asset-1", mask_asset_id: "asset-2", img2img_strength: 0.4,
    preserve_reference_aspect: true, steps: 30, guidance: 6, seed: 42, negative_prompt: "blur", sfw_mode: true,
    loras: [{ name: "style", weight: 0.5 }] });
  expect(body).not.toHaveProperty("wallet"); expect(body).not.toHaveProperty("init_image");
  await expect(submitAccountImage(sessionStorage, account, access)).resolves.toEqual(job);
  expect(uploads).toBe(2); expect(read).toHaveBeenCalledTimes(2);
  const retried = request.mock.calls.filter(([path]: [string]) => path === "/v2/jobs")[1][1];
  expect(retried.body).toBe(first.body);
  expect(retried.headers).toEqual(first.headers);
});

it("does not enqueue when an input cannot be read as an image", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["error page"], { type: "text/html" }) })));
  const request = vi.fn();
  await expect(submitAccountImage(sessionStorage, account, { request, signal: new AbortController().signal },
    { prompt: "Edit", model: "sdxl", options: { initImage: "/missing" } })).rejects.toThrow("Choose a PNG");
  expect(request).not.toHaveBeenCalled();
});

it("stops an old account submission if its scope changes during an upload", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn(async () => {
    controller.abort();
    return { ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) };
  }));
  const request = vi.fn();
  await expect(submitAccountImage(sessionStorage, account, { request, signal: controller.signal },
    { prompt: "Edit", model: "sdxl", options: { initImage: "/image" } })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

it("exposes only protected media and verifies ownership before restoring a job", async () => {
  const completed: V1Job = { ...job, status: "succeeded", artifacts: [
    { id: "public", kind: "image", filename: "public.png", sha256: "", url: "https://example.com/private.png" },
    { id: "private", kind: "image", filename: "private.png", sha256: "", url: "/v2/artifacts/private/content" },
  ] };
  const view = accountJobView(completed, account);
  expect(view.result.image_url).toBe("/api/account-media/private");
  expect(view.job.data.prompt).toBe("A blue sky");
  expect(() => accountJobView(completed, "acct_bob")).toThrow("belongs");
  const request = vi.fn().mockResolvedValue(completed);
  await expect(fetchAccountJobView(job.id, account, { request, signal: new AbortController().signal })).resolves.toEqual(view);
  expect(request.mock.calls[0][0]).toBe("/v2/jobs/job-one");
});
