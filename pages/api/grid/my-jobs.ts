import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import type { V1Job } from "../../../lib/videoStudioApi";

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;

export default async function myGridJobs(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  if (req.headers["sec-fetch-site"] === "cross-site") { res.status(403).end(); return; }
  const offset = req.query.offset ?? "0";
  if (typeof offset !== "string" || !/^\d{1,7}$/.test(offset)) { res.status(400).end(); return; }
  try {
    const auth = getAuth(req);
    const token = auth.userId ? await auth.getToken() : null;
    if (!token) { res.status(401).end(); return; }
    const base = (process.env.HAVNAI_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_HAVNAI_API_BASE || "https://api.joinhavn.io").replace(/\/$/, "");
    const response = await fetch(`${base}/v2/jobs?collection=1&type=visual&sort=newest&limit=8&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { res.status([401, 403].includes(response.status) ? response.status : 502).end(); return; }
    const data = await response.json();
    if (!Array.isArray(data.jobs) || !Number.isSafeInteger(data.total)) { res.status(502).end(); return; }
    // Core scopes this collection to the authenticated account. Media requests
    // independently check the active session, current ownership and deletion.
    const jobs = data.jobs.filter((job: V1Job) => job.owner_account_id && !job.collection_hidden).map((job: V1Job) => {
      const image = job.artifacts?.find(a => a.kind === "image" && idPattern.test(a.id) &&
        a.url === `/v2/artifacts/${a.id}/content`);
      return { job_id: job.id, status: job.status, model: job.model, completed_at: job.completed_at,
        private_preview: image ? `/api/account-media/${image.id}` : null };
    });
    res.status(200).json({ jobs, total: data.total });
  } catch { res.status(503).end(); }
}
