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
  status: string;
  stage: string;
  progress: number;
  model: string;
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

function studioFetch(path: string, accessKey: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-HavnAI-Studio-Key", accessKey);
  return fetch(path, { ...init, headers });
}

export async function fetchVideoCapabilities(accessKey: string): Promise<V1Capabilities> {
  return parseResponse(
    await studioFetch("/api/owner/v1/capabilities", accessKey, { cache: "no-store" })
  );
}

export async function uploadStudioAsset(
  file: File,
  kind: "image" | "audio",
  accessKey: string
): Promise<V1Asset> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file, file.name);
  return parseResponse(
    await studioFetch("/api/owner/v1/assets", accessKey, { method: "POST", body: form })
  );
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
}, accessKey: string): Promise<V1Job> {
  return parseResponse(
    await studioFetch("/api/owner/v1/jobs", accessKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    })
  );
}

export async function fetchV1Job(jobId: string, accessKey: string): Promise<V1Job> {
  return parseResponse(
    await studioFetch(`/api/owner/v1/jobs/${encodeURIComponent(jobId)}`, accessKey, {
      cache: "no-store",
    })
  );
}

export async function cancelV1Job(
  jobId: string,
  accessKey: string
): Promise<{ id: string; status: string }> {
  return parseResponse(
    await studioFetch(`/api/owner/v1/jobs/${encodeURIComponent(jobId)}/cancel`, accessKey, {
      method: "POST",
    })
  );
}

export function mediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `/api${url}` : url;
}
