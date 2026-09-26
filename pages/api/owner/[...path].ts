import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import https from "node:https";


export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

const blockedHeaders = new Set([
  "authorization",
  "connection",
  "cookie",
  "host",
  "proxy-authorization",
  "transfer-encoding",
  "x-havnai-studio-key",
]);

function keysMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export default function ownerProxy(req: NextApiRequest, res: NextApiResponse): Promise<void> | void {
  const ownerToken = process.env.HAVNAI_OWNER_TOKEN?.trim();
  const studioKey = process.env.HAVNAI_STUDIO_ACCESS_KEY?.trim();
  if (!ownerToken || !studioKey) {
    res.status(503).json({ error: "owner_api_not_configured" });
    return;
  }
  const providedKey = Array.isArray(req.headers["x-havnai-studio-key"])
    ? req.headers["x-havnai-studio-key"][0]
    : req.headers["x-havnai-studio-key"];
  if (!providedKey || !keysMatch(providedKey, studioKey)) {
    res.status(401).json({ error: "studio_access_denied" });
    return;
  }
  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  if (segments[0] !== "v1") {
    res.status(404).json({ error: "unsupported_owner_path" });
    return;
  }

  const base = (process.env.HAVNAI_API_BASE_URL || "https://api.joinhavn.io").replace(/\/$/, "");
  const target = new URL(`${base}/${segments.map((part) => encodeURIComponent(String(part))).join("/")}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path" || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      target.searchParams.append(key, String(item));
    }
  }

  const headers: http.OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!blockedHeaders.has(key.toLowerCase()) && value !== undefined) {
      headers[key] = value;
    }
  }
  headers.authorization = `Bearer ${ownerToken}`;
  headers.host = target.host;

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    res.once("finish", finish);

    const transport = target.protocol === "https:" ? https : http;
    const upstream = transport.request(
      target,
      { method: req.method, headers, timeout: req.method === "GET" ? 15_000 : 120_000 },
      (upstreamResponse) => {
        res.statusCode = upstreamResponse.statusCode || 502;
        for (const [key, value] of Object.entries(upstreamResponse.headers)) {
          if (value !== undefined && !blockedHeaders.has(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        }
        upstreamResponse.pipe(res);
      }
    );
    upstream.on("timeout", () => upstream.destroy(new Error("owner_api_timeout")));
    upstream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(502).json({ error: "owner_api_unavailable", detail: error.message });
      } else {
        res.end();
      }
    });
    req.pipe(upstream);
  });
}
