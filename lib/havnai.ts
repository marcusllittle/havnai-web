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
  negativePrompt?: string
): Promise<string> {
  const model =
    modelOverride && modelOverride.trim().length > 0
      ? modelOverride.trim()
      : "auto";

  const body = {
    wallet: WALLET,
    model,
    prompt,
    negative_prompt: negativePrompt && negativePrompt.trim().length > 0 ? negativePrompt : "low quality, blurry",
    width: 832,
    height: 1248,
    steps: 40,
    sampler: "euler a",
    guidance: 6,
    clipskip: 2,
  };

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

export async function submitFaceSwapJob(
  prompt: string,
  sourceFaceB64: string,
  modelOverride?: string,
  negativePrompt?: string,
  ipadapterScale: number = 0.85
): Promise<string> {
  const model =
    modelOverride && modelOverride.trim().length > 0
      ? modelOverride.trim()
      : "auto";

  const body = {
    wallet: WALLET,
    model,
    prompt,
    negative_prompt: negativePrompt && negativePrompt.trim().length > 0 ? negativePrompt : "low quality, blurry",
    source_face: sourceFaceB64,
    ipadapter_scale: ipadapterScale,
  };

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
