import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAccountVideoChain, pendingVideoChain, runAccountVideoChain, type AccountVideoChain } from "../accountVideoChains";
const base: AccountVideoChain = { id: "chain-one", owner_account_id: "alice", template: { prompt: "Coast" }, total: 2,
  auto_stitch: true, state: "active", jobs: [] };
beforeEach(() => sessionStorage.clear());
afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });

it("recovers a lost plan response with the same upload, settings, and key", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["face"], { type: "image/png" }) })));
  let uploads = 0, posts = 0;
  const request = vi.fn(async (path: string) => {
    if (path === "/v2/assets") return { id: `asset-${++uploads}`, kind: "image" };
    if (++posts === 1) throw new Error("Connection lost");
    return base;
  }) as any;
  const access = { request, signal: new AbortController().signal };
  await expect(createAccountVideoChain(sessionStorage, "alice", access, {
    request: { prompt: "Coast", model: "ltx", initImage: "/private/image" }, total: 2, autoStitch: true,
  })).rejects.toThrow("Connection lost");
  expect(pendingVideoChain(sessionStorage, "alice")).not.toBeNull();
  expect(pendingVideoChain(sessionStorage, "bob")).toBeNull();
  await createAccountVideoChain(sessionStorage, "alice", access);
  expect(uploads).toBe(1);
  const calls = request.mock.calls.filter(([path]: [string]) => path === "/v2/video-chains");
  expect(calls[0][1].headers).toEqual(calls[1][1].headers);
  expect(calls[0][1].body).toBe(calls[1][1].body);
  expect(pendingVideoChain(sessionStorage, "alice")).toBeNull();
});

it("waits for each clip and stitches only after the entire chain succeeds", async () => {
  let chain = { ...base, jobs: [] } as AccountVideoChain;
  const request = vi.fn(async (path: string) => {
    if (path.endsWith("/next")) {
      const index = chain.jobs.length;
      chain = { ...chain, jobs: [...chain.jobs, { id: `clip-${index}`, index, status: "queued" }] };
      return { chain, job: { id: `clip-${index}`, owner_account_id: "alice" } };
    }
    if (path.endsWith("/stitch")) return { chain: { ...chain, state: "complete", result_job_id: "merged" }, job: { id: "merged", owner_account_id: "alice" } };
    return chain;
  }) as any;
  const waitForJob = vi.fn(async () => {
    chain = { ...chain, state: chain.jobs.length === 2 ? "rendered" : "active", jobs: chain.jobs.map(job => ({ ...job, status: "succeeded" })) };
    return true;
  });
  const result = await runAccountVideoChain(base.id, "alice", { request, signal: new AbortController().signal }, { onState: vi.fn(), waitForJob });
  expect(waitForJob).toHaveBeenCalledTimes(2);
  expect(result.result?.id).toBe("merged");
  expect(request.mock.calls.filter(([path]: [string]) => path.endsWith("/next"))).toHaveLength(2);
  expect(request.mock.calls.filter(([path]: [string]) => path.endsWith("/stitch"))).toHaveLength(1);
});

it("does not submit another clip after the account or running sequence is aborted", async () => {
  const controller = new AbortController();
  const request = vi.fn(async (path: string) => path.endsWith("/next") ? { chain: base, job: { id: "clip", owner_account_id: "alice" } } : base) as any;
  await expect(runAccountVideoChain(base.id, "alice", { request, signal: controller.signal }, {
    onState: vi.fn(), waitForJob: async () => { controller.abort(); return true; },
  })).rejects.toThrow();
  expect(request.mock.calls.filter(([path]: [string]) => path.endsWith("/next"))).toHaveLength(1);
});

it.each(["stopped", "failed"] as const)("never advances a %s sequence", async state => {
  const request = vi.fn().mockResolvedValue({ ...base, state });
  const result = await runAccountVideoChain(base.id, "alice", { request, signal: new AbortController().signal }, { onState: vi.fn(), waitForJob: vi.fn() });
  expect(result.result).toBeNull(); expect(request).toHaveBeenCalledOnce();
});

it("rejects another account's sequence before any mutation", async () => {
  const request = vi.fn().mockResolvedValue({ ...base, owner_account_id: "bob" });
  await expect(runAccountVideoChain(base.id, "alice", { request, signal: new AbortController().signal }, { onState: vi.fn(), waitForJob: vi.fn() })).rejects.toThrow("belongs");
  expect(request).toHaveBeenCalledOnce();
});
