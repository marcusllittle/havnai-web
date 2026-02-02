import type { NextPage } from "next";
import { getInviteCode } from "./invite";

// Simple API helper for talking to the HavnAI coordinator.
// Uses relative URLs so it works behind whatever proxy is fronting the core.

export interface SubmitJobResponse {
  job_id?: string;
  status?: string;
  error?: string;
  message?: string;
}

export interface JobDetail {
  id: string;
  status: string;
  model: string;
  wallet?: string;
  task_type?: string;
  node_id?: string;
  timestamp?: number;
  completed_at?: number | null;
  reward?: number;
  reward_factors?: Record<string, unknown>;
  data?: any;
}

export interface JobDetailResponse extends JobDetail {}

export interface ResultResponse {
  job_id: string;
  image_url?: string;
  video_url?: string;
  error?: string;
}

export interface LoraConfig {
  name: string;
  weight?: number;
}

export interface FaceSwapRequest {
  baseImageUrl: string;
  faceSourceUrl: string;
  prompt?: string;
  model?: string;
  strength?: number;
  numSteps?: number;
  loras?: LoraConfig[];
  seed?: number;
}

export interface WanVideoRequest {
  prompt: string;
  negativePrompt?: string;
  motionType?: string;
  loraList?: string[];
  initImageB64?: string;
  duration?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface VideoJobRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  seed?: number;
  steps?: number;
  guidance?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  initImage?: string;
  extendChunks?: number;
}

export interface WanVideoStatus {
  job_id: string;
  status?: string;
  error?: string;
  video_path?: string;
  video_url?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface QuotaStatus {
  max_daily: number;
  used_today: number;
  max_concurrent: number;
  used_concurrent: number;
  reset_at: string;
}

export class HavnaiApiError extends Error {
  code?: string;
  data?: Record<string, any>;
  status?: number;
  constructor(message: string, code?: string, data?: Record<string, any>, status?: number) {
    super(message);
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

export interface SubmitJobOptions {
  steps?: number;
  guidance?: number;
  width?: number;
  height?: number;
  sampler?: string;
  seed?: number;
  loras?: LoraConfig[];
  autoAnatomy?: boolean;
}

function getApiBase(): string {
  const envBase =
    process.env.NEXT_PUBLIC_HAVNAI_API_BASE && process.env.NEXT_PUBLIC_HAVNAI_API_BASE.length > 0
      ? process.env.NEXT_PUBLIC_HAVNAI_API_BASE
      : undefined;

  if (typeof window !== "undefined") {
    const origin = window.location.origin || "";
    const isLocalhost =
      origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");

    if (isLocalhost && envBase) {
      return envBase;
    }

    return "/api";
  }

  return envBase || "/api";
}

// Wallet used when submitting jobs from the /test page.
// Configure NEXT_PUBLIC_HAVNAI_WALLET in .env.local to point to your real EVM address.
const WALLET =
  process.env.NEXT_PUBLIC_HAVNAI_WALLET && process.env.NEXT_PUBLIC_HAVNAI_WALLET.length > 0
    ? process.env.NEXT_PUBLIC_HAVNAI_WALLET
    : "0x0000000000000000000000000000000000000000";

function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}

export function resolveAssetUrl(path: string | undefined | null): string | undefined {
  if (!path) return undefined;
  // If already absolute (http/https), return as-is.
  if (/^https?:\/\//i.test(path)) return path;
  // If already routed through the API proxy, leave it alone.
  if (path.startsWith("/api/")) return path;
  // Otherwise, prefix with API_BASE so we hit the coordinator, not the Next dev server.
  return `${getApiBase()}${path}`;
}

function buildHeaders(includeInvite = false): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (includeInvite) {
    const invite = getInviteCode();
    if (invite) {
      headers["X-INVITE-CODE"] = invite;
    }
  }
  return headers;
}

async function parseErrorResponse(res: Response): Promise<HavnaiApiError> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      const code = data?.error;
      const message = data?.message || data?.error || `request failed: ${res.status}`;
      return new HavnaiApiError(message, code, data, res.status);
    } catch {
      // fall through
    }
  }
  const text = await res.text();
  return new HavnaiApiError(`request failed: ${res.status} ${text}`, undefined, undefined, res.status);
}

export async function submitAutoJob(
  prompt: string,
  modelOverride?: string,
  negativePrompt?: string,
  options?: SubmitJobOptions
): Promise<string> {
  const model =
    modelOverride && modelOverride.trim().length > 0
      ? modelOverride.trim()
      : "auto";

  const body: Record<string, any> = {
    wallet: WALLET,
    model,
    prompt,
  };
  const trimmedNegative = negativePrompt?.trim();
  if (trimmedNegative) {
    body.negative_prompt = trimmedNegative;
  }
  if (options) {
    if (options.steps != null) body.steps = options.steps;
    if (options.guidance != null) body.guidance = options.guidance;
    if (options.width != null) body.width = options.width;
    if (options.height != null) body.height = options.height;
    if (options.seed != null) body.seed = options.seed;
    if (options.sampler && options.sampler.trim().length > 0) {
      body.sampler = options.sampler;
    }
    if (options.loras && options.loras.length > 0) {
      body.loras = options.loras;
    }
    if (options.autoAnatomy != null) {
      body.auto_anatomy = options.autoAnatomy;
    }
  }

  const res = await fetch(apiUrl("/submit-job"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new HavnaiApiError(json.message || json.error || "No job_id returned from submit-job");
  }
  return json.job_id;
}

export async function submitFaceSwapJob(request: FaceSwapRequest): Promise<string> {
  const model =
    request.model && request.model.trim().length > 0 ? request.model.trim() : "epicrealismXL_vxviiCrystalclear";

  const body: Record<string, any> = {
    wallet: WALLET,
    model,
    prompt: request.prompt || "",
    base_image_url: request.baseImageUrl,
    face_source_url: request.faceSourceUrl,
  };
  if (request.strength != null) body.strength = request.strength;
  if (request.numSteps != null) body.num_steps = request.numSteps;
  if (request.seed != null) body.seed = request.seed;
  if (request.loras && request.loras.length > 0) {
    body.loras = request.loras;
  }

  const res = await fetch(apiUrl("/submit-faceswap-job"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new HavnaiApiError(json.message || json.error || "No job_id returned from submit-faceswap-job");
  }
  return json.job_id;
}

export async function submitWanVideoJob(request: WanVideoRequest): Promise<string> {
  const body: Record<string, any> = {
    prompt: request.prompt,
    wallet: WALLET,
  };
  if (request.negativePrompt) body.negative_prompt = request.negativePrompt;
  if (request.motionType) body.motion_type = request.motionType;
  if (request.loraList && request.loraList.length > 0) body.lora_list = request.loraList;
  if (request.initImageB64) body.init_image = request.initImageB64;
  if (request.duration != null) body.duration = request.duration;
  if (request.fps != null) body.fps = request.fps;
  if (request.width != null) body.width = request.width;
  if (request.height != null) body.height = request.height;

  const res = await fetch(apiUrl("/generate-video"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new HavnaiApiError(json.message || json.error || "No job_id returned from generate-video");
  }
  return json.job_id;
}

export async function submitVideoJob(request: VideoJobRequest): Promise<string> {
  const model =
    request.model && request.model.trim().length > 0 ? request.model.trim() : "ltx2";

  const body: Record<string, any> = {
    wallet: WALLET,
    model,
    prompt: request.prompt,
  };
  if (request.negativePrompt) body.negative_prompt = request.negativePrompt;
  if (request.seed != null) body.seed = request.seed;
  if (request.steps != null) body.steps = request.steps;
  if (request.guidance != null) body.guidance = request.guidance;
  if (request.width != null) body.width = request.width;
  if (request.height != null) body.height = request.height;
  if (request.frames != null) body.frames = request.frames;
  if (request.fps != null) body.fps = request.fps;
  if (request.initImage) body.init_image = request.initImage;
  if (request.extendChunks != null) body.extend_chunks = request.extendChunks;

  const res = await fetch(apiUrl("/submit-job"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new HavnaiApiError(json.message || json.error || "No job_id returned from submit-job");
  }
  return json.job_id;
}

export async function fetchJob(jobId: string): Promise<JobDetailResponse> {
  const res = await fetch(apiUrl(`/jobs/${encodeURIComponent(jobId)}`), {
    headers: buildHeaders(true),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetch job failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as JobDetailResponse;
  return json;
}

export async function fetchResult(jobId: string): Promise<ResultResponse> {
  const res = await fetch(apiUrl(`/result/${encodeURIComponent(jobId)}`));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetch result failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as ResultResponse;
  return {
    ...json,
    image_url: resolveAssetUrl(json.image_url),
    video_url: resolveAssetUrl(json.video_url),
  };
}

export async function fetchJobWithResult(
  jobId: string
): Promise<{ job: JobDetailResponse; result?: ResultResponse }> {
  const job = await fetchJob(jobId);
  try {
    const result = await fetchResult(jobId);
    return { job, result };
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "";
    if (message.includes("404") || message.includes("result_not_found")) {
      return { job };
    }
    return { job };
  }
}

export async function fetchWanVideoJob(jobId: string): Promise<WanVideoStatus> {
  const res = await fetch(apiUrl(`/generate-video/${encodeURIComponent(jobId)}`), {
    headers: buildHeaders(true),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetch video job failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as WanVideoStatus;
  return {
    ...json,
    video_url: resolveAssetUrl(json.video_url),
  };
}

export async function fetchQuota(): Promise<QuotaStatus> {
  const res = await fetch(apiUrl("/quota"), {
    method: "GET",
    headers: buildHeaders(true),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return (await res.json()) as QuotaStatus;
}
