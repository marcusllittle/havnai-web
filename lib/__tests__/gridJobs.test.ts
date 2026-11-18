// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import myGridJobs from "../../pages/api/grid/my-jobs";

const auth = vi.hoisted(() => ({ userId: "test-user" as string | null, getToken: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ getAuth: () => auth }));
beforeEach(() => {
  auth.userId = "test-user";
  auth.getToken.mockResolvedValue("test-token");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

async function read(extra: object = {}) {
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() };
  await myGridJobs({ method: "GET", query: {}, headers: {}, ...extra } as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

it("rejects signed-out and cross-site requests without requesting any media", async () => {
  expect((await read({ headers: { "sec-fetch-site": "cross-site" } })).status).toHaveBeenCalledWith(403);
  auth.userId = null;
  expect((await read()).status).toHaveBeenCalledWith(401);
  expect(fetch).not.toHaveBeenCalled();
});

it("projects only collection fields and same-job authenticated media", async () => {
  const job = { id: "first", owner_account_id: "acct-fixture", status: "succeeded", model: "model",
    resolved_spec: { prompt: "private" }, artifacts: [{ id: "a", kind: "image", url: "/v2/artifacts/a/content" }] };
  vi.mocked(fetch).mockResolvedValue(Response.json({ total: 2, jobs: [job,
    { ...job, id: "second", artifacts: [{ id: "b", kind: "image", url: "/static/outputs/file.png" }] }] }));
  const res = await read({ query: { offset: "8" }, headers: { authorization: "ignored" } });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/v2/jobs?collection=1&type=visual&sort=newest&limit=8&offset=8"),
    expect.objectContaining({ headers: { Authorization: "Bearer test-token" }, cache: "no-store", redirect: "error" }));
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  expect(res.json.mock.calls[0][0]).toEqual({ total: 2, jobs: [
    { job_id: "first", status: "succeeded", model: "model", private_preview: "/api/account-media/a" },
    { job_id: "second", status: "succeeded", model: "model", private_preview: null }] });
});
