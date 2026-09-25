import type { AccountStudioAccess, MusicJob } from "./musicStudioApi";

interface PendingJob { key: string; body: Record<string, unknown> }
const storageKey = (account: string) => `havnai.account-music-request.v1:${account}`;

export function pendingAccountMusicJob(storage: Storage, account: string): PendingJob | null {
  const raw = storage.getItem(storageKey(account));
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as PendingJob;
    if (typeof pending.key !== "string" || pending.key.length < 16 || pending.key.length > 128 ||
        !pending.body || pending.body.type !== "text_to_music" || "wallet" in pending.body) throw new Error();
    return pending;
  } catch { throw new Error("The saved song request needs review before another song can be submitted."); }
}

/** Persist the original request before sending, then reuse it after an ambiguous failure. */
export async function submitAccountMusicJob(storage: Storage, account: string, access: AccountStudioAccess,
  body?: Record<string, unknown>): Promise<MusicJob> {
  let pending = pendingAccountMusicJob(storage, account);
  if (pending && body) throw new Error("Resume your pending song request before starting another song.");
  if (!pending) {
    if (!body) throw new Error("There is no pending song request.");
    pending = { key: crypto.randomUUID(), body };
    storage.setItem(storageKey(account), JSON.stringify(pending));
  }
  access.signal.throwIfAborted();
  try {
    const job = await access.request<MusicJob>("/v2/jobs", { method: "POST", signal: access.signal,
      headers: { "Idempotency-Key": pending.key }, body: JSON.stringify(pending.body) });
    access.signal.throwIfAborted();
    if (!job.id || job.owner_account_id !== account) throw new Error("Could not confirm this song's owner. Resume the request to check it.");
    storage.removeItem(storageKey(account));
    return job;
  } catch (reason) {
    // Only explicit pre-enqueue failures may discard an intent. Unknown failures keep it.
    const code = reason instanceof Error && "code" in reason ? String(reason.code) : "";
    if (!access.signal.aborted && ["insufficient_credits", "invalid_payload", "invalid_asset", "asset_not_found",
      "unsupported_type", "unknown_model", "invalid_duration", "invalid_bpm", "invalid_seed",
      "source_audio_required", "mode_unsupported_by_model", "invalid_repaint_range", "invalid_track_classes"].includes(code)) {
      storage.removeItem(storageKey(account));
    }
    throw reason;
  }
}
