import type { VideoJobRequest } from "./havnai";
import type { AccountStudioAccess } from "./musicStudioApi";
import type { V1Job } from "./videoStudioApi";
import { prepareAccountVideo } from "./accountVideoCreate";

export interface AccountVideoChain {
  id: string; owner_account_id: string; template: Record<string, unknown>; total: number; auto_stitch: boolean;
  state: "active" | "failed" | "stopped" | "rendered" | "complete";
  jobs: { id: string; index: number; status: string }[];
  result_job_id?: string | null; result_artifact_id?: string | null;
}
const keyFor = (account: string) => `havnai.account-video-chain-request.v1:${account}`;
export function pendingVideoChain(storage: Storage, account: string): { key: string; body: Record<string, unknown> } | null {
  const raw = storage.getItem(keyFor(account));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value.key !== "string" || value.key.length < 16 || value.key.length > 128 || !value.body?.template ||
      "wallet" in value.body.template || !Number.isInteger(value.body.total) || value.body.total < 2 || value.body.total > 7) throw new Error();
    return value;
  } catch { throw new Error("Your saved video sequence request needs review before another can start."); }
}
export function verifyChain(chain: AccountVideoChain, account: string): AccountVideoChain {
  if (!chain?.id?.startsWith("chain-") || chain.owner_account_id !== account) throw new Error("Could not confirm this video sequence belongs to your account.");
  return chain;
}
export async function createAccountVideoChain(storage: Storage, account: string, access: AccountStudioAccess,
  input?: { request: VideoJobRequest; total: number; autoStitch: boolean }): Promise<AccountVideoChain> {
  access = { request: access.request, signal: access.signal };
  access.signal.throwIfAborted();
  let pending = pendingVideoChain(storage, account);
  if (pending && input) throw new Error("Resume your pending sequence request before starting another.");
  if (!pending) {
    if (!input) throw new Error("There is no pending sequence request.");
    const template = await prepareAccountVideo(input.request, access);
    access.signal.throwIfAborted();
    pending = { key: crypto.randomUUID(), body: { template, total: input.total, auto_stitch: input.autoStitch } };
    storage.setItem(keyFor(account), JSON.stringify(pending));
  }
  try {
    const chain = await access.request<AccountVideoChain>("/v2/video-chains", { method: "POST", signal: access.signal,
      headers: { "Idempotency-Key": pending.key }, body: JSON.stringify(pending.body) });
    access.signal.throwIfAborted(); verifyChain(chain, account);
    storage.removeItem(keyFor(account));
    return chain;
  } catch (reason) {
    const code = reason instanceof Error && "code" in reason ? String(reason.code) : "";
    if (!access.signal.aborted && ["invalid_video_chain", "invalid_payload", "asset_not_found", "invalid_video_source", "invalid_seed",
      "invalid_preset", "invalid_aspect_ratio", "invalid_duration", "invalid_video_dimensions", "invalid_video_width", "invalid_video_height",
      "invalid_video_frames", "invalid_video_fps", "invalid_video_steps", "invalid_video_guidance", "invalid_video_strength", "invalid_video_motion_strength"].includes(code)) {
      storage.removeItem(keyFor(account));
    }
    throw reason;
  }
}

export async function runAccountVideoChain(id: string, account: string, access: AccountStudioAccess, callbacks: {
  onState: (chain: AccountVideoChain, stage: "rendering" | "stitching") => void;
  waitForJob: (job: V1Job, chain: AccountVideoChain, access: AccountStudioAccess) => Promise<boolean>;
}): Promise<{ chain: AccountVideoChain; result: V1Job | null }> {
  access = { request: access.request, signal: access.signal };
  const route = `/v2/video-chains/${encodeURIComponent(id)}`;
  while (true) {
    access.signal.throwIfAborted();
    const chain = verifyChain(await access.request<AccountVideoChain>(route, { signal: access.signal, cache: "no-store" }), account);
    access.signal.throwIfAborted(); callbacks.onState(chain, "rendering");
    if (chain.state === "stopped" || chain.state === "failed") return { chain, result: null };
    if (chain.state === "complete" || chain.state === "rendered") {
      let result: V1Job;
      if (chain.state === "rendered" && chain.auto_stitch) {
        callbacks.onState(chain, "stitching");
        const response = await access.request<{ chain: AccountVideoChain; job: V1Job }>(route + "/stitch", { method: "POST", signal: access.signal });
        access.signal.throwIfAborted(); verifyChain(response.chain, account);
        result = response.job;
        if (result.owner_account_id !== account) throw new Error("Could not confirm the merged video's owner.");
        return { chain: response.chain, result };
      }
      const resultId = chain.result_job_id || chain.jobs.at(-1)?.id;
      if (!resultId) throw new Error("The completed sequence has no saved result.");
      result = await access.request<V1Job>(`/v2/jobs/${encodeURIComponent(resultId)}`, { signal: access.signal });
      access.signal.throwIfAborted();
      if (result.owner_account_id !== account) throw new Error("Could not confirm the video's owner.");
      return { chain, result };
    }
    const next = await access.request<{ chain: AccountVideoChain; job?: V1Job }>(route + "/next", { method: "POST", signal: access.signal });
    access.signal.throwIfAborted(); verifyChain(next.chain, account);
    if (!next.job) {
      if (next.chain.state === "active") throw new Error("The sequence did not return a clip. Resume to check its status.");
      continue;
    }
    if (next.job.owner_account_id !== account) throw new Error("Could not confirm the clip's owner.");
    callbacks.onState(next.chain, "rendering");
    const finished = await callbacks.waitForJob(next.job, next.chain, access);
    access.signal.throwIfAborted();
    if (!finished) return { chain: next.chain, result: null };
  }
}
