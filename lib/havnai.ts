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
  strength?: number;
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

export interface StitchResponse {
  video_url: string;
}

export interface CreditBalance {
  wallet: string;
  balance: number;
  total_deposited: number;
  total_spent: number;
  credits_enabled: boolean;
  updated_at?: number;
}

export interface CreditCost {
  model: string;
  cost: number;
  credits_enabled: boolean;
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
  if (request.strength != null) body.strength = request.strength;

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

export async function stitchVideos(jobIds: string[], outputName?: string): Promise<StitchResponse> {
  const body: Record<string, any> = { job_ids: jobIds };
  if (outputName) body.output_name = outputName;
  const res = await fetch(apiUrl("/videos/stitch"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  const json = (await res.json()) as StitchResponse;
  return {
    ...json,
    video_url: resolveAssetUrl(json.video_url) || json.video_url,
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

export async function fetchCredits(): Promise<CreditBalance> {
  const res = await fetch(apiUrl(`/credits/balance?wallet=${encodeURIComponent(WALLET)}`), {
    headers: buildHeaders(false),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return (await res.json()) as CreditBalance;
}

export async function fetchCreditCost(model: string, taskType?: string): Promise<CreditCost> {
  let url = `/credits/cost?model=${encodeURIComponent(model)}`;
  if (taskType) url += `&task_type=${encodeURIComponent(taskType)}`;
  const res = await fetch(apiUrl(url), {
    headers: buildHeaders(false),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return (await res.json()) as CreditCost;
}

// ---------------------------------------------------------------------------
// Stripe payments
// ---------------------------------------------------------------------------

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  description: string;
}

export interface PackagesResponse {
  packages: CreditPackage[];
  stripe_enabled: boolean;
}

export interface CheckoutResponse {
  session_id: string;
  checkout_url: string;
}

export interface PaymentRecord {
  session_id: string;
  package_id: string;
  credits: number;
  price_cents: number;
  status: string;
  created_at: number;
  completed_at: number | null;
}

export async function fetchPackages(): Promise<PackagesResponse> {
  const res = await fetch(apiUrl("/payments/packages"), {
    headers: buildHeaders(false),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return (await res.json()) as PackagesResponse;
}

export async function createCheckout(packageId: string): Promise<CheckoutResponse> {
  const successUrl = `${window.location.origin}/pricing?payment=success`;
  const cancelUrl = `${window.location.origin}/pricing?payment=cancelled`;

  const res = await fetch(apiUrl("/payments/checkout"), {
    method: "POST",
    headers: buildHeaders(false),
    body: JSON.stringify({
      wallet: WALLET,
      package_id: packageId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return (await res.json()) as CheckoutResponse;
}

export async function fetchPaymentHistory(): Promise<PaymentRecord[]> {
  const res = await fetch(
    apiUrl(`/payments/history?wallet=${encodeURIComponent(WALLET)}`),
    { headers: buildHeaders(false) }
  );
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  const data = await res.json();
  return data.payments as PaymentRecord[];
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AnalyticsOverview {
  total_jobs: number;
  jobs_today: number;
  success_rate: number;
  total_rewards: number;
  active_nodes: number;
  online_nodes?: number;
  total_credits_spent: number;
}

export interface AnalyticsJobsResponse {
  days: { date: string; count: number; success: number; failed: number }[];
  by_model: { model: string; count: number }[];
  by_type: { task_type: string; count: number }[];
}

export interface AnalyticsCostsResponse {
  by_model: { model: string; total_cost: number; job_count: number }[];
  by_day: { date: string; cost: number }[];
  total_spent: number;
}

export interface AnalyticsNodesResponse {
  nodes: {
    node_id: string;
    node_name: string;
    uptime_pct: number;
    avg_latency: number;
    jobs_completed: number;
    total_rewards: number;
  }[];
}

export interface AnalyticsRewardsResponse {
  by_node: { node_id: string; node_name: string; total: number; count: number }[];
  by_model: { model: string; total: number; count: number }[];
  total: number;
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const res = await fetch(apiUrl("/analytics/overview"), { headers: buildHeaders(true) });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as AnalyticsOverview;
}

export async function fetchAnalyticsJobs(days = 30): Promise<AnalyticsJobsResponse> {
  const res = await fetch(apiUrl(`/analytics/jobs?days=${days}`), { headers: buildHeaders(true) });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as AnalyticsJobsResponse;
}

export async function fetchAnalyticsCosts(days = 30): Promise<AnalyticsCostsResponse> {
  const res = await fetch(
    apiUrl(`/analytics/costs?days=${days}&wallet=${encodeURIComponent(WALLET)}`),
    { headers: buildHeaders(true) }
  );
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as AnalyticsCostsResponse;
}

export async function fetchAnalyticsNodes(): Promise<AnalyticsNodesResponse> {
  const res = await fetch(apiUrl("/analytics/nodes"), { headers: buildHeaders(true) });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as AnalyticsNodesResponse;
}

export async function fetchAnalyticsRewards(): Promise<AnalyticsRewardsResponse> {
  const res = await fetch(apiUrl("/analytics/rewards"), { headers: buildHeaders(true) });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as AnalyticsRewardsResponse;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface NodeInfo {
  node_id: string;
  node_name?: string;
  role: string;
  os: string;
  gpu: {
    gpu_name?: string;
    memory_total_mb?: number;
    memory_used_mb?: number;
    utilization?: number;
  };
  models: string[];
  pipelines: string[];
  rewards: number;
  tasks_completed: number;
  utilization: number;
  avg_utilization: number;
  last_seen: string;
  wallet?: string;
  online: boolean;
}

export interface NodeDetail extends NodeInfo {
  reward_history: { reward: number; timestamp: string }[];
  uptime?: number;
}

export interface LeaderboardEntry {
  wallet: string;
  total_rewards: number;
  jobs: number;
  last_24h: number;
  nodes: { node_id: string; node_name: string; role: string }[];
}

export async function fetchNodes(): Promise<NodeInfo[]> {
  const res = await fetch(apiUrl("/nodes"), { headers: buildHeaders(false) });
  if (!res.ok) throw await parseErrorResponse(res);
  const data = await res.json();
  return (data.nodes || []) as NodeInfo[];
}

export async function fetchNodeDetail(nodeId: string): Promise<NodeDetail> {
  const res = await fetch(apiUrl(`/nodes/${encodeURIComponent(nodeId)}`), {
    headers: buildHeaders(false),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as NodeDetail;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(apiUrl("/network/leaderboard"), { headers: buildHeaders(false) });
  if (!res.ok) throw await parseErrorResponse(res);
  const data = await res.json();
  return (data.leaderboard || []) as LeaderboardEntry[];
}

// ---------------------------------------------------------------------------
// Marketplace / Workflows
// ---------------------------------------------------------------------------

export interface Workflow {
  id: string;
  name: string;
  description: string;
  creator_wallet: string;
  category?: string;
  config: Record<string, any>;
  published: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
  offset: number;
  limit: number;
}

export async function fetchMarketplace(
  opts: { search?: string; category?: string; offset?: number; limit?: number } = {}
): Promise<WorkflowListResponse> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.category) params.set("category", opts.category);
  if (opts.offset) params.set("offset", String(opts.offset));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(apiUrl(`/marketplace/browse${qs ? `?${qs}` : ""}`), {
    headers: buildHeaders(false),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as WorkflowListResponse;
}

export async function fetchWorkflow(id: string): Promise<Workflow> {
  const res = await fetch(apiUrl(`/workflows/${encodeURIComponent(id)}`), {
    headers: buildHeaders(false),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as Workflow;
}

export async function createWorkflow(data: {
  name: string;
  description: string;
  category?: string;
  config: Record<string, any>;
}): Promise<Workflow> {
  const res = await fetch(apiUrl("/workflows"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ ...data, wallet: WALLET }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as Workflow;
}

export async function publishWorkflow(id: string): Promise<Workflow> {
  const res = await fetch(apiUrl(`/workflows/${encodeURIComponent(id)}/publish`), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ wallet: WALLET }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as Workflow;
}

// ---------------------------------------------------------------------------
// Wallet / Rewards
// ---------------------------------------------------------------------------

export interface WalletRewards {
  wallet: string;
  total_rewards: number;
  claimable: number;
  claimed: number;
}

export async function fetchWalletRewards(): Promise<WalletRewards> {
  const res = await fetch(apiUrl(`/rewards/claimable?wallet=${encodeURIComponent(WALLET)}`), {
    headers: buildHeaders(false),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as WalletRewards;
}

export async function claimRewards(): Promise<{ claimed: number; tx_hash?: string }> {
  const res = await fetch(apiUrl("/rewards/claim"), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ wallet: WALLET }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return await res.json();
}

export { WALLET };
