import type { MusicFormState } from "./musicStudioState";
import { MUSIC_MODES_NEEDING_SOURCE, MUSIC_MODES_NEEDING_TRACK } from "./musicStudioState";

export interface MusicArtifact {
  id: string;
  kind: string;
  filename: string;
  content_type: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MusicJob {
  id: string;
  type: string;
  status: string;
  stage: string;
  progress: number;
  model: string;
  wallet?: string;
  owner_account_id?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
  completed_at?: number | null;
  error_code?: string | null;
  resolved_spec: {
    mode?: string;
    parameters?: {
      mode?: string;
      task_type?: string;
      prompt?: string;
      style?: string;
      lyrics?: string;
      instrumental?: boolean;
      duration?: number;
      bpm?: number | null;
      key?: string;
      seed?: number | string | null;
      batch_size?: number;
      track_name?: string;
      track_classes?: string[];
      audio_format?: string;
    };
    output?: { content_type?: string; filename?: string };
    [key: string]: unknown;
  };
  artifacts: MusicArtifact[];
}

export interface AccountStudioAccess {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  signal: AbortSignal;
}
export type StudioAccess = string | AccountStudioAccess;

function studioRequest<T>(path: string, access: StudioAccess, init: RequestInit = {}): Promise<T> {
  if (typeof access !== "string") return access.request<T>(`/v2${path}`, { ...init, signal: access.signal });
  return studioFetch(`/api/owner/v1${path}`, access, init).then(parseResponse<T>);
}

export interface MusicModelInfo {
  id: string;
  model_version?: string;
  available?: boolean;
  capabilities?: string[];
  declared_capabilities?: string[];
  available_modes?: string[];
  max_batch_size?: number;
  verified_nodes?: string[];
}

export interface MusicCapabilities {
  nodes: Array<{
    id: string;
    online: boolean;
    models: string[];
    supports: string[];
  }>;
  models: MusicModelInfo[];
}

export interface MusicAsset {
  id: string;
  kind: string;
  filename: string;
  content_type: string;
  content_url?: string | null;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Request failed (${response.status})`);
    (error as Error & { code?: string }).code = payload.error;
    throw error;
  }
  return payload as T;
}

function studioFetch(path: string, accessKey: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-HavnAI-Studio-Key", accessKey);
  return fetch(path, { ...init, headers });
}

export function fetchMusicCapabilities(accessKey: StudioAccess): Promise<MusicCapabilities> {
  return studioRequest("/capabilities", accessKey, { cache: "no-store" });
}

/** Upload a creator's own recording so remix/repaint/stem jobs can reference it. */
export function uploadMusicAsset(file: File, accessKey: StudioAccess): Promise<MusicAsset> {
  const body = new FormData();
  // The coordinator reads the `file` part and infers `kind` from its MIME type.
  body.append("file", file, file.name);
  body.append("kind", "audio");
  // Content-Type is deliberately unset so the browser adds the multipart boundary.
  return studioRequest("/assets", accessKey, {
    method: "POST",
    body,
  });
}

/** Translate the studio form into the coordinator's text_to_music contract. */
export function musicJobRequest(
  form: MusicFormState,
  options: { audioAssetId?: string; referenceAssetId?: string; wallet?: string } = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: "text_to_music",
    mode: form.mode,
    model: form.model,
    prompt: form.prompt.trim(),
    style: form.style.trim(),
    lyrics: form.instrumental ? "" : form.lyrics,
    instrumental: form.instrumental,
    duration: form.duration,
    batch_size: form.batchSize,
    audio_format: form.audioFormat,
  };
  if (form.bpm.trim()) body.bpm = Number(form.bpm);
  if (form.key.trim()) body.key = form.key.trim();
  if (form.seed.trim()) body.seed = Number(form.seed);
  if (form.inferenceSteps.trim()) body.inference_steps = Number(form.inferenceSteps);
  if (form.guidanceScale.trim()) body.guidance_scale = Number(form.guidanceScale);
  if (options.wallet) body.wallet = options.wallet;

  if (MUSIC_MODES_NEEDING_SOURCE.has(form.mode) && options.audioAssetId) {
    body.audio_asset_id = options.audioAssetId;
  }
  if (options.referenceAssetId) body.reference_asset_id = options.referenceAssetId;

  if (form.mode === "remix") {
    body.audio_cover_strength = form.coverStrength;
  }
  if (form.mode === "repaint") {
    body.repainting_start = Number(form.repaintStart || 0);
    body.repainting_end = form.repaintEnd.trim() === "" ? -1 : Number(form.repaintEnd);
    body.repaint_mode = form.repaintMode;
  }
  if (MUSIC_MODES_NEEDING_TRACK.has(form.mode)) {
    body.track_name = form.trackName;
  }
  if (form.mode === "arrange") {
    body.track_classes = form.trackClasses;
  }
  return body;
}

export function createMusicJob(
  body: Record<string, unknown>,
  accessKey: StudioAccess,
  requestKey?: string
): Promise<MusicJob> {
  return studioRequest("/jobs", accessKey, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(requestKey ? { "Idempotency-Key": requestKey } : {}) },
    body: JSON.stringify({ type: "text_to_music", ...body }),
  });
}

export function fetchMusicJob(jobId: string, accessKey: StudioAccess): Promise<MusicJob> {
  return studioRequest(`/jobs/${encodeURIComponent(jobId)}`, accessKey, {
    cache: "no-store",
  });
}

export async function fetchMusicJobs(accessKey: StudioAccess): Promise<MusicJob[]> {
  const payload = await studioRequest<{ jobs?: MusicJob[] }>("/jobs?type=text_to_music&limit=20", accessKey, {
    cache: "no-store",
  });
  return payload.jobs || [];
}

export function cancelMusicJob(jobId: string, accessKey: StudioAccess): Promise<{ id: string; status: string }> {
  return studioRequest(`/jobs/${encodeURIComponent(jobId)}/cancel`, accessKey, {
    method: "POST",
  });
}

export function musicMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^\/v2\/artifacts\/[a-zA-Z0-9_-]+\/content$/.test(url)) return `/api/account-media/${url.split("/")[3]}`;
  return url.startsWith("/") ? `/api${url}` : url;
}

/** Every audio artifact on a job, primary take first — a batch job returns several. */
export function musicTakes(job: MusicJob): Array<{ url: string; index: number; seed?: string | number }> {
  return job.artifacts
    .filter((artifact) => artifact.kind === "audio")
    .map((artifact, position) => {
      const metadata = artifact.metadata || {};
      const variation = Number(metadata.variation);
      return {
        url: musicMediaUrl(artifact.url) || "",
        index: Number.isFinite(variation) && variation > 0 ? variation : position + 1,
        seed: metadata.seed as string | number | undefined,
      };
    })
    .filter((take) => Boolean(take.url))
    .sort((left, right) => left.index - right.index);
}
