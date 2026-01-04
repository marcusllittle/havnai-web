import type { NextPage } from "next";

// Simple API helper for talking to the HavnAI coordinator.
// Uses relative URLs so it works behind whatever proxy is fronting the core.

export interface SubmitJobResponse {
  job_id?: string;
  status?: string;
  error?: string;
}

export interface JobDetail {
  id: string;
  status: string;
  model: string;
  task_type?: string;
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

function resolveAssetUrl(path: string | undefined | null): string | undefined {
  if (!path) return undefined;
  // If already absolute (http/https), return as-is.
  if (/^https?:\/\//i.test(path)) return path;
  // Otherwise, prefix with API_BASE so we hit the coordinator, not the Next dev server.
  return `${getApiBase()}${path}`;
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit-job failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new Error(json.error || "No job_id returned from submit-job");
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit-faceswap-job failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new Error(json.error || "No job_id returned from submit-faceswap-job");
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generate-video failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as SubmitJobResponse;
  if (!json.job_id) {
    throw new Error(json.error || "No job_id returned from generate-video");
  }
  return json.job_id;
}

export async function fetchJob(jobId: string): Promise<JobDetailResponse> {
  const res = await fetch(apiUrl(`/jobs/${encodeURIComponent(jobId)}`));
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

export async function fetchWanVideoJob(jobId: string): Promise<WanVideoStatus> {
  const res = await fetch(apiUrl(`/generate-video/${encodeURIComponent(jobId)}`));
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
