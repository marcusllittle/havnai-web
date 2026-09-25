import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const config = { api: { responseLimit: false } };

/** Cookie-authenticated media streaming; core still checks artifact ownership. */
export default async function accountMedia(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD"); res.status(405).end(); return;
  }
  const artifact = req.query.artifact;
  if (typeof artifact !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(artifact)) {
    res.status(404).json({ error: "artifact_not_found" }); return;
  }
  // Do not allow a cross-site page to trigger authenticated private downloads.
  if (req.headers["sec-fetch-site"] === "cross-site") { res.status(403).end(); return; }
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.once("close", disconnect);
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "account_required" }); return; }
    const token = await auth.getToken();
    if (!token) { res.status(401).json({ error: "account_required" }); return; }
    const base = (process.env.HAVNAI_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_HAVNAI_API_BASE || "https://api.joinhavn.io").replace(/\/$/, "");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (typeof req.headers.range === "string") headers.Range = req.headers.range;
    const upstream = await fetch(`${base}/v2/artifacts/${artifact}/content`, {
      method: req.method, headers, signal: controller.signal, cache: "no-store", redirect: "error",
    });
    if (![200, 206, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      res.status([401, 403, 404, 410].includes(upstream.status) ? upstream.status : 502).json({ error: "media_unavailable" }); return;
    }
    res.statusCode = upstream.status;
    if (upstream.status === 416) {
      const range = upstream.headers.get("content-range");
      if (range) res.setHeader("Content-Range", range);
      await upstream.body?.cancel(); res.end(); return;
    }
    const contentType = (upstream.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    const safeMedia = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif",
      "video/mp4", "video/webm", "video/quicktime", "video/ogg", "application/ogg"]);
    if (!contentType.startsWith("audio/") && !safeMedia.has(contentType)) {
      await upstream.body?.cancel(); res.status(415).json({ error: "unsupported_media_type" }); return;
    }
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (req.method === "HEAD" || !upstream.body) { res.end(); return; }
    await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch {
    if (!res.headersSent && !res.destroyed) res.status(503).json({ error: "media_unavailable" });
    else if (!res.writableEnded) res.end();
  } finally {
    clearTimeout(timer); res.off("close", disconnect);
  }
}
