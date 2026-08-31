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
  created_at?: number | null;
  updated_at?: number | null;
  completed_at?: number | null;
  error_code?: string | null;
  resolved_spec: {
    parameters?: {
      prompt?: string;
      style?: string;
      lyrics?: string;
      instrumental?: boolean;
      duration?: number;
      bpm?: number | null;
      key?: string;
      seed?: number | string | null;
    };
    output?: { content_type?: string; filename?: string };
    [key: string]: unknown;
  };
  artifacts: MusicArtifact[];
}

export interface MusicCapabilities {
  nodes: Array<{
    id: string;
    online: boolean;
    models: string[];
    supports: string[];
  }>;
  models: Array<{
    id: string;
    model_version?: string;
    available?: boolean;
    capabilities?: string[];
    declared_capabilities?: string[];
    verified_nodes?: string[];
  }>;
}

export interface CreateMusicInput {
  model: string;
  prompt: string;
  style: string;
  lyrics: string;
  instrumental: boolean;
  duration: number;
  bpm?: number;
  key?: string;
  seed?: number;
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

export function fetchMusicCapabilities(accessKey: string): Promise<MusicCapabilities> {
  return studioFetch("/api/owner/v1/capabilities", accessKey, { cache: "no-store" })
    .then(parseResponse<MusicCapabilities>);
}

export function createMusicJob(input: CreateMusicInput, accessKey: string): Promise<MusicJob> {
  return studioFetch("/api/owner/v1/jobs", accessKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text_to_music", ...input }),
  }).then(parseResponse<MusicJob>);
}

export function fetchMusicJob(jobId: string, accessKey: string): Promise<MusicJob> {
  return studioFetch(`/api/owner/v1/jobs/${encodeURIComponent(jobId)}`, accessKey, {
    cache: "no-store",
  }).then(parseResponse<MusicJob>);
}

export async function fetchMusicJobs(accessKey: string): Promise<MusicJob[]> {
  const payload = await studioFetch("/api/owner/v1/jobs?type=text_to_music&limit=20", accessKey, {
    cache: "no-store",
  }).then(parseResponse<{ jobs?: MusicJob[] }>);
  return payload.jobs || [];
}

export function cancelMusicJob(jobId: string, accessKey: string): Promise<{ id: string; status: string }> {
  return studioFetch(`/api/owner/v1/jobs/${encodeURIComponent(jobId)}/cancel`, accessKey, {
    method: "POST",
  }).then(parseResponse<{ id: string; status: string }>);
}

export function musicMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `/api${url}` : url;
}
