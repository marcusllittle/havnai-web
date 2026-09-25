import type { SubmitJobOptions, JobDetailResponse, ResultResponse } from "./havnai";
import type { AccountStudioAccess } from "./musicStudioApi";
import { pendingAccountJob, submitAccountJob } from "./accountJobSubmission";
import { uploadStudioAsset, mediaUrl, type V1Job } from "./videoStudioApi";

const imageTypes: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "image/gif": "gif", "image/avif": "avif",
};

/** Sources are read in the browser; the worker receives only account-owned asset IDs. */
async function uploadImage(source: string, name: string, access: AccountStudioAccess): Promise<string> {
  access.signal.throwIfAborted();
  const url = new URL(source, window.location.origin);
  if (!["https:", "http:", "data:", "blob:"].includes(url.protocol)) {
    throw new Error("Choose an image file or a web image URL.");
  }
  const response = await fetch(url.href, { signal: access.signal, credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not read ${name}. Upload the image file instead.`);
  const blob = await response.blob();
  access.signal.throwIfAborted();
  const extension = imageTypes[blob.type.toLowerCase().split(";", 1)[0]];
  if (!extension || !blob.size) throw new Error(`Choose a PNG, JPEG, WebP, GIF, or AVIF for ${name}.`);
  const asset = await uploadStudioAsset(new File([blob], `${name}.${extension}`, { type: blob.type }), "image", access);
  if (!asset.id || asset.kind !== "image") throw new Error("Could not confirm the uploaded image.");
  return asset.id;
}

export async function submitAccountImage(storage: Storage, account: string, access: AccountStudioAccess,
  input?: { prompt: string; model: string; negativePrompt?: string; options?: SubmitJobOptions }): Promise<V1Job> {
  access = { request: access.request, signal: access.signal };
  access.signal.throwIfAborted();
  if (!input) return submitAccountJob<V1Job>(storage, account, access, "image");
  if (pendingAccountJob(storage, account, "image")) throw new Error("Resume your pending image request before starting another.");
  const options = input.options || {};
  if (options.wallet) throw new Error("Account image requests must use account identity.");
  if (options.inpaintMask && !options.initImage) throw new Error("An edit mask requires a source image.");
  if (options.referenceFaceUrl && options.initImage) throw new Error("Use either a face reference or an image to refine.");
  const body: Record<string, unknown> = { type: "image", prompt: input.prompt, model: input.model,
    negative_prompt: input.negativePrompt || "" };
  for (const key of ["steps", "guidance", "width", "height", "sampler", "seed", "loras"] as const) {
    if (options[key] !== undefined) body[key] = options[key];
  }
  if (options.sfwMode) body.sfw_mode = true;
  if (options.hardcoreMode) body.hardcore_mode = true;
  if (options.initImage) {
    body.source_asset_id = await uploadImage(options.initImage, "source", access);
    body.img2img_strength = options.img2imgStrength;
    body.preserve_reference_aspect = options.preserveReferenceAspect === true;
  }
  if (options.inpaintMask) body.mask_asset_id = await uploadImage(options.inpaintMask, "mask", access);
  if (options.referenceFaceUrl) body.face_asset_id = await uploadImage(options.referenceFaceUrl, "face", access);
  return submitAccountJob<V1Job>(storage, account, access, "image", body);
}

export function accountJobView(job: V1Job, account: string): { job: JobDetailResponse; result: ResultResponse } {
  if (job.owner_account_id !== account) throw new Error("Could not confirm this job belongs to your account.");
  const parameters = job.resolved_spec?.parameters as Record<string, unknown> | undefined;
  const prompts = job.resolved_spec?.prompts as { original?: string } | undefined;
  // Ignore any non-account artifact URL, including legacy public-media fallbacks.
  const artifactUrl = (kind: string) => {
    const artifact = job.artifacts.find(item => item.kind === kind &&
      /^\/v2\/artifacts\/[a-zA-Z0-9_-]+\/content$/.test(item.url || ""));
    return artifact ? mediaUrl(artifact.url) : undefined;
  };
  return {
    job: { id: job.id, model: job.model, status: job.status, stage: job.stage, progress: job.progress,
      timestamp: job.created_at ?? undefined, completed_at: job.completed_at,
      task_type: job.type === "image_to_video" ? "VIDEO_GEN" : job.type === "text_to_music" ? "MUSIC_GEN" : "IMAGE_GEN",
      status_reason: job.error_code || undefined,
      data: { ...parameters, prompt: prompts?.original || parameters?.prompt || "" } },
    result: { job_id: job.id, image_url: artifactUrl("image"), video_url: artifactUrl("video") },
  };
}

export async function fetchAccountJobView(id: string, account: string, access: AccountStudioAccess) {
  const signal = access.signal;
  signal.throwIfAborted();
  const job = await access.request<V1Job>(`/v2/jobs/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
  signal.throwIfAborted();
  return accountJobView(job, account);
}
