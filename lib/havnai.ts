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

const API_BASE =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_HAVNAI_API_BASE || ""
    : "";

function apiUrl(path: string): string {
  if (API_BASE) {
    return `${API_BASE}${path}`;
  }
  return path;
}

export async function submitAutoJob(prompt: string): Promise<string> {
  const body = {
    wallet: "test_user",
    model: "auto",
    prompt,
    negative_prompt: "low quality, blurry",
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
  return json;
}

