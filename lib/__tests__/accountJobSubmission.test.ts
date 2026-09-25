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

it("allows editing a definitively rejected request without erasing ambiguous ones", async () => {
  const request = vi.fn().mockRejectedValue(Object.assign(new Error("Not enough credits"), { code: "insufficient_credits" }));
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
