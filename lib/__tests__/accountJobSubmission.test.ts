import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pendingAccountMusicJob, submitAccountMusicJob } from "../accountJobSubmission";

const body = { type: "text_to_music", prompt: "An ocean song" };
const job = { id: "job-one", owner_account_id: "acct_alice" };
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("retains one request after a lost response and resumes it after remount", async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(job);
  const access = { request, signal: new AbortController().signal };
  await expect(submitAccountMusicJob(sessionStorage, "acct_alice", access, body)).rejects.toThrow("Connection lost");
  const first = request.mock.calls[0][1];
  await expect(submitAccountMusicJob(sessionStorage, "acct_alice", access, { ...body, prompt: "New song" })).rejects.toThrow("Resume");
  expect(request).toHaveBeenCalledTimes(1);
  expect(await submitAccountMusicJob(sessionStorage, "acct_alice", access)).toEqual(job);
  expect(request.mock.calls[1][1].headers).toEqual(first.headers);
  expect(request.mock.calls[1][1].body).toEqual(first.body);
  expect(pendingAccountMusicJob(sessionStorage, "acct_alice")).toBeNull();
});

it("isolates pending requests by account and retains ambiguous response ownership", async () => {
  const request = vi.fn().mockResolvedValue({ ...job, owner_account_id: "acct_other" });
  const access = { request, signal: new AbortController().signal };
  await expect(submitAccountMusicJob(sessionStorage, "acct_alice", access, body)).rejects.toThrow("owner");
  expect(pendingAccountMusicJob(sessionStorage, "acct_bob")).toBeNull();
  expect(pendingAccountMusicJob(sessionStorage, "acct_alice")).not.toBeNull();
});

it.each(["insufficient_credits", "model_task_mismatch", "owned_image_asset_required", "invalid_face_conditioning", "invalid_image_strength",
  "identity_anchor_not_found", "invalid_identity_anchor_tag", "invalid_preset", "invalid_aspect_ratio",
  "invalid_video_dimensions", "invalid_video_width", "invalid_video_height", "invalid_video_fps", "invalid_video_frames",
  "invalid_video_steps", "invalid_video_guidance", "invalid_video_motion_strength", "invalid_video_strength"])("allows editing after definitive rejection: %s", async (code) => {
  const request = vi.fn().mockRejectedValue(Object.assign(new Error("Request rejected"), { code }));
  await expect(submitAccountMusicJob(sessionStorage, "acct_alice", { request, signal: new AbortController().signal }, body)).rejects.toThrow();
  expect(pendingAccountMusicJob(sessionStorage, "acct_alice")).toBeNull();
});

it("does not send when storage is blocked or the account changes", async () => {
  const request = vi.fn();
  const controller = new AbortController(); controller.abort();
  await expect(submitAccountMusicJob(sessionStorage, "acct_alice", { request, signal: controller.signal }, body)).rejects.toThrow();
  sessionStorage.clear();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  await expect(submitAccountMusicJob(sessionStorage, "acct_alice", { request, signal: new AbortController().signal }, body)).rejects.toThrow("blocked");
  expect(request).not.toHaveBeenCalled();
});
