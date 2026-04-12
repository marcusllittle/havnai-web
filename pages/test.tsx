import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { CinematicPageHero } from "../components/CinematicPageHero";
import { SiteHeader } from "../components/SiteHeader";
import { useWallet } from "../components/WalletProvider";
import { HavnAIPrompt } from "../components/HavnAIPrompt";
import { HavnAIButton } from "../components/HavnAIButton";
import { StatusBox } from "../components/StatusBox";
import { OutputCard } from "../components/OutputCard";
import { HistoryFeed, HistoryItem } from "../components/HistoryFeed";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import {
  submitAutoJob,
  submitFaceSwapJob,
  submitVideoJob,
  fetchJob,
  fetchResult,
  fetchJobWithResult,
  fetchQuota,
  fetchCredits,
  stitchVideos,
  HavnaiApiError,
  JobDetailResponse,
  ResultResponse,
  FaceSwapRequest,
  SubmitJobOptions,
  QuotaStatus,
  CreditBalance,
} from "../lib/havnai";
import { addToLibrary, LibraryItemType } from "../lib/libraryStore";
import { clearInviteCode, getInviteCode, setInviteCode } from "../lib/invite";
import { getJobSSE, SSEEvent } from "../lib/sse";
import { getApiBase } from "../lib/apiBase";
import { getConnectButtonLabel } from "../lib/wallet";
import { buildModelOptionLabel } from "../lib/modelMetadata";
import {
  getWalletIdentityLabel,
  getWalletSourceLabel,
  getWalletStatusCopy,
  PUBLIC_ALPHA_LABEL,
} from "../lib/publicAlpha";

const HISTORY_KEY = "havnai_test_history_v1";

// Keep the image selector empty until live model capacity is loaded.
const FALLBACK_IMAGE_MODELS: { id: string; label: string }[] = [];

const IDENTITY_ANCHOR_TAG_RE = /^\[\s*identity\s+anchor\s*:\s*([A-Za-z0-9_-]+)\s*\]$/i;
const IDENTITY_ANCHOR_BARE_RE = /^\[\s*identity\s+anchor\s*\]$/i;
const IDENTITY_ANCHOR_OPEN_RE = /\[\s*identity\s+anchor\b/i;

type LoraDraft = {
  name: string;
  weight: string;
};

type LoraInfo = {
  name: string;
  filename?: string;
  pipeline?: string;
  label?: string;
};

type RuntimeDefaults = {
  steps?: number;
  guidance?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  sampler?: string;
  num_steps?: number;
  strength?: number;
};

type RuntimeDefaultsSource = Record<string, string>;

type ModelListEntry = {
  model_key?: string;
  name: string;
  tier: string;
  weight?: number;
  reward_weight?: number;
  credit_cost?: number;
  task_type?: string;
  pipeline?: string;
  available?: boolean;
  face_swap_available?: boolean;
  image_defaults?: RuntimeDefaults | null;
  video_defaults?: RuntimeDefaults | null;
  face_swap_defaults?: RuntimeDefaults | null;
  defaults_source?: {
    image?: RuntimeDefaultsSource;
    video?: RuntimeDefaultsSource;
    face_swap?: RuntimeDefaultsSource;
  } | null;
  defaults_confidence?: {
    image?: string;
    video?: string;
    face_swap?: string;
  } | null;
  // LTX-Video 2.3 model family fields
  model_family?: string | null;
  model_version?: string | null;
  checkpoint_variant?: string | null;
  capabilities?: string[] | null;
  available_modes?: string[] | null;
};

type GeneratorMode = "image" | "face_swap" | "video";
type ImageQualityPreset = "fastest" | "balanced" | "best";
type ImageSizePreset =
  | "auto"
  | "21x9"
  | "16x9"
  | "3x2"
  | "4x3"
  | "5x4"
  | "1x1"
  | "4x5"
  | "3x4"
  | "2x3"
  | "9x16";

const IMAGE_SIZE_PRESETS: Array<{
  id: ImageSizePreset;
  label: string;
  width?: number;
  height?: number;
}> = [
  { id: "auto", label: "Auto" },
  { id: "21x9", label: "21:9", width: 1536, height: 640 },
  { id: "16x9", label: "16:9", width: 1344, height: 768 },
  { id: "3x2", label: "3:2", width: 1216, height: 832 },
  { id: "4x3", label: "4:3", width: 1152, height: 896 },
  { id: "5x4", label: "5:4", width: 1088, height: 896 },
  { id: "1x1", label: "1:1", width: 1024, height: 1024 },
  { id: "4x5", label: "4:5", width: 896, height: 1088 },
  { id: "3x4", label: "3:4", width: 896, height: 1152 },
  { id: "2x3", label: "2:3", width: 832, height: 1216 },
  { id: "9x16", label: "9:16", width: 768, height: 1344 },
];

const clampStepValue = (value: number): number => {
  if (!Number.isFinite(value)) return 30;
  return Math.max(5, Math.min(50, Math.round(value)));
};

const resolveImageStepPresets = (defaults?: RuntimeDefaults | null): Record<ImageQualityPreset, number> => {
  const balanced = clampStepValue(Number(defaults?.steps ?? 30));
  return {
    fastest: clampStepValue(balanced - 4),
    balanced,
    best: clampStepValue(balanced + 4),
  };
};

const formatImageDefaultsSummary = (defaults?: RuntimeDefaults | null): string => {
  if (!defaults) return "";
  const parts: string[] = [];
  if (defaults.guidance != null) parts.push(`${defaults.guidance} CFG`);
  if (defaults.width != null && defaults.height != null) {
    parts.push(`${defaults.width}x${defaults.height}`);
  }
  if (defaults.sampler) parts.push(String(defaults.sampler));
  return parts.join(" · ");
};

const formatResolutionLabel = (width?: number, height?: number): string => {
  if (width == null || height == null) return "";
  return `${width}x${height}`;
};

const pickPreferredVideoModel = (models: { id: string; label: string }[]): string => {
  // Prefer LTX-Video 2.3 dev, then distilled, then AnimateDiff, then first available
  const ltxDev = models.find((item) => item.id.toLowerCase() === "ltx_video_dev");
  if (ltxDev) return ltxDev.id;
  const ltxDistilled = models.find((item) => item.id.toLowerCase() === "ltx_video_distilled");
  if (ltxDistilled) return ltxDistilled.id;
  const animatediff = models.find((item) => item.id.toLowerCase() === "animatediff");
  if (animatediff) return animatediff.id;
  return models.length > 0 ? models[0].id : "";
};

const inspectPromptIdentityAnchor = (promptText: string): {
  hasAnchorTag: boolean;
  slug?: string;
  promptWithoutTag: string;
  error?: string;
} => {
  const matches: Array<{ value: string; index: number }> = [];
  const regex = /\[\s*identity\s+anchor(?:[^\]]*)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(promptText)) !== null) {
    matches.push({ value: match[0], index: match.index });
  }
  if (matches.length === 0) {
    if (IDENTITY_ANCHOR_OPEN_RE.test(promptText)) {
      return {
        hasAnchorTag: false,
        promptWithoutTag: promptText.trim(),
        error: "Use [IDENTITY ANCHOR: your_anchor_slug].",
      };
    }
    return { hasAnchorTag: false, promptWithoutTag: promptText.trim() };
  }
  if (matches.length > 1) {
    return {
      hasAnchorTag: true,
      promptWithoutTag: promptText.trim(),
      error: "Only one identity anchor can be used per prompt.",
    };
  }
  const [{ value, index }] = matches;
  if (IDENTITY_ANCHOR_BARE_RE.test(value)) {
    return {
      hasAnchorTag: true,
      promptWithoutTag: promptText.trim(),
      error: "Use [IDENTITY ANCHOR: your_anchor_slug].",
    };
  }
  const parsed = value.match(IDENTITY_ANCHOR_TAG_RE);
  if (!parsed?.[1]) {
    return {
      hasAnchorTag: true,
      promptWithoutTag: promptText.trim(),
      error: "Use [IDENTITY ANCHOR: your_anchor_slug].",
    };
  }
  const promptWithoutTag = `${promptText.slice(0, index)}${promptText.slice(index + value.length)}`
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  if (!promptWithoutTag) {
    return {
      hasAnchorTag: true,
      slug: parsed[1].toLowerCase(),
      promptWithoutTag,
      error: "Prompt is required after removing the identity anchor tag.",
    };
  }
  return {
    hasAnchorTag: true,
    slug: parsed[1].toLowerCase(),
    promptWithoutTag,
  };
};

const TestPage: React.FC = () => {
  const wallet = useWallet();
  const [mode, setMode] = useState<GeneratorMode>("image");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [lastUsedPrompt, setLastUsedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [chainSummary, setChainSummary] = useState<{ clips: number; stitched: boolean } | null>(null);
  const [model, setModel] = useState<string | undefined>();
  const [runtimeSeconds, setRuntimeSeconds] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [imageModels, setImageModels] = useState<{ id: string; label: string }[]>(FALLBACK_IMAGE_MODELS);
  const [videoModels, setVideoModels] = useState<{ id: string; label: string }[]>([]);
  const [faceSwapModels, setFaceSwapModels] = useState<{ id: string; label: string }[]>([]);
  const [modelRuntimeDefaults, setModelRuntimeDefaults] = useState<Record<string, ModelListEntry>>({});
  const [imageQualityPreset, setImageQualityPreset] = useState<ImageQualityPreset>("balanced");
  const [imageSizePreset, setImageSizePreset] = useState<ImageSizePreset>("auto");
  const [steps, setSteps] = useState("30");
  const [guidance, setGuidance] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [frames, setFrames] = useState("");
  const [fps, setFps] = useState("");
  const [extendChunks, setExtendChunks] = useState("0");
  const [sampler, setSampler] = useState("");
  const [seed, setSeed] = useState("");
  const [sfwMode, setSfwMode] = useState(false);
  const [loras, setLoras] = useState<LoraDraft[]>([]);
  const [autoStitch, setAutoStitch] = useState(false);
  // LTX-Video 2.3 settings
  const [ltxPipelineMode, setLtxPipelineMode] = useState("two_stage");
  const [ltxUpscaler, setLtxUpscaler] = useState("");
  const [ltxTemporalUpscale, setLtxTemporalUpscale] = useState(false);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [allLoraInfo, setAllLoraInfo] = useState<LoraInfo[]>([]);
  const [loraLoadError, setLoraLoadError] = useState<string | undefined>();
  const [loraSearch, setLoraSearch] = useState("");
  const [loraBrowserOpen, setLoraBrowserOpen] = useState(false);
  const [modelPipelines, setModelPipelines] = useState<Record<string, string>>({});
  const [faceswapModel, setFaceswapModel] = useState("epicrealismXL_vxviiCrystalclear");
  const [baseImageUrl, setBaseImageUrl] = useState("");
  const [baseImageData, setBaseImageData] = useState<string | undefined>();
  const [baseImageName, setBaseImageName] = useState<string | undefined>();
  const [videoInitUrl, setVideoInitUrl] = useState("");
  const [videoInitData, setVideoInitData] = useState<string | undefined>();
  const [videoInitName, setVideoInitName] = useState<string | undefined>();
  const [videoInitStrength, setVideoInitStrength] = useState("0.55");
  const [faceSourceUrl, setFaceSourceUrl] = useState("");
  const [faceSourceData, setFaceSourceData] = useState<string | undefined>();
  const [faceSourceName, setFaceSourceName] = useState<string | undefined>();
  const [faceswapStrength, setFaceswapStrength] = useState("");
  const [faceswapSteps, setFaceswapSteps] = useState("");
  const [faceswapGuidance, setFaceswapGuidance] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerJob, setDrawerJob] = useState<JobDetailResponse | null>(null);
  const [drawerResult, setDrawerResult] = useState<ResultResponse | null>(null);
  const [drawerSummary, setDrawerSummary] = useState<JobSummary | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | undefined>();
  const [inviteCode, setInviteCodeState] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [savedInviteCode, setSavedInviteCode] = useState<string | undefined>();
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaError, setQuotaError] = useState<string | undefined>();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const inviteSaved = Boolean(savedInviteCode);
  const connectLabel = getConnectButtonLabel(wallet);
  const walletSourceLabel = getWalletSourceLabel(wallet.source);
  const walletIdentityLabel = getWalletIdentityLabel(wallet);
  const walletStatusCopy = getWalletStatusCopy(wallet, "generator");
  const imagePrefillKeyRef = useRef<string>("");
  const videoPrefillKeyRef = useRef<string>("");
  const faceSwapPrefillKeyRef = useRef<string>("");

  const apiBase = getApiBase();
  const activeWallet = wallet.activeWallet || undefined;

  // Load history from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const storedInvite = getInviteCode();
    if (storedInvite) {
      setInviteCodeState(storedInvite);
      setSavedInviteCode(storedInvite);
    }
  }, []);

  // Determine current model's pipeline for LoRA filtering
  const currentPipeline = selectedModel
    ? modelPipelines[selectedModel.toLowerCase()] || ""
    : "";
  const selectedImageModelMeta =
    selectedModel ? modelRuntimeDefaults[selectedModel.toLowerCase()] : undefined;
  const selectedVideoModelMeta =
    mode === "video" && selectedModel ? modelRuntimeDefaults[selectedModel.toLowerCase()] : undefined;
  const selectedFaceSwapModelMeta = faceswapModel
    ? modelRuntimeDefaults[faceswapModel.toLowerCase()]
    : undefined;

  const summarizeDefaultsSource = (sources?: RuntimeDefaultsSource): string => {
    if (!sources) return "profile";
    const values = Object.values(sources).map((v) => String(v || "").toLowerCase());
    if (values.includes("model")) return "model";
    if (values.includes("profile")) return "profile";
    if (values.includes("env")) return "env";
    return "profile";
  };
  const imageDefaultsBadge = summarizeDefaultsSource(selectedImageModelMeta?.defaults_source?.image);
  const videoDefaultsBadge = summarizeDefaultsSource(selectedVideoModelMeta?.defaults_source?.video);
  const faceSwapDefaultsBadge = summarizeDefaultsSource(selectedFaceSwapModelMeta?.defaults_source?.face_swap);
  const imageStepPresets = resolveImageStepPresets(selectedImageModelMeta?.image_defaults);
  const imageDefaultsSummary = formatImageDefaultsSummary(selectedImageModelMeta?.image_defaults);
  const selectedImageSizePreset =
    IMAGE_SIZE_PRESETS.find((preset) => preset.id === imageSizePreset) || IMAGE_SIZE_PRESETS[0];
  const selectedImageResolution =
    imageSizePreset === "auto"
      ? formatResolutionLabel(
          selectedImageModelMeta?.image_defaults?.width,
          selectedImageModelMeta?.image_defaults?.height
        )
      : formatResolutionLabel(selectedImageSizePreset.width, selectedImageSizePreset.height);

  useEffect(() => {
    let active = true;
    const loadLoras = async () => {
      if (typeof window === "undefined") return;
      try {
        // Build URL with optional pipeline filter
        let url = `${getApiBase()}/loras/list`;
        if (currentPipeline) {
          url += `?pipeline=${encodeURIComponent(currentPipeline)}`;
        }
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`loras HTTP ${res.status}`);
        const data = await res.json();
        const raw: any[] = Array.isArray(data?.loras) ? data.loras : [];

        // Store full LoRA info objects (with pipeline metadata)
        const infoList: LoraInfo[] = raw
          .map((entry: any) => ({
            name: String(entry?.name || entry?.filename || "").trim(),
            filename: entry?.filename ? String(entry.filename).trim() : undefined,
            pipeline: entry?.pipeline ? String(entry.pipeline).trim().toLowerCase() : undefined,
          }))
          .filter((info: LoraInfo) => info.name.length > 0);

        // Deduplicate by name
        const seen = new Set<string>();
        const deduped: LoraInfo[] = [];
        for (const info of infoList) {
          const key = info.name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(info);
          }
        }
        deduped.sort((a, b) => a.name.localeCompare(b.name));

        if (active) {
          setAllLoraInfo(deduped);
          setAvailableLoras(deduped.map((l) => l.name));
          setLoraLoadError(undefined);
        }
      } catch (err: any) {
        if (active) {
          setAllLoraInfo([]);
          setAvailableLoras([]);
          setLoraLoadError(err?.message || "Failed to load LoRAs.");
        }
      }
    };
    void loadLoras();
    return () => {
      active = false;
    };
  }, [currentPipeline]);

  // Load models from backend
  useEffect(() => {
    let active = true;

    const loadModels = async () => {
      if (typeof window === "undefined") return;
      try {
        const res = await fetch(`${getApiBase()}/models/list`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`models HTTP ${res.status}`);
        const data = await res.json();
        const models: ModelListEntry[] = Array.isArray(data?.models) ? data.models : [];

        if (!active) return;

        // Separate models by task type
        const imageModelsData = models.filter((m) => {
          const taskType = String(m.task_type || "").toUpperCase();
          const pipeline = String(m.pipeline || "").toLowerCase();
          if (!(taskType === "IMAGE_GEN" || !taskType)) return false;
          // Keep generator image model list focused on SDXL models only.
          if (m.available !== true) return false;
          if (!pipeline.includes("sdxl")) return false;
          return true;
        });
        const videoModelsData = models.filter((m) => {
          const taskType = String(m.task_type || "").toUpperCase();
          return (taskType === "VIDEO_GEN" || taskType === "ANIMATEDIFF" || taskType === "LTX_VIDEO_GEN") && m.available === true;
        });

        // Face swap models: only currently available SDXL entries.
        const faceSwapModelsData = imageModelsData.filter((m) => {
          const pipeline = String(m.pipeline || "").toLowerCase();
          return pipeline.includes("sdxl") && m.face_swap_available === true;
        });

        // Transform to dropdown format with tier badges and clean names
        const imageOptions = imageModelsData.map((m) => ({
          id: m.name,
          label: buildModelOptionLabel(m, String(m.pipeline || "").toUpperCase()),
        }));

        const videoOptions = videoModelsData.map((m) => {
          const isAnimateDiff = String(m.task_type || "").toUpperCase() === "ANIMATEDIFF";
          const pipeline = String(m.pipeline || "").toLowerCase();
          const typeLabel = isAnimateDiff
            ? "AnimateDiff · SD1.5 motion"
            : pipeline === "ltx_video"
              ? "LTX-Video 2.3 · DiT"
              : "LTX2 · native video";
          return {
            id: m.name,
            label: buildModelOptionLabel(m, typeLabel),
          };
        });

        const faceSwapOptions = faceSwapModelsData.map((m) => ({
          id: m.name,
          label: buildModelOptionLabel(m, String(m.pipeline || "").toUpperCase()),
        }));

        setImageModels(imageOptions);
        setVideoModels(videoOptions);
        setFaceSwapModels(faceSwapOptions);

        // Build model→pipeline lookup for LoRA filtering
        const pipelines: Record<string, string> = {};
        const defaultsMap: Record<string, ModelListEntry> = {};
        for (const m of models) {
          if (m.name && m.pipeline) {
            pipelines[m.name.toLowerCase()] = String(m.pipeline).toLowerCase();
          }
          if (m.name) {
            defaultsMap[m.name.toLowerCase()] = m;
          }
        }
        if (active) {
          setModelPipelines(pipelines);
          setModelRuntimeDefaults(defaultsMap);
        }
      } catch (err: any) {
        console.error("Failed to load models from /api/models/list:", err);
        // Keep fallback models on error
      }
    };
    void loadModels();
    return () => {
      active = false;
    };
  }, []);

  // Reset mode-specific options when switching modes
  useEffect(() => {
    if (mode === "image") {
      // Reset video-specific options
      setFrames("");
      setFps("");
      setExtendChunks("0");
      setVideoInitUrl("");
      setVideoInitData(undefined);
      setVideoInitName(undefined);
      // Reset face swap options
      setFaceSourceUrl("");
      setFaceSourceData(undefined);
      setFaceSourceName(undefined);
      setFaceswapGuidance("");
      setSteps("");
      setGuidance("");
      setWidth("");
      setHeight("");
      setSampler("");
      setImageQualityPreset("balanced");
      setImageSizePreset("auto");
      // Default image mode to the first live model when available.
      setSelectedModel(imageModels.length > 0 ? imageModels[0].id : "");
    } else if (mode === "video") {
      // Reset sampler (not used in video mode)
      setSampler("");
      // Reset face swap options
      setFaceSourceUrl("");
      setFaceSourceData(undefined);
      setFaceSourceName(undefined);
      setFaceswapGuidance("");
      // Do not carry image defaults into video requests.
      setSteps("");
      setGuidance("");
      setWidth("");
      setHeight("");
      setFrames("");
      setFps("");
      // Prefer AnimateDiff by default on consumer GPUs.
      setSelectedModel(pickPreferredVideoModel(videoModels));
    } else if (mode === "face_swap") {
      // Reset video-specific options
      setFrames("");
      setFps("");
      setExtendChunks("0");
      setVideoInitUrl("");
      setVideoInitData(undefined);
      setVideoInitName(undefined);
      // Select first available face swap model, otherwise clear selection.
      setSelectedModel(faceSwapModels.length > 0 ? faceSwapModels[0].id : "");
      setFaceswapModel(faceSwapModels.length > 0 ? faceSwapModels[0].id : "");
    }
  }, [mode, imageModels, videoModels, faceSwapModels]);

  useEffect(() => {
    if (mode !== "image" || !selectedImageModelMeta) {
      if (mode !== "image") imagePrefillKeyRef.current = "";
      return;
    }
    const defaults = selectedImageModelMeta.image_defaults || undefined;
    if (!defaults) return;
    const prefillKey = `${selectedModel.toLowerCase()}:${JSON.stringify(defaults)}`;
    if (imagePrefillKeyRef.current === prefillKey) return;
    setSteps((prev) => (prev || defaults.steps == null ? prev : String(defaults.steps)));
    setGuidance((prev) => (prev || defaults.guidance == null ? prev : String(defaults.guidance)));
    setWidth((prev) => (prev || defaults.width == null ? prev : String(defaults.width)));
    setHeight((prev) => (prev || defaults.height == null ? prev : String(defaults.height)));
    setSampler((prev) => (prev || !defaults.sampler ? prev : String(defaults.sampler)));
    imagePrefillKeyRef.current = prefillKey;
  }, [mode, selectedModel, selectedImageModelMeta]);

  useEffect(() => {
    if (mode !== "video" || !selectedVideoModelMeta) {
      if (mode !== "video") videoPrefillKeyRef.current = "";
      return;
    }
    const defaults = selectedVideoModelMeta.video_defaults || undefined;
    if (!defaults) return;
    const prefillKey = `${selectedModel.toLowerCase()}:${JSON.stringify(defaults)}`;
    if (videoPrefillKeyRef.current === prefillKey) return;
    setSteps((prev) => (prev || defaults.steps == null ? prev : String(defaults.steps)));
    setGuidance((prev) => (prev || defaults.guidance == null ? prev : String(defaults.guidance)));
    setWidth((prev) => (prev || defaults.width == null ? prev : String(defaults.width)));
    setHeight((prev) => (prev || defaults.height == null ? prev : String(defaults.height)));
    setFrames((prev) => (prev || defaults.frames == null ? prev : String(defaults.frames)));
    setFps((prev) => (prev || defaults.fps == null ? prev : String(defaults.fps)));
    videoPrefillKeyRef.current = prefillKey;
  }, [mode, selectedModel, selectedVideoModelMeta]);

  useEffect(() => {
    if (mode !== "face_swap" || !selectedFaceSwapModelMeta) {
      if (mode !== "face_swap") faceSwapPrefillKeyRef.current = "";
      return;
    }
    const defaults = selectedFaceSwapModelMeta.face_swap_defaults || undefined;
    if (!defaults) return;
    const prefillKey = `${faceswapModel.toLowerCase()}:${JSON.stringify(defaults)}`;
    if (faceSwapPrefillKeyRef.current === prefillKey) return;
    setFaceswapStrength((prev) => (prev || defaults.strength == null ? prev : String(defaults.strength)));
    setFaceswapSteps((prev) => (prev || defaults.num_steps == null ? prev : String(defaults.num_steps)));
    setFaceswapGuidance((prev) => (prev || defaults.guidance == null ? prev : String(defaults.guidance)));
    faceSwapPrefillKeyRef.current = prefillKey;
  }, [mode, faceswapModel, selectedFaceSwapModelMeta]);

  useEffect(() => {
    let cancelled = false;
    if (!savedInviteCode) {
      setQuota(null);
      setQuotaError(undefined);
      return () => {
        cancelled = true;
      };
    }
    fetchQuota()
      .then((data) => {
        if (!cancelled) {
          setQuota(data);
          setQuotaError(undefined);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message =
          err instanceof HavnaiApiError
            ? err.message
            : err?.message || "Failed to load access limits.";
        setQuota(null);
        setQuotaError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [savedInviteCode]);

  // Fetch credit balance on mount and after each job completes
  useEffect(() => {
    let cancelled = false;
    if (!activeWallet) {
      setCredits(null);
      return () => {
        cancelled = true;
      };
    }
    fetchCredits(activeWallet)
      .then((data) => {
        if (!cancelled) setCredits(data);
      })
      .catch(() => {
        // credits not enabled or endpoint unavailable — that's fine
        if (!cancelled) setCredits(null);
      });
    return () => { cancelled = true; };
  }, [activeWallet, loading]); // re-fetch when loading toggles (i.e. after a job finishes)

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    }
  };

  const addLora = () => {
    setLoras((prev) => [...prev, { name: "", weight: "" }]);
  };

  const updateLora = (index: number, field: "name" | "weight", value: string) => {
    setLoras((prev) =>
      prev.map((entry, idx) => (idx === index ? { ...entry, [field]: value } : entry))
    );
  };

  const updateLoraWeight = (index: number, value: string) => {
    if (!value.trim()) {
      updateLora(index, "weight", "");
      return;
    }
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(2, Math.max(0, parsed));
    updateLora(index, "weight", clamped.toFixed(2));
  };

  const removeLora = (index: number) => {
    setLoras((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveLoraUp = (index: number) => {
    if (index <= 0) return;
    setLoras((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveLoraDown = (index: number) => {
    setLoras((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const cleanLoraDisplayName = (name: string): string => {
    return name
      .replace(/[_-]/g, " ")
      .replace(/\.(safetensors|ckpt|pt|bin)$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const selectedLoraNames = new Set(loras.map((l) => l.name.trim()).filter(Boolean));

  // Build a lookup from name → LoraInfo for pipeline badges
  const loraInfoMap = new Map<string, LoraInfo>();
  for (const info of allLoraInfo) {
    loraInfoMap.set(info.name, info);
  }

  const filteredLoras = availableLoras.filter((name) => {
    if (loraSearch.trim()) {
      return name.toLowerCase().includes(loraSearch.toLowerCase());
    }
    return true;
  });

  const parseOptionalInt = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseOptionalFloat = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const formatResetAt = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read image file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  };

  const captureLastFrameFromVideoUrl = async (url: string): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const video = document.createElement("video");
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video metadata"));
      });
      const targetTime = Math.max(0, (video.duration || 0) - 0.1);
      video.currentTime = targetTime;
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Failed to seek video"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1;
      canvas.height = video.videoHeight || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const buildLoraPayload = (): { name: string; weight?: number }[] => {
    return loras
      .map((entry) => {
        const name = entry.name.trim();
        if (!name) return null;
        const weightValue = parseOptionalFloat(entry.weight);
        const payload: { name: string; weight?: number } = { name, weight: weightValue ?? 1.0 };
        return payload;
      })
      .filter((entry): entry is { name: string; weight?: number } => Boolean(entry));
  };

  const buildOptions = (): SubmitJobOptions | undefined => {
    const options: SubmitJobOptions = {};
    const seedValue = parseOptionalInt(seed);
    const modelDefaults = selectedImageModelMeta?.image_defaults || undefined;
    const sizePreset = imageSizePreset === "auto" ? undefined : selectedImageSizePreset;
    const requestedLoras = buildLoraPayload();

    if (activeWallet) options.wallet = activeWallet;
    options.steps = imageStepPresets[imageQualityPreset];
    if (modelDefaults?.guidance != null) options.guidance = modelDefaults.guidance;
    if (sizePreset?.width != null) options.width = sizePreset.width;
    else if (modelDefaults?.width != null) options.width = modelDefaults.width;
    if (sizePreset?.height != null) options.height = sizePreset.height;
    else if (modelDefaults?.height != null) options.height = modelDefaults.height;
    if (modelDefaults?.sampler) options.sampler = String(modelDefaults.sampler);
    if (seedValue !== undefined) options.seed = seedValue;
    if (requestedLoras.length > 0) options.loras = requestedLoras;
    if (sfwMode) options.sfwMode = true;

    return Object.keys(options).length > 0 ? options : undefined;
  };

  const addLoraByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoras((prev) => {
      if (prev.some((entry) => entry.name.trim() === trimmed)) return prev;
      return [...prev, { name: trimmed, weight: "" }];
    });
  };

  const buildVideoRequest = (
    promptText: string,
    initOverride?: string | null
  ) => {
    const request: Record<string, any> = { prompt: promptText };
    if (activeWallet) request.wallet = activeWallet;
    const trimmedNegative = negativePrompt.trim();
    if (trimmedNegative) request.negativePrompt = trimmedNegative;
    const seedValue = parseOptionalInt(seed);
    request.seed =
      seedValue !== undefined ? seedValue : Math.floor(Math.random() * 1_000_000_000);
    const stepsValue = parseOptionalInt(steps);
    const guidanceValue = parseOptionalFloat(guidance);
    const widthValue = parseOptionalInt(width);
    const heightValue = parseOptionalInt(height);
    const framesValue = parseOptionalInt(frames);
    const fpsValue = parseOptionalInt(fps);
    if (stepsValue !== undefined) request.steps = stepsValue;
    if (guidanceValue !== undefined) request.guidance = guidanceValue;
    if (widthValue !== undefined) request.width = widthValue;
    if (heightValue !== undefined) request.height = heightValue;
    if (framesValue !== undefined) request.frames = framesValue;
    if (fpsValue !== undefined) request.fps = fpsValue;
    const initImageValue = (initOverride ?? (videoInitData || videoInitUrl).trim()).trim();
    if (initImageValue) {
      request.initImage = initImageValue;
    }
    const strengthValue = parseOptionalFloat(videoInitStrength);
    if (strengthValue !== undefined) {
      request.strength = strengthValue;
    }
    if (selectedModel) {
      request.model = selectedModel;
    }
    if (sfwMode) {
      request.sfwMode = true;
    }
    // LTX-Video 2.3 extended fields
    if (isLtxVideoModel) {
      if (ltxPipelineMode) request.pipelineMode = ltxPipelineMode;
      if (ltxUpscaler) request.upscaler = ltxUpscaler;
      if (ltxTemporalUpscale) request.temporalUpscale = true;
    }
    return request as import("../lib/havnai").VideoJobRequest;
  };

  const runVideoChain = async (promptText: string, extraChunks: number) => {
    const total = Math.max(1, 1 + extraChunks);
    const jobIds: string[] = [];
    setChainSummary(null);
    let initImage = (videoInitData || videoInitUrl).trim();
    for (let index = 0; index < total; index += 1) {
      const request = buildVideoRequest(promptText, initImage || undefined);
      const id = await submitVideoJob(request);
      setJobId(id);
      setStatusMessage(`Waiting for available GPU capacity... (${index + 1}/${total})`);
      const result = await pollJob(id, promptText, 2400);
      if (!result || !result.videoUrl) {
        setStatusMessage("Clip generation stopped before a video output was returned.");
        return;
      }
      jobIds.push(id);
      try {
        initImage = await captureLastFrameFromVideoUrl(result.videoUrl);
        setVideoInitData(initImage);
        setVideoInitName(`clip-${index + 1}-lastframe.png`);
        setVideoInitUrl("");
      } catch (err: any) {
        setStatusMessage(err?.message || "Failed to capture last frame.");
        return;
      }
    }

    if (autoStitch && jobIds.length > 1) {
      setStatusMessage("Merging clips...");
      try {
        const stitched = await stitchVideos(jobIds);
        setVideoUrl(stitched.video_url);
        setImageUrl(undefined);
        setStatusMessage("Merged video ready.");
        setChainSummary({ clips: jobIds.length, stitched: true });
      } catch (err: any) {
        setStatusMessage(err?.message || "Automatic clip merge failed.");
        setChainSummary({ clips: jobIds.length, stitched: false });
      }
    } else if (jobIds.length > 1) {
      setChainSummary({ clips: jobIds.length, stitched: false });
    }
  };

  const handleInviteSave = () => {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      handleInviteClear();
      return;
    }
    setInviteCode(trimmed);
    setSavedInviteCode(trimmed);
    setInviteOpen(false);
  };

  const handleInviteClear = () => {
    clearInviteCode();
    setSavedInviteCode(undefined);
    setInviteCodeState("");
    setQuota(null);
    setQuotaError(undefined);
  };

  const handleBaseImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFileAsDataUrl(file);
      setBaseImageData(data);
      setBaseImageName(file.name);
      setBaseImageUrl("");
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to read base image file.");
    }
  };

  const handleFaceSourceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFileAsDataUrl(file);
      setFaceSourceData(data);
      setFaceSourceName(file.name);
      setFaceSourceUrl("");
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to read face source image.");
    }
  };

  const handleVideoInitUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFileAsDataUrl(file);
      setVideoInitData(data);
      setVideoInitName(file.name);
      setVideoInitUrl("");
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to read init image file.");
    }
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    const selectedVideoModelAvailable =
      mode === "video" && videoModels.some((candidate) => candidate.id === selectedModel);
    const promptAnchor = inspectPromptIdentityAnchor(prompt);
    const cleanedPrompt = promptAnchor.promptWithoutTag.trim();
    const effectivePrompt = mode === "face_swap" ? trimmed : cleanedPrompt || trimmed;
    if (!activeWallet) {
      setStatusMessage("Connect a wallet or use an active HavnAI site session before submitting.");
      return;
    }
    if (mode !== "face_swap" && !trimmed) {
      setStatusMessage("Prompt is required.");
      return;
    }
    if (mode !== "image" && promptAnchor.hasAnchorTag) {
      setStatusMessage("Identity anchor tags are only supported for image generation.");
      return;
    }
    if (promptAnchor.error) {
      setStatusMessage(promptAnchor.error);
      return;
    }
    if (mode === "image" && imageModels.length === 0) {
      setStatusMessage("No online image capacity right now. Try again when an image model is available.");
      return;
    }
    if (mode === "image" && !selectedModel) {
      setStatusMessage("Select an available image model before generating.");
      return;
    }
    if (mode === "video" && videoModels.length === 0) {
      setStatusMessage("No online video capacity right now. Try again when a video node is online.");
      return;
    }
    if (mode === "video" && !selectedVideoModelAvailable) {
      setStatusMessage("No online video capacity right now. Select an available video model and try again.");
      return;
    }
    if (mode === "face_swap" && faceSwapModels.length === 0) {
      setStatusMessage("No online face swap capacity right now. Try again when an SDXL face-swap node is online.");
      return;
    }
    if (mode === "face_swap" && !faceswapModel) {
      setStatusMessage("No face swap model is currently selectable.");
      return;
    }
    setLoading(true);
    setStatusMessage("Submitting to the grid...");
    setImageUrl(undefined);
    setVideoUrl(undefined);
    setRuntimeSeconds(null);
    setModel(undefined);
    setJobId(undefined);
    setPollTimedOut(false);
    setLastUsedPrompt(effectivePrompt || "Face swap");

    const extendValue = parseOptionalInt(extendChunks) ?? 0;

    try {
      if (mode === "image") {
        const options = buildOptions();
        const id = await submitAutoJob(
          trimmed,
          selectedModel || undefined,
          "",
          options
        );
        setJobId(id);
        setStatusMessage("Waiting for available GPU capacity...");
        await pollJob(id, effectivePrompt, 1800);
      } else if (mode === "face_swap") {
        const baseUrl = baseImageData || baseImageUrl.trim();
        const faceUrl = faceSourceData || faceSourceUrl.trim();
        if (!baseUrl || !faceUrl) {
          setStatusMessage("Base image and face source are required.");
          return;
        }
        const seedValue = parseOptionalInt(seed);
        const strengthValue = parseOptionalFloat(faceswapStrength);
        const stepsValue = parseOptionalInt(faceswapSteps);
        const guidanceValue = parseOptionalFloat(faceswapGuidance);
        const request: FaceSwapRequest = {
          prompt: trimmed,
          model: faceswapModel,
          baseImageUrl: baseUrl,
          faceSourceUrl: faceUrl,
          seed: seedValue,
          sfwMode,
          wallet: activeWallet,
        };
        if (strengthValue !== undefined) request.strength = strengthValue;
        if (stepsValue !== undefined) request.numSteps = stepsValue;
        if (guidanceValue !== undefined) request.guidance = guidanceValue;
        const id = await submitFaceSwapJob(request);
        setJobId(id);
        setStatusMessage("Waiting for available GPU capacity...");
        await pollJob(id, effectivePrompt || "Face swap", 1800);
      } else if (mode === "video") {
        if (extendValue > 0) {
          await runVideoChain(effectivePrompt, extendValue);
        } else {
          const request = buildVideoRequest(effectivePrompt);
          const id = await submitVideoJob(request);
          setJobId(id);
          setStatusMessage("Waiting for available GPU capacity...");
          await pollJob(id, effectivePrompt, 2400);
        }
      }
    } catch (err: any) {
      if (err instanceof HavnaiApiError || err?.code) {
        const code = err.code || err?.data?.error;
        if (code === "insufficient_credits") {
          const bal = err?.data?.balance ?? "?";
          const cost = err?.data?.cost ?? "?";
          setStatusMessage(`Not enough credits for this request. Need ${cost}, available ${bal}.`);
        } else if (code === "invite_required") {
          setStatusMessage("This generation path currently requires a Public Alpha access code.");
          setInviteOpen(true);
        } else if (code === "rate_limited") {
          const resetLabel = formatResetAt(err?.data?.reset_at);
          setStatusMessage(
            resetLabel
              ? `This access code has reached its current limit. Resets at ${resetLabel}.`
              : "This access code has reached its current limit. Please try again later."
          );
        } else if (code === "no_capacity") {
          const message =
            err?.data?.message ||
            "No compatible online node capacity is available right now. Please try again shortly.";
          setStatusMessage(message);
        } else {
          setStatusMessage(err.message || "Failed to submit job.");
        }
      } else {
        setStatusMessage(err?.message || "Failed to submit job.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to finalize a completed job
  const finalizeJob = async (
    id: string,
    usedPrompt: string,
    job: JobDetailResponse
  ): Promise<{
    videoUrl?: string;
    imageUrl?: string;
    job: JobDetailResponse;
  } | null> => {
    let runtime: number | null = null;
    if (
      typeof job.timestamp === "number" &&
      typeof job.completed_at === "number"
    ) {
      runtime = Math.max(0, job.completed_at - job.timestamp);
    }

    const result = await fetchResult(id);
    const resolvedImage = result.image_url;
    const resolvedVideo = result.video_url;
    if (!resolvedImage && !resolvedVideo) {
      setStatusMessage("Job finished, but no output was found.");
      return null;
    }

    const createdAt =
      typeof job.timestamp === "number"
        ? new Date(job.timestamp * 1000).toISOString()
        : new Date().toISOString();
    let type: LibraryItemType = "unknown";
    if (resolvedVideo) type = "video";
    else if (resolvedImage) type = "image";
    addToLibrary({ job_id: id, created_at: createdAt, type });

    if (resolvedVideo) {
      setVideoUrl(resolvedVideo);
      setImageUrl(undefined);
    } else if (resolvedImage) {
      setImageUrl(resolvedImage);
      setVideoUrl(undefined);
    }
    setRuntimeSeconds(runtime);
    setModel(job.model);
    setStatusMessage("Output ready.");
    setPollTimedOut(false);

    if (resolvedImage || resolvedVideo) {
      const item: HistoryItem = {
        jobId: id,
        prompt: usedPrompt,
        imageUrl: resolvedImage,
        videoUrl: resolvedVideo,
        model: job.model,
        timestamp: Date.now(),
      };
      const next = [item, ...history].slice(0, 5);
      saveHistory(next);
    }
    return { videoUrl: resolvedVideo, imageUrl: resolvedImage, job };
  };

  const pollJob = async (id: string, usedPrompt: string, maxWaitSeconds = 600) => {
    const start = Date.now();
    setPollTimedOut(false);

    // Try SSE-accelerated polling: listen for real-time updates via SSE and
    // only fall back to HTTP polling every 5s (instead of 1.5s) as a safety net.
    const sse = getJobSSE();
    let sseResolved = false;

    const ssePromise = new Promise<"completed" | "failed" | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), maxWaitSeconds * 1000);
      const unsub = sse.subscribe((event: SSEEvent) => {
        if (event.event !== "job_lifecycle") return;
        if (event.job_id !== id) return;
        const status = (event.lifecycle_status || event.status || "").toUpperCase();
        if (status === "QUEUED") {
          setStatusMessage("Queued on the grid...");
        } else if (status === "RUNNING") {
          setStatusMessage("Rendering on a HavnAI node...");
        } else if (status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED") {
          setStatusMessage("Finalizing your output...");
          sseResolved = true;
          clearTimeout(timeout);
          unsub();
          resolve("completed");
        } else if (status === "FAILED" || status === "CANCELLED") {
          sseResolved = true;
          clearTimeout(timeout);
          unsub();
          resolve("failed");
        }
      });

      // Also start SSE connection
      sse.connect();
    });

    // Run SSE listener and fallback polling in parallel
    const pollFallback = async (): Promise<"completed" | "failed" | "timeout"> => {
      while ((Date.now() - start) / 1000 < maxWaitSeconds) {
        if (sseResolved) return "completed"; // SSE already resolved it

        try {
          const job = await fetchJob(id);
          const status = (job.status || "").toUpperCase();

          if (status === "QUEUED") {
            const elapsed = (Date.now() - start) / 1000;
            if (elapsed > 120) {
              setStatusMessage("This render is still queued. The system will retry automatically if needed.");
            } else {
              setStatusMessage("Queued on the grid...");
            }
          } else if (status === "RUNNING") {
            const elapsed = (Date.now() - start) / 1000;
            if (elapsed > 300) {
              setStatusMessage("This render is still running. If the worker stalls, it will be requeued automatically.");
            } else {
              setStatusMessage("Rendering on a HavnAI node...");
            }
          } else if (status === "SUCCESS" || status === "COMPLETED") {
            setStatusMessage("Finalizing your output...");
            return "completed";
          } else if (status === "FAILED" || status === "CANCELLED") {
            return "failed";
          } else {
            setStatusMessage(`Status: ${status || "Unknown"}`);
          }
        } catch (err: any) {
          setStatusMessage(err?.message || "Error while polling job.");
        }

        // Poll every 5s (SSE handles fast updates)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      return "timeout";
    };

    const result = await Promise.race([
      ssePromise,
      pollFallback(),
    ]);

    // Finalize based on result
    if (result === "completed") {
      try {
        const job = await fetchJob(id);
        return await finalizeJob(id, usedPrompt, job);
      } catch {
        setStatusMessage("Job completed but failed to fetch result.");
        return null;
      }
    }

    if (result === "failed") {
      setStatusMessage("Job failed on the grid.");
      setPollTimedOut(false);
      return null;
    }

    // Timeout - try final check
    const elapsed = (Date.now() - start) / 1000;
    try {
      const job = await fetchJob(id).catch(() => null);
      const fetchedResult = await fetchResult(id).catch(() => null);
      const resolvedImage = fetchedResult?.image_url;
      const resolvedVideo = fetchedResult?.video_url;
      if (resolvedImage || resolvedVideo) {
        if (resolvedVideo) {
          setVideoUrl(resolvedVideo);
          setImageUrl(undefined);
        } else {
          setImageUrl(resolvedImage);
          setVideoUrl(undefined);
        }
        if (
          job &&
          typeof job.timestamp === "number" &&
          typeof job.completed_at === "number"
        ) {
          setRuntimeSeconds(Math.max(0, job.completed_at - job.timestamp));
        }
        if (job?.model) setModel(job.model);
        const createdAt =
          job && typeof job.timestamp === "number"
            ? new Date(job.timestamp * 1000).toISOString()
            : new Date().toISOString();
        let type: LibraryItemType = "unknown";
        if (resolvedVideo) type = "video";
        else if (resolvedImage) type = "image";
        addToLibrary({ job_id: id, created_at: createdAt, type });
        const item: HistoryItem = {
          jobId: id,
          prompt: usedPrompt,
          imageUrl: resolvedImage,
          videoUrl: resolvedVideo,
          model: job?.model,
          timestamp: Date.now(),
        };
        const next = [item, ...history].slice(0, 5);
        saveHistory(next);
        setStatusMessage("Output ready.");
        setPollTimedOut(false);
        return { videoUrl: resolvedVideo, imageUrl: resolvedImage, job: job || undefined };
      }
    } catch {
      // Ignore
    }

    setPollTimedOut(true);
    setStatusMessage(
      `This render is still in progress after ${elapsed.toFixed(
        1
      )} seconds. Select "Check status" to keep waiting.`
    );
    return null;
  };

  const handleCheckStatus = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await pollJob(jobId, lastUsedPrompt || prompt || "Job", mode === "video" ? 2400 : 1800);
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    if (item.videoUrl) {
      setVideoUrl(item.videoUrl);
      setImageUrl(undefined);
    } else {
      setImageUrl(item.imageUrl);
      setVideoUrl(undefined);
    }
    setModel(item.model);
    setRuntimeSeconds(null);
    setJobId(item.jobId);
    setStatusMessage("Showing a saved result from this browser. Generate again when you want a fresh render.");
    const summary: JobSummary = {
      job_id: item.jobId,
      model: item.model,
      image_url: item.imageUrl,
      video_url: item.videoUrl,
      submitted_at: new Date(item.timestamp).toISOString(),
    };
    void openJobDetails(item.jobId, summary);
  };

  const handleHistoryClear = () => {
    saveHistory([]);
    setImageUrl(undefined);
    setVideoUrl(undefined);
    setModel(undefined);
    setRuntimeSeconds(null);
    setJobId(undefined);
    setStatusMessage(undefined);
  };

  const handleUseLastFrame = (dataUrl: string) => {
    setMode("video");
    setAdvancedOpen(true);
    setVideoInitData(dataUrl);
    setVideoInitName("last-frame.png");
    setVideoInitUrl("");
    setStatusMessage("Loaded last frame as init image.");
  };

  const openJobDetails = async (id: string, summary?: JobSummary) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(undefined);
    setDrawerSummary(summary || null);
    try {
      const { job, result } = await fetchJobWithResult(id);
      setDrawerJob(job);
      setDrawerResult(result || null);
    } catch (err: any) {
      setDrawerError(err?.message || "Failed to load job details.");
    } finally {
      setDrawerLoading(false);
    }
  };

  // Mobile nav toggle (reuse behavior from index.html)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const navToggle = document.getElementById("navToggle");
    const primaryNav = document.getElementById("primaryNav");
    if (!navToggle || !primaryNav) return;
    const handler = () => {
      primaryNav.classList.toggle("nav-open");
      navToggle.classList.toggle("nav-open");
    };
    navToggle.addEventListener("click", handler);
    return () => navToggle.removeEventListener("click", handler);
  }, []);

  const totalVisibleModels =
    imageModels.length + videoModels.length + faceSwapModels.length;
  const creditSummary =
    credits && credits.credits_enabled
      ? `${credits.balance.toFixed(1)} cr`
      : inviteSaved
      ? "Invite saved"
      : "Access code";
  const modeSummary =
    mode === "face_swap" ? "Face swap" : mode === "video" ? "Video" : "Image";

  return (
    <>
      <Head>
        <title>JoinHavn Generator</title>
        <meta
          name="description"
          content="Create images, face swaps, and video on the JoinHavn GPU grid with live model routing and wallet-linked alpha access."
        />
      </Head>

      <SiteHeader />

      <main className="jh-page-shell">
        <CinematicPageHero
          eyebrow={`${PUBLIC_ALPHA_LABEL} Generator`}
          title="Create on the grid."
          description="Write a prompt, route into live network capacity, and generate images, face swaps, or video without leaving the JoinHavn creation stack."
          mediaVariant="creation"
          panelEyebrow="Creation Deck"
          panelTitle={`${totalVisibleModels.toLocaleString()} visible model slots`}
          panelDescription={`Current mode: ${modeSummary}. Use the generator to render, inspect job status, and push finished outputs into your library or marketplace flow.`}
          stats={[
            {
              label: "Mode",
              value: modeSummary,
              detail: "Switch between image, video, and face swap",
            },
            {
              label: "Visible Models",
              value: totalVisibleModels.toLocaleString(),
              detail: "Pulled from live capacity",
            },
            {
              label: "Access",
              value: creditSummary,
              detail: inviteSaved ? "Saved in this browser" : "Add invite if provided",
            },
          ]}
          actions={
            <>
              <Link href="/library" className="jh-btn jh-btn-primary">
                Open Library
              </Link>
              <Link href="/pricing" className="jh-btn jh-btn-secondary">
                Manage Credits
              </Link>
            </>
          }
        />

        <section className="generator-section">
          <div className="generator-card">
            <div className="generator-grid">
              <div className="generator-left">
                <div className="invite-panel">
                  <div className={`invite-badge${inviteSaved ? " is-ok" : " is-missing"}`}>
                    {inviteSaved ? "Access code saved" : "No access code added"}
                  </div>
                  {quota && (
                    <div className="quota-bars">
                      <div className="quota-bar-group">
                        <span className="quota-bar-label">Daily jobs</span>
                        <div className="quota-bar-track">
                          <div
                            className={`quota-bar-fill ${
                              quota.max_daily > 0 && quota.used_today / quota.max_daily > 0.85
                                ? "is-high"
                                : ""
                            }`}
                            style={{
                              width: quota.max_daily > 0
                                ? `${Math.min((quota.used_today / quota.max_daily) * 100, 100)}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span className="quota-bar-value">
                          {quota.max_daily > 0
                            ? `${quota.used_today}/${quota.max_daily}`
                            : `${quota.used_today}`}
                        </span>
                      </div>
                      <div className="quota-bar-group">
                        <span className="quota-bar-label">Concurrent jobs</span>
                        <div className="quota-bar-track">
                          <div
                            className={`quota-bar-fill ${
                              quota.max_concurrent > 0 && quota.used_concurrent / quota.max_concurrent > 0.85
                                ? "is-high"
                                : ""
                            }`}
                            style={{
                              width: quota.max_concurrent > 0
                                ? `${Math.min((quota.used_concurrent / quota.max_concurrent) * 100, 100)}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span className="quota-bar-value">
                          {quota.max_concurrent > 0
                            ? `${quota.used_concurrent}/${quota.max_concurrent}`
                            : `${quota.used_concurrent}`}
                        </span>
                      </div>
                    </div>
                  )}
                  {!quota && quotaError && (
                    <div className="invite-quota invite-error">{quotaError}</div>
                  )}
                  {credits && credits.credits_enabled && (
                    <div className="invite-quota">
                      Credits: {credits.balance.toFixed(1)}
                    </div>
                  )}
                  <div className="generator-wallet-summary">
                    <div className="generator-wallet-copy">
                      <span className={`wallet-status-pill wallet-source-${wallet.source}`}>{walletSourceLabel}</span>
                      <p className="generator-help" style={{ marginTop: "0.5rem" }}>
                        Active identity: <strong>{walletIdentityLabel}</strong>
                      </p>
                      <p className="generator-help">{walletStatusCopy}</p>
                    </div>
                    <button
                      type="button"
                      className="generator-mini-button"
                      onClick={() => void wallet.connect()}
                      disabled={wallet.connecting}
                    >
                      {connectLabel}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="invite-toggle"
                    onClick={() => setInviteOpen((prev) => !prev)}
                  >
                    {inviteSaved ? "Edit access code" : "Add access code"}
                  </button>
                  <p className="generator-help" style={{ marginTop: "0.75rem" }}>
                    Add an access code here if your Public Alpha invite included one.
                  </p>
                </div>
                {inviteOpen && (
                  <div className="invite-form">
                    <label className="generator-label" htmlFor="invite-code">
                      Public Alpha access code (if provided)
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      className="generator-input"
                      placeholder="Enter your access code"
                      value={inviteCode}
                      onChange={(e) => setInviteCodeState(e.target.value)}
                    />
                    <div className="invite-actions">
                      <button
                        type="button"
                        className="generator-mini-button"
                        onClick={handleInviteSave}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="generator-mini-button"
                        onClick={handleInviteClear}
                      >
                        Clear
                      </button>
                    </div>
                    <p className="generator-help">Only stored in this browser.</p>
                  </div>
                )}
                <div className="generator-mode-tabs">
                  <button
                    type="button"
                    className={`generator-mode-button${mode === "image" ? " is-active" : ""}`}
                    onClick={() => setMode("image")}
                  >
                    Image
                  </button>
                  <button
                    type="button"
                    className={`generator-mode-button${mode === "video" ? " is-active" : ""}`}
                    onClick={() => setMode("video")}
                  >
                    Video
                  </button>
                  <button
                    type="button"
                    className={`generator-mode-button${mode === "face_swap" ? " is-active" : ""}`}
                    onClick={() => setMode("face_swap")}
                  >
                    Face swap
                  </button>
                </div>
                <label className="generator-label" htmlFor="prompt">
                  {mode === "face_swap" ? "Style prompt (optional)" : "Prompt"}
                </label>
                <HavnAIPrompt
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={handleSubmit}
                  disabled={loading}
                />
                {mode === "image" && (
                  <p className="generator-help">
                    Add <code>[IDENTITY ANCHOR: slug]</code> to an image prompt when you want a stable facial identity across multiple renders.
                  </p>
                )}

                {mode === "face_swap" && (
                  <div className="generator-advanced">
                    <span className="generator-label">Face swap inputs</span>
                    <label className="generator-label" htmlFor="base-image-url">
                      Base image URL
                    </label>
                    <input
                      id="base-image-url"
                      type="text"
                      className="generator-input"
                      placeholder="https://example.com/photo.png"
                      value={baseImageUrl}
                      onChange={(e) => {
                        setBaseImageUrl(e.target.value);
                        setBaseImageData(undefined);
                        setBaseImageName(undefined);
                      }}
                    />
                    <label className="generator-label" htmlFor="base-image-upload">
                      Or upload base image
                    </label>
                    <input
                      id="base-image-upload"
                      type="file"
                      accept="image/*"
                      className="generator-input"
                      onChange={handleBaseImageUpload}
                    />
                    {baseImageName && (
                      <p className="generator-help">Using uploaded file: {baseImageName}</p>
                    )}
                    {baseImageData && (
                      <div className="generator-face-preview">
                        <img src={baseImageData} alt="Base preview" />
                      </div>
                    )}
                    <label className="generator-label" htmlFor="face-source-url">
                      Face source URL
                    </label>
                    <input
                      id="face-source-url"
                      type="text"
                      className="generator-input"
                      placeholder="https://example.com/photo.png"
                      value={faceSourceUrl}
                      onChange={(e) => {
                        setFaceSourceUrl(e.target.value);
                        setFaceSourceData(undefined);
                        setFaceSourceName(undefined);
                      }}
                    />
                    <label className="generator-label" htmlFor="face-source-upload">
                      Or upload face source
                    </label>
                    <input
                      id="face-source-upload"
                      type="file"
                      accept="image/*"
                      className="generator-input"
                      onChange={handleFaceSourceUpload}
                    />
                    {faceSourceName && (
                      <p className="generator-help">Using uploaded file: {faceSourceName}</p>
                    )}
                    {faceSourceData && (
                      <div className="generator-face-preview">
                        <img src={faceSourceData} alt="Face source preview" />
                      </div>
                    )}
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="faceswap-strength">
                          Strength
                        </label>
                        <input
                          id="faceswap-strength"
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          className="generator-input"
                          placeholder="Recommended"
                          value={faceswapStrength}
                          onChange={(e) => setFaceswapStrength(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="generator-label" htmlFor="faceswap-steps">
                          Steps
                        </label>
                        <input
                          id="faceswap-steps"
                          type="number"
                          min={5}
                          max={60}
                          step={1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={faceswapSteps}
                          onChange={(e) => setFaceswapSteps(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="generator-label" htmlFor="faceswap-guidance">
                          Guidance
                        </label>
                        <input
                          id="faceswap-guidance"
                          type="number"
                          min={0}
                          max={12}
                          step={0.1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={faceswapGuidance}
                          onChange={(e) => setFaceswapGuidance(e.target.value)}
                        />
                      </div>
                    </div>
                    <label className="generator-label" htmlFor="faceswap-model">
                      Base SDXL model
                    </label>
                    <select
                      id="faceswap-model"
                      value={faceswapModel}
                      onChange={(e) => setFaceswapModel(e.target.value)}
                      className="generator-select"
                    >
                      {faceSwapModels.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {selectedFaceSwapModelMeta?.face_swap_defaults && (
                      <p className="generator-help">
                        This model includes recommended Public Alpha defaults (source: {faceSwapDefaultsBadge}). Leave those fields blank to use them automatically.
                      </p>
                    )}
                    <p className="generator-help">
                      LoRA controls stay hidden in Public Alpha so face-swap output stays predictable.
                    </p>
                  </div>
                )}

                <div className="generator-controls">
                  <HavnAIButton
                    label={
                      mode === "face_swap"
                        ? "Run face swap"
                        : mode === "video"
                        ? "Generate video"
                        : "Generate image"
                    }
                    loading={loading}
                    disabled={mode !== "face_swap" && !prompt.trim()}
                    onClick={handleSubmit}
                  />
                  <label className="generator-checkbox">
                    <input
                      type="checkbox"
                      checked={sfwMode}
                      onChange={(e) => setSfwMode(e.target.checked)}
                    />
                    <span>SFW mode (adds stricter safety negatives)</span>
                  </label>
                  {mode !== "face_swap" && (
                    <button
                      type="button"
                      className="generator-advanced-toggle"
                      onClick={() => setAdvancedOpen((v) => !v)}
                      aria-expanded={advancedOpen}
                    >
                      <svg
                        className={`toggle-chevron${advancedOpen ? " is-open" : ""}`}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      {advancedOpen ? "Hide advanced options" : "Show advanced options"}
                    </button>
                  )}
                </div>

                {advancedOpen && mode === "image" && (
                  <div className="generator-advanced">
                    <div className="adv-group">
                      <label className="generator-label" htmlFor="image-model">
                        Model
                      </label>
                      <select
                        id="image-model"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="generator-select"
                      >
                        {imageModels.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="generator-help">
                        Pick the image model you want to run for this render.
                      </p>
                      {selectedImageModelMeta?.image_defaults && (
                        <p className="generator-help">
                          Using recommended defaults for this model (source: {imageDefaultsBadge})
                          {imageDefaultsSummary ? `: ${imageDefaultsSummary}.` : "."}
                        </p>
                      )}
                      <span className="adv-group-title">Generation settings</span>
                      <label className="generator-label" htmlFor="image-steps">
                        Steps
                      </label>
                      <select
                        id="image-steps"
                        className="generator-select"
                        value={imageQualityPreset}
                        onChange={(e) => setImageQualityPreset(e.target.value as ImageQualityPreset)}
                      >
                        <option value="fastest">{imageStepPresets.fastest} steps · Fastest</option>
                        <option value="balanced">{imageStepPresets.balanced} steps · Balanced</option>
                        <option value="best">{imageStepPresets.best} steps · Best quality</option>
                      </select>
                      <p className="generator-help">
                        Step presets now adapt to the selected model's recommended baseline.
                      </p>
                      <label className="generator-label" htmlFor="image-size-preset">
                        Image size
                      </label>
                      <select
                        id="image-size-preset"
                        className="generator-select"
                        value={imageSizePreset}
                        onChange={(e) => setImageSizePreset(e.target.value as ImageSizePreset)}
                      >
                        {IMAGE_SIZE_PRESETS.map((preset) => {
                          const resolution =
                            preset.id === "auto"
                              ? selectedImageResolution
                              : formatResolutionLabel(preset.width, preset.height);
                          const label =
                            preset.id === "auto"
                              ? resolution
                                ? `${preset.label} · ${resolution}`
                                : `${preset.label} · Model default`
                              : `${preset.label} · ${resolution}`;
                          return (
                            <option key={preset.id} value={preset.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <p className="generator-help">
                        Auto uses the selected model&apos;s recommended resolution. Presets use SDXL-safe aspect ratios.
                      </p>
                      <label className="generator-label" htmlFor="image-seed">
                        Seed (optional)
                      </label>
                      <input
                        id="image-seed"
                        type="number"
                        min={0}
                        step={1}
                        className="generator-input"
                        placeholder="Random"
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                      />
                      <p className="generator-help">
                        Leave blank for random seed each run.
                      </p>
                    </div>
                  </div>
                )}

                {advancedOpen && mode === "video" && (
                  <div className="generator-advanced">
                    <span className="generator-label">Video settings</span>
                    <p className="generator-help">
                      {isLtxVideoModel
                        ? "LTX-Video 2.3: up to 257 frames at 24fps (~10s). DiT model with audio+video sync."
                        : "LTX2 defaults to 16 frames at 8fps (~2s). AnimateDiff can go longer but is heavier."}
                    </p>
                    <label className="generator-label" htmlFor="video-model">
                      Video model
                    </label>
                    <select
                      id="video-model"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="generator-select"
                    >
                      {videoModels.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {selectedVideoModelMeta?.video_defaults && (
                      <p className="generator-help">
                        Using recommended defaults for this model (source: {videoDefaultsBadge}). Leave fields blank to apply them automatically.
                      </p>
                    )}
                    {isLtxVideoModel && ltxVideoModes.length > 0 && (
                      <>
                        <label className="generator-label" htmlFor="ltx-pipeline-mode">
                          Pipeline mode
                        </label>
                        <select
                          id="ltx-pipeline-mode"
                          value={ltxPipelineMode}
                          onChange={(e) => setLtxPipelineMode(e.target.value)}
                          className="generator-select"
                        >
                          {ltxVideoModes.map((m: string) => (
                            <option key={m} value={m}>
                              {m.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <p className="generator-help">
                          two stage = best quality. distilled fast = 8 steps. one stage = no upscale.
                        </p>
                        <div className="generator-row">
                          <div>
                            <label className="generator-label" htmlFor="ltx-upscaler">
                              Spatial upscaler
                            </label>
                            <select
                              id="ltx-upscaler"
                              value={ltxUpscaler}
                              onChange={(e) => setLtxUpscaler(e.target.value)}
                              className="generator-select"
                            >
                              <option value="">None</option>
                              <option value="spatial_upscaler_x2">Spatial upscale</option>
                            </select>
                          </div>
                          <div>
                            <label className="generator-checkbox">
                              <input
                                type="checkbox"
                                checked={ltxTemporalUpscale}
                                onChange={(e) => setLtxTemporalUpscale(e.target.checked)}
                              />
                              <span>Temporal upscale (2x frames)</span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                    <label className="generator-label" htmlFor="negative-prompt-video">
                      Negative prompt (optional)
                    </label>
                    <textarea
                      id="negative-prompt-video"
                      className="generator-input"
                      placeholder="Optional negatives"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      rows={2}
                    />
                    <span className="generator-label">Init image (optional)</span>
                    <label className="generator-label" htmlFor="video-init-url">
                      Init image URL
                    </label>
                    <input
                      id="video-init-url"
                      type="text"
                      className="generator-input"
                      placeholder="https://... or data:image/..."
                      value={videoInitUrl}
                      onChange={(e) => {
                        setVideoInitUrl(e.target.value);
                        if (e.target.value.trim()) {
                          setVideoInitData(undefined);
                          setVideoInitName(undefined);
                        }
                      }}
                    />
                    <label className="generator-label" htmlFor="video-init-upload">
                      Upload init image
                    </label>
                    <input
                      id="video-init-upload"
                      type="file"
                      accept="image/*"
                      className="generator-input"
                      onChange={handleVideoInitUpload}
                    />
                    {videoInitName && (
                      <p className="generator-help">Using uploaded file: {videoInitName}</p>
                    )}
                    <label className="generator-label" htmlFor="video-init-strength">
                      Init image strength
                    </label>
                    <input
                      id="video-init-strength"
                      type="number"
                      min={0.1}
                      max={0.95}
                      step={0.05}
                      className="generator-input"
                      placeholder="0.55"
                      value={videoInitStrength}
                      onChange={(e) => setVideoInitStrength(e.target.value)}
                    />
                    <p className="generator-help">
                      Lower = more preservation (0.35–0.5). Higher = more motion/change (0.6–0.75). Start with 0.55 and adjust.
                    </p>
                    <span className="generator-label">Generation settings</span>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="steps">
                          Steps
                        </label>
                        <input
                          id="steps"
                          type="number"
                          min={1}
                          max={isLtxVideoModel ? 150 : 50}
                          step={1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={steps}
                          onChange={(e) => setSteps(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="generator-label" htmlFor="guidance">
                          Guidance
                        </label>
                        <input
                          id="guidance"
                          type="number"
                          min={0}
                          max={isLtxVideoModel ? 20 : 12}
                          step={0.1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={guidance}
                          onChange={(e) => setGuidance(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="width">
                          Width
                        </label>
                        <input
                          id="width"
                          type="number"
                          min={256}
                          max={isLtxVideoModel ? 1280 : 768}
                          step={64}
                          className="generator-input"
                          placeholder="Recommended"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="generator-label" htmlFor="height">
                          Height
                        </label>
                        <input
                          id="height"
                          type="number"
                          min={256}
                          max={isLtxVideoModel ? 1280 : 768}
                          step={64}
                          className="generator-input"
                          placeholder="Recommended"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="frames">
                          Frames
                        </label>
                        <input
                          id="frames"
                          type="number"
                          min={1}
                          max={isLtxVideoModel ? 257 : 64}
                          step={1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={frames}
                          onChange={(e) => setFrames(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="generator-label" htmlFor="fps">
                          FPS
                        </label>
                        <input
                          id="fps"
                          type="number"
                          min={1}
                          max={isLtxVideoModel ? 60 : 24}
                          step={1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={fps}
                          onChange={(e) => setFps(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="generator-help">
                      {isLtxVideoModel
                        ? "LTX-Video 2.3: 97 frames default (~4s @ 24fps), up to 257 frames. Upscalers available for higher resolution."
                        : "AnimateDiff: 16 frames optimal, max 32 (4s @ 8fps). LTX2: max 16 frames (2s @ 8fps). Use auto-extend chunks below for longer videos."}
                    </p>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="extend-chunks">
                          Auto-extend chunks
                        </label>
                        <input
                          id="extend-chunks"
                          type="number"
                          min={0}
                          max={6}
                          step={1}
                          className="generator-input"
                          placeholder="0"
                          value={extendChunks}
                          onChange={(e) => setExtendChunks(e.target.value)}
                        />
                        <p className="generator-help">
                          Generates additional back-to-back clips (uses last frame as the next init image).
                        </p>
                        <label className="generator-checkbox">
                          <input
                            type="checkbox"
                            checked={autoStitch}
                            onChange={(e) => setAutoStitch(e.target.checked)}
                          />
                          <span>Auto-stitch clips (requires ffmpeg on coordinator)</span>
                        </label>
                      </div>
                    </div>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="seed">
                          Seed
                        </label>
                        <input
                          id="seed"
                          type="number"
                          min={0}
                          step={1}
                          className="generator-input"
                          placeholder="Random"
                          value={seed}
                          onChange={(e) => setSeed(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <StatusBox message={statusMessage} />
                {chainSummary && (
                  <div className="chain-summary">
                    <span className="chain-summary-icon">{chainSummary.stitched ? "\u2714" : "\u26A0"}</span>
                    <span>
                      {chainSummary.clips} clip{chainSummary.clips !== 1 ? "s" : ""} generated
                      {chainSummary.stitched
                        ? " and stitched into a single video."
                        : " (stitching skipped or failed)."}
                    </span>
                  </div>
                )}
                {pollTimedOut && jobId ? (
                  <button
                    type="button"
                    className="generator-mini-button"
                    onClick={handleCheckStatus}
                    disabled={loading}
                  >
                    Check status
                  </button>
                ) : null}
              </div>

              <div className="generator-right">
                <label className="generator-label">Output</label>
                <OutputCard
                  imageUrl={imageUrl}
                  videoUrl={videoUrl}
                  model={model}
                  runtimeSeconds={runtimeSeconds || null}
                  jobId={jobId}
                  onUseLastFrame={handleUseLastFrame}
                />
              </div>
            </div>

            <HistoryFeed
              items={history}
              activeJobId={jobId || undefined}
              onSelect={handleHistorySelect}
              onClear={handleHistoryClear}
            />
          </div>
        </section>
      </main>
      <JobDetailsDrawer
        open={drawerOpen}
        jobId={drawerJob?.id || drawerSummary?.job_id || jobId}
        summary={drawerSummary}
        job={drawerJob}
        result={drawerResult}
        loading={drawerLoading}
        error={drawerError}
        marketplace={{
          wallet: wallet.activeWallet,
          canSign: Boolean(wallet.connectedWallet),
          source: wallet.source,
        }}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default TestPage;
