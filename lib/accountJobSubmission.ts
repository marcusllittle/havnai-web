import type { AccountStudioAccess, MusicJob } from "./musicStudioApi";

interface PendingJob { key: string; body: Record<string, unknown> }
type JobKind = "text_to_music" | "image_to_video" | "image";
const storageKey = (account: string, kind: JobKind) => `havnai.account-${kind === "text_to_music" ? "music" : kind === "image_to_video" ? "video" : "image"}-request.v1:${account}`;

export function pendingAccountMusicJob(storage: Storage, account: string): PendingJob | null {
  return pendingAccountJob(storage, account, "text_to_music");
}

export function pendingAccountJob(storage: Storage, account: string, kind: JobKind): PendingJob | null {
  const raw = storage.getItem(storageKey(account, kind));
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as PendingJob;
    if (typeof pending.key !== "string" || pending.key.length < 16 || pending.key.length > 128 ||
        !pending.body || pending.body.type !== kind || "wallet" in pending.body) throw new Error();
    return pending;
  } catch { throw new Error("The saved generation request needs review before another request can be submitted."); }
}

/** Persist the original request before sending, then reuse it after an ambiguous failure. */
export async function submitAccountMusicJob(storage: Storage, account: string, access: AccountStudioAccess,
  body?: Record<string, unknown>): Promise<MusicJob> {
  return submitAccountJob<MusicJob>(storage, account, access, "text_to_music", body);
}

export async function submitAccountJob<T extends { id: string; owner_account_id?: string }>(storage: Storage, account: string,
  access: AccountStudioAccess, kind: JobKind, body?: Record<string, unknown>): Promise<T> {
  let pending = pendingAccountJob(storage, account, kind);
  if (pending && body) throw new Error("Resume your pending generation request before starting another.");
  if (!pending) {
    if (!body || body.type !== kind) throw new Error("There is no valid pending generation request.");
    pending = { key: crypto.randomUUID(), body };
    storage.setItem(storageKey(account, kind), JSON.stringify(pending));
  }
  access.signal.throwIfAborted();
  try {
    const job = await access.request<T>("/v2/jobs", { method: "POST", signal: access.signal,
      headers: { "Idempotency-Key": pending.key }, body: JSON.stringify(pending.body) });
    access.signal.throwIfAborted();
    if (!job.id || job.owner_account_id !== account) throw new Error("Could not confirm this generation's owner. Resume the request to check it.");
    storage.removeItem(storageKey(account, kind));
    return job;
  } catch (reason) {
    // Only explicit pre-enqueue failures may discard an intent. Unknown failures keep it.
    const code = reason instanceof Error && "code" in reason ? String(reason.code) : "";
    if (!access.signal.aborted && ["insufficient_credits", "invalid_payload", "invalid_asset", "asset_not_found",
      "unsupported_type", "unknown_model", "model_task_mismatch", "invalid_duration", "invalid_bpm", "invalid_seed",
      "source_audio_required", "source_image_required", "missing_prompt", "invalid_job_type", "feature_disabled",
      "mode_unsupported_by_model", "invalid_repaint_range", "invalid_track_classes"].includes(code)) {
      storage.removeItem(storageKey(account, kind));
    }
    throw reason;
  }
}
