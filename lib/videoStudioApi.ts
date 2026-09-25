import type { StudioAccess } from "./musicStudioApi";

export type VideoPreset = "fast_upscaled" | "native_quality";
export type VideoAspect = "9:16" | "16:9";
export type VideoDuration = 3 | 5 | 8;

export interface V1Asset {
  id: string;
  kind: "image" | "audio";
  filename: string;
  sha256: string;
}

export interface V1Artifact {
  id: string;
  kind: string;
  url?: string;
  filename: string;
  sha256: string;
}

export interface V1Job {
  id: string;
  owner_account_id?: string;
  type?: string;
  status: string;
  stage: string;
  progress: number;
  model: string;
  created_at?: number | null;
  updated_at?: number | null;
  completed_at?: number | null;
  error_code?: string | null;
  resolved_spec: Record<string, unknown>;
  artifacts: V1Artifact[];
}

export interface V1Capabilities {
  video_v2_enabled: boolean;
  video_v2_available: boolean;
  nodes: Array<{
    id: string;
    online: boolean;
    models: string[];
    supports: string[];
    capabilities?: Record<string, unknown>;
  }>;
  models: Array<{
    id: string;
    pipeline?: string;
    version?: string;
    model_version?: string;
    available?: boolean;
    verified_nodes?: string[];
    capabilities?: string[];
    declared_capabilities?: string[];
    license_status?: string;
  }>;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

async function studioRequest<T>(path: string, accessKey: StudioAccess, init: RequestInit = {}): Promise<T> {
  if (typeof accessKey !== "string") {
    const signal = accessKey.signal;
    signal.throwIfAborted();
    const result = await accessKey.request<T>(`/v2${path}`, { ...init, signal });
    signal.throwIfAborted();
    return result;
  }
  const headers = new Headers(init.headers);
  headers.set("X-HavnAI-Studio-Key", accessKey);
  return parseResponse<T>(await fetch(`/api/owner/v1${path}`, { ...init, headers }));
}

export async function fetchVideoCapabilities(accessKey: StudioAccess): Promise<V1Capabilities> {
  return studioRequest("/capabilities", accessKey, { cache: "no-store" });
}

export async function uploadStudioAsset(
  file: File,
  kind: "image" | "audio",
  accessKey: StudioAccess
): Promise<V1Asset> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file, file.name);
  return studioRequest("/assets", accessKey, { method: "POST", body: form });
}

export async function createVideoJob(input: {
  model: string;
  prompt: string;
  sourceAssetId: string;
  audioAssetId?: string;
  preset: VideoPreset;
  aspectRatio: VideoAspect;
  durationSeconds: VideoDuration;
  seed?: number;
  motionStrength: number;
}, accessKey: StudioAccess, requestKey?: string): Promise<V1Job> {
  return studioRequest("/jobs", accessKey, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(requestKey ? { "Idempotency-Key": requestKey } : {}) },
      body: JSON.stringify({
        type: "image_to_video",
        model: input.model,
        prompt: input.prompt,
        source_asset_id: input.sourceAssetId,
        audio_asset_id: input.audioAssetId || undefined,
        preset: input.preset,
        aspect_ratio: input.aspectRatio,
        duration_seconds: input.durationSeconds,
        seed: input.seed,
        motion_strength: input.motionStrength,
      }),
    });
}

export async function fetchV1Job(jobId: string, accessKey: StudioAccess): Promise<V1Job> {
  return studioRequest(`/jobs/${encodeURIComponent(jobId)}`, accessKey, {
      cache: "no-store",
    });
}

export async function fetchV1Jobs(accessKey: StudioAccess): Promise<V1Job[]> {
  const payload = await studioRequest<{ jobs?: V1Job[] }>("/jobs?type=image_to_video&limit=10", accessKey, {
      cache: "no-store",
    });
  return payload.jobs || [];
}

export async function cancelV1Job(
  jobId: string,
  accessKey: StudioAccess
): Promise<{ id: string; status: string }> {
  return studioRequest(`/jobs/${encodeURIComponent(jobId)}/cancel`, accessKey, {
      method: "POST",
    });
}

export function mediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const accountArtifact = /^\/v2\/artifacts\/([a-zA-Z0-9_-]+)\/content$/.exec(url);
  if (accountArtifact) return `/api/account-media/${accountArtifact[1]}`;
  return url.startsWith("/") ? `/api${url}` : url;
}
