import type { VideoJobRequest } from "./havnai";
import type { AccountStudioAccess } from "./musicStudioApi";
import type { V1Job, V1Asset } from "./videoStudioApi";
import { uploadImage } from "./accountImageStudio";
import { pendingAccountJob, submitAccountJob } from "./accountJobSubmission";

export async function extractAccountVideoLastFrame(jobId: string, access: AccountStudioAccess): Promise<string> {
  const signal = access.signal;
  signal.throwIfAborted();
  const asset = await access.request<V1Asset>(`/v2/jobs/${encodeURIComponent(jobId)}/last-frame`, { method: "POST", signal });
  signal.throwIfAborted();
  if (asset.kind !== "image" || !/^asset-[a-zA-Z0-9_-]+$/.test(asset.id || "")) throw new Error("Could not confirm the continuation image.");
  return asset.id;
}

export async function submitAccountCreateVideo(storage: Storage, account: string, access: AccountStudioAccess, input?: VideoJobRequest & { sourceAssetId?: string }): Promise<V1Job> {
  access = { request: access.request, signal: access.signal };
  access.signal.throwIfAborted();
  if (!input) return submitAccountJob(storage, account, access, "create_video");
  if (pendingAccountJob(storage, account, "create_video")) throw new Error("Resume your pending video request before starting another.");
  if (input.wallet) throw new Error("Account video requests must use account identity.");
  if (input.sourceAssetId && input.initImage) throw new Error("Choose one starting image for this clip.");
  if (input.referenceImage) throw new Error("Reference-sheet video is still being connected to accounts. Use a starting image for this clip.");
  const body: Record<string, unknown> = { type: input.initImage || input.sourceAssetId ? "image_to_video" : "text_to_video",
    prompt: input.prompt, model: input.model, negative_prompt: input.negativePrompt || "", sfw_mode: input.sfwMode === true };
  for (const key of ["seed", "steps", "guidance", "width", "height", "frames", "fps", "strength"] as const) {
    if (input[key] !== undefined) body[key] = input[key];
  }
  if (input.initImage) body.source_asset_id = await uploadImage(input.initImage, "video-source", access);
  if (input.sourceAssetId) body.source_asset_id = input.sourceAssetId;
  // Create's workflow presets populate the numeric controls above.
  return submitAccountJob(storage, account, access, "create_video", body);
}
