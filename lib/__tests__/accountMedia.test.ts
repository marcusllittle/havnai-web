// @vitest-environment node
import { Writable } from "node:stream";
import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import accountMedia from "../../pages/api/account-media/[artifact]";

const auth = vi.hoisted(() => ({ userId: "user_alice" as string | null, getToken: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ getAuth: () => auth }));

class ResponseSink extends Writable {
  statusCode = 200;
  headersSent = false;
  headers = new Map<string, unknown>();
  chunks: Buffer[] = [];
  setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); return this; }
  status(code: number) { this.statusCode = code; return this; }
  json(value: unknown) { this.end(JSON.stringify(value)); return this; }
  _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) { this.headersSent = true; this.chunks.push(Buffer.from(chunk)); callback(); }
  get body() { return Buffer.concat(this.chunks).toString(); }
}

async function call(extra: Record<string, unknown> = {}) {
  const res = new ResponseSink();
  await accountMedia({ method: "GET", query: { artifact: "artifact-one" }, headers: {}, ...extra } as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}
beforeEach(() => { auth.userId = "user_alice"; auth.getToken.mockReset().mockResolvedValue("fixture-account-token"); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

it("streams a range with only the verified account token and private response headers", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("audio", { status: 206, headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-4/100", "set-cookie": "must-not-forward", "cache-control": "public" } }));
  const res = await call({ headers: { range: "bytes=0-4", cookie: "private", authorization: "Bearer forged", "x-havnai-studio-key": "legacy" } });
  expect(res.statusCode).toBe(206); expect(res.body).toBe("audio");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/v2/artifacts/artifact-one/content"), expect.objectContaining({
    headers: { Authorization: "Bearer fixture-account-token", Range: "bytes=0-4" }, redirect: "error", cache: "no-store",
  }));
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("vary")).toBe("Cookie");
  expect(res.headers.has("set-cookie")).toBe(false);
});

it("rejects signed-out, invalid paths, cross-site requests, and mutations before core", async () => {
  auth.userId = null;
  expect((await call()).statusCode).toBe(401);
  auth.userId = "user_alice";
  expect((await call({ query: { artifact: "../private" } })).statusCode).toBe(404);
  expect((await call({ method: "POST" })).statusCode).toBe(405);
  expect((await call({ headers: { "sec-fetch-site": "cross-site" } })).statusCode).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves ownership denial without returning the upstream body or falling back", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("sensitive provider detail", { status: 404 }));
  const res = await call();
  expect(res.statusCode).toBe(404);
  expect(res.body).not.toContain("sensitive");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not serve HTML as private media or leak HTML range errors", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("<script>bad</script>", { headers: { "content-type": "text/html" } }));
  expect((await call()).statusCode).toBe(415);
  vi.mocked(fetch).mockResolvedValueOnce(new Response("<html>range error</html>", { status: 416, headers: { "content-range": "bytes */100" } }));
  const res = await call();
  expect(res.statusCode).toBe(416); expect(res.body).toBe("");
  expect(res.headers.get("content-range")).toBe("bytes */100");
});
