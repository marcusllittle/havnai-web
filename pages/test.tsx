import React, { useEffect, useRef, useState } from "react";
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

const HISTORY_KEY = "havnai_test_history_v1";

// LoRA support disabled for MVP – set to true to re-enable
const ENABLE_LORA = false;

// Fallback models for offline development – SDXL only
const FALLBACK_IMAGE_MODELS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (let grid choose best)" },
  { id: "juggernautXL_ragnarokBy", label: "Juggernaut XL · Tier S · SDXL" },
  { id: "epicrealismXL_vxviiCrystalclear", label: "Epic Realism XL · Tier S · SDXL" },
  { id: "cyberrealisticPony_v160", label: "Cyberrealistic Pony · Tier B · SDXL" },
];

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
  name: string;
  tier: string;
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
};

type GeneratorMode = "image" | "face_swap" | "video";

const TestPage: React.FC = () => {
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [hardcoreMode, setHardcoreMode] = useState(false);
  const [useStandardNegative, setUseStandardNegative] = useState(true);
  const [imageModels, setImageModels] = useState<{ id: string; label: string }[]>(FALLBACK_IMAGE_MODELS);
  const [videoModels, setVideoModels] = useState<{ id: string; label: string }[]>([]);
  const [faceSwapModels, setFaceSwapModels] = useState<{ id: string; label: string }[]>([]);
  const [modelRuntimeDefaults, setModelRuntimeDefaults] = useState<Record<string, ModelListEntry>>({});
  const [steps, setSteps] = useState("");
  const [guidance, setGuidance] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [frames, setFrames] = useState("");
  const [fps, setFps] = useState("");
  const [extendChunks, setExtendChunks] = useState("0");
  const [sampler, setSampler] = useState("");
  const [seed, setSeed] = useState("");
  const [loras, setLoras] = useState<LoraDraft[]>([]);
  const [autoStitch, setAutoStitch] = useState(false);
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
  const imagePrefillKeyRef = useRef<string>("");
  const videoPrefillKeyRef = useRef<string>("");
  const faceSwapPrefillKeyRef = useRef<string>("");

  const apiBase = getApiBase();

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
  const currentPipeline = selectedModel && selectedModel !== "auto"
    ? modelPipelines[selectedModel.toLowerCase()] || ""
    : "";
  const selectedImageModelMeta =
    selectedModel && selectedModel !== "auto" ? modelRuntimeDefaults[selectedModel.toLowerCase()] : undefined;
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

  useEffect(() => {
    let active = true;
    const loadLoras = async () => {
      // LoRA support disabled for MVP
      if (!ENABLE_LORA) return;
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

    // Clean up technical model names for better UX
    const cleanModelName = (name: string): string => {
      // Remove version suffixes like _v5SD15, _vxviiCrystalclear, _v23Final, _beta, etc.
      let cleaned = name
        .replace(/_v\d+SD15/i, "")
        .replace(/_v[xvi]+[a-z]*/i, "") // Removes _vxviiCrystalclear, _v23Final, etc.
        .replace(/_v\d+/i, "")
        .replace(/By$/i, "")
        .replace(/_beta$/i, " (Beta)")
        .replace(/_final$/i, "")
        .replace(/Merge$/i, "")
        .replace(/Porn/gi, "")
        .replace(/_/g, " ");

      // Special case replacements for readability
      cleaned = cleaned
        .replace(/XL /g, "XL ")
        .replace(/SD15/g, "")
        .replace(/amix/i, "aMix")
        .replace(/pony/i, "Pony");

      // Capitalize first letter of each word
      cleaned = cleaned
        .split(" ")
        .map((word) => {
          if (!word) return "";
          // Keep acronyms and versions uppercase
          if (word === "XL" || word === "v5" || word === "v60" || word === "V10") return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ")
        .trim();

      return cleaned;
    };

    const loadModels = async () => {
      if (typeof window === "undefined") return;
      try {
        const res = await fetch(`${getApiBase()}/models/list`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`models HTTP ${res.status}`);
        const data = await res.json();
        const models: ModelListEntry[] = Array.isArray(data?.models) ? data.models : [];

        if (!active) return;

        // Separate models by task type – MVP: only show SDXL image models
        const imageModelsData = models.filter((m) => {
          const taskType = String(m.task_type || "").toUpperCase();
          const pipeline = String(m.pipeline || "").toLowerCase();
          return (taskType === "IMAGE_GEN" || !taskType) && pipeline === "sdxl";
        });
        const videoModelsData = models.filter((m) => {
          const taskType = String(m.task_type || "").toUpperCase();
          return (taskType === "VIDEO_GEN" || taskType === "ANIMATEDIFF") && m.available === true;
        });

        // Face swap models: only currently available SDXL entries.
        const faceSwapModelsData = imageModelsData.filter((m) => {
          const pipeline = String(m.pipeline || "").toLowerCase();
          return pipeline.includes("sdxl") && m.face_swap_available === true;
        });

        // Transform to dropdown format with tier badges and clean names
        const imageOptions = [
          { id: "auto", label: "Auto (let grid choose best)" },
          ...imageModelsData.map((m) => ({
            id: m.name,
            label: `${cleanModelName(m.name)} · Tier ${m.tier} · ${String(m.pipeline || "").toUpperCase()}`,
          })),
        ];

        const videoOptions = videoModelsData.map((m) => {
          const isAnimateDiff = String(m.task_type || "").toUpperCase() === "ANIMATEDIFF";
          const typeLabel = isAnimateDiff ? "AnimateDiff · SD1.5 motion" : "LTX2 · native video";
          return {
            id: m.name,
            label: `${cleanModelName(m.name)} · Tier ${m.tier} · ${typeLabel}`,
          };
        });

        const faceSwapOptions = faceSwapModelsData.map((m) => ({
          id: m.name,
          label: `${cleanModelName(m.name)} · Tier ${m.tier} · ${String(m.pipeline || "").toUpperCase()}`,
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
      // Set default model to auto for image mode
      setSelectedModel("auto");
    } else if (mode === "video") {
      // Reset sampler (not used in video mode)
      setSampler("");
      // Reset face swap options
      setFaceSourceUrl("");
      setFaceSourceData(undefined);
      setFaceSourceName(undefined);
      setFaceswapGuidance("");
      // Select first available video model, otherwise clear selection.
      setSelectedModel(videoModels.length > 0 ? videoModels[0].id : "");
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
  }, [mode, videoModels, faceSwapModels]);

  useEffect(() => {
    if (mode !== "image" || !selectedImageModelMeta || selectedModel === "auto") {
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
            : err?.message || "Failed to load invite quota.";
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
    fetchCredits()
      .then((data) => {
        if (!cancelled) setCredits(data);
      })
      .catch(() => {
        // credits not enabled or endpoint unavailable — that's fine
        if (!cancelled) setCredits(null);
      });
    return () => { cancelled = true; };
  }, [loading]); // re-fetch when loading toggles (i.e. after a job finishes)

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
    // LoRA support disabled for MVP
    if (!ENABLE_LORA) return [];
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
    const stepsValue = parseOptionalInt(steps);
    const guidanceValue = parseOptionalFloat(guidance);
    const widthValue = parseOptionalInt(width);
    const heightValue = parseOptionalInt(height);
    const samplerValue = sampler.trim();
    const seedValue = parseOptionalInt(seed);

    if (stepsValue !== undefined) options.steps = stepsValue;
    if (guidanceValue !== undefined) options.guidance = guidanceValue;
    if (widthValue !== undefined) options.width = widthValue;
    if (heightValue !== undefined) options.height = heightValue;
    if (samplerValue) options.sampler = samplerValue;
    if (seedValue !== undefined) options.seed = seedValue;
    if (hardcoreMode) options.hardcoreMode = true;

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
    return request;
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
      setStatusMessage(`Waiting for GPU node… (${index + 1}/${total})`);
      const result = await pollJob(id, promptText, 2400);
      if (!result || !result.videoUrl) {
        setStatusMessage("Chain stopped (no video output).");
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
      setStatusMessage("Stitching clips…");
      try {
        const stitched = await stitchVideos(jobIds);
        setVideoUrl(stitched.video_url);
        setImageUrl(undefined);
        setStatusMessage("Stitched video ready.");
        setChainSummary({ clips: jobIds.length, stitched: true });
      } catch (err: any) {
        setStatusMessage(err?.message || "Auto-stitch failed.");
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
    if (mode !== "face_swap" && !trimmed) {
      setStatusMessage("Prompt is required.");
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
    setStatusMessage("Job submitted…");
    setImageUrl(undefined);
    setVideoUrl(undefined);
    setRuntimeSeconds(null);
    setModel(undefined);
    setJobId(undefined);
    setPollTimedOut(false);
    setLastUsedPrompt(trimmed || "Face swap");

    const extendValue = parseOptionalInt(extendChunks) ?? 0;

    try {
      if (mode === "image") {
        const options = buildOptions();
        const customNegative = useStandardNegative ? "" : negativePrompt.trim();
        const id = await submitAutoJob(
          trimmed,
          selectedModel === "auto" ? undefined : selectedModel,
          customNegative,
          options
        );
        setJobId(id);
        setStatusMessage("Waiting for GPU node…");
        await pollJob(id, trimmed, 1800);
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
        };
        if (strengthValue !== undefined) request.strength = strengthValue;
        if (stepsValue !== undefined) request.numSteps = stepsValue;
        if (guidanceValue !== undefined) request.guidance = guidanceValue;
        const id = await submitFaceSwapJob(request);
        setJobId(id);
        setStatusMessage("Waiting for GPU node…");
        await pollJob(id, trimmed || "Face swap", 1800);
      } else if (mode === "video") {
        if (extendValue > 0) {
          await runVideoChain(trimmed, extendValue);
        } else {
          const request = buildVideoRequest(trimmed);
          const id = await submitVideoJob(request);
          setJobId(id);
          setStatusMessage("Waiting for GPU node…");
          await pollJob(id, trimmed, 2400);
        }
      }
    } catch (err: any) {
      if (err instanceof HavnaiApiError || err?.code) {
        const code = err.code || err?.data?.error;
        if (code === "insufficient_credits") {
          const bal = err?.data?.balance ?? "?";
          const cost = err?.data?.cost ?? "?";
          setStatusMessage(`Not enough credits — need ${cost} but you have ${bal}.`);
        } else if (code === "invite_required") {
          setStatusMessage("Invite code required. Add your code to submit jobs.");
          setInviteOpen(true);
        } else if (code === "rate_limited") {
          const resetLabel = formatResetAt(err?.data?.reset_at);
          setStatusMessage(
            resetLabel
              ? `Invite quota exceeded. Resets at ${resetLabel}.`
              : "Invite quota exceeded. Please try again later."
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
    setStatusMessage("Done.");
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
        if (event.event !== "job_update") return;
        if (event.job_id !== id) return;
        const status = (event.status || "").toUpperCase();
        if (status === "QUEUED") {
          setStatusMessage("Job queued...");
        } else if (status === "RUNNING") {
          setStatusMessage("Rendering on HavnAI node...");
        } else if (status === "SUCCESS" || status === "COMPLETED") {
          setStatusMessage("Finalizing output...");
          sseResolved = true;
          clearTimeout(timeout);
          unsub();
          resolve("completed");
        } else if (status === "FAILED") {
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
            setStatusMessage("Job queued...");
          } else if (status === "RUNNING") {
            setStatusMessage("Rendering on HavnAI node...");
          } else if (status === "SUCCESS" || status === "COMPLETED") {
            setStatusMessage("Finalizing output...");
            return "completed";
          } else if (status === "FAILED") {
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
        setStatusMessage("Done.");
        setPollTimedOut(false);
        return { videoUrl: resolvedVideo, imageUrl: resolvedImage, job: job || undefined };
      }
    } catch {
      // Ignore
    }

    setPollTimedOut(true);
    setStatusMessage(
      `Still running after ${elapsed.toFixed(
        1
      )} seconds. Click "Check status" to keep waiting.`
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
    setStatusMessage("Showing from history. Generate again to refresh.");
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

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a href="#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Stage 6 → 7 Alpha</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button className="nav-toggle" id="navToggle" aria-label="Toggle navigation">
            <span />
            <span />
          </button>
          <nav className="nav-links" id="primaryNav">
            <a href="/">Home</a>
            <a href="/#how">How It Works</a>
            <a href="/#models">Models</a>
            <a href="/test" className="nav-active">Generator</a>
            <a href="/library">My Library</a>
            <a href={`${apiBase}/dashboard`} target="_blank" rel="noreferrer">
              Dashboard
            </a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="generator-hero" id="home">
          <div className="generator-hero-inner">
            <p className="hero-kicker">Creator Playground</p>
            <h1 className="generator-hero-title">Create Something Amazing.</h1>
            <p className="generator-hero-subtitle">
              Type a description, optionally pick a model, and let the HavnAI grid render it using the same weighted routing as the live network.
            </p>
          </div>
        </section>

        <section className="generator-section">
          <div className="generator-card">
            <div className="generator-grid">
              <div className="generator-left">
                <div className="invite-panel">
                  <div className={`invite-badge${inviteSaved ? " is-ok" : " is-missing"}`}>
                    {inviteSaved ? "Beta Access: OK" : "Invite required"}
                  </div>
                  {quota && (
                    <div className="quota-bars">
                      <div className="quota-bar-group">
                        <span className="quota-bar-label">Daily</span>
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
                        <span className="quota-bar-label">Active</span>
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
                  <button
                    type="button"
                    className="invite-toggle"
                    onClick={() => setInviteOpen((prev) => !prev)}
                  >
                    {inviteSaved ? "Manage invite" : "Add invite"}
                  </button>
                </div>
                {inviteOpen && (
                  <div className="invite-form">
                    <label className="generator-label" htmlFor="invite-code">
                      Invite code
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      className="generator-input"
                      placeholder="Enter your invite code"
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
                    <p className="generator-help">Stored locally in your browser only.</p>
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
                        Using recommended defaults for this model (source: {faceSwapDefaultsBadge}). Leave fields blank to apply them automatically.
                      </p>
                    )}
                    {/* LoRA Browser + Stack (Face Swap) – hidden when ENABLE_LORA is false */}
                    {ENABLE_LORA && (
                    <div className="lora-section">
                      <div className="lora-section-header">
                        <span className="generator-label" style={{ margin: 0 }}>
                          Optional LoRAs {loras.length > 0 && <span className="lora-count">{loras.length}</span>}
                        </span>
                        <button
                          type="button"
                          className={`lora-browse-toggle ${loraBrowserOpen ? "is-open" : ""}`}
                          onClick={() => setLoraBrowserOpen(!loraBrowserOpen)}
                          disabled={!availableLoras.length}
                        >
                          {loraBrowserOpen ? "Close browser" : `Browse ${availableLoras.length} LoRAs`}
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                <div className="generator-controls">
                  <HavnAIButton
                    label={
                      mode === "face_swap"
                        ? "Swap face"
                        : mode === "video"
                        ? "Generate video"
                        : "Generate"
                    }
                    loading={loading}
                    disabled={mode !== "face_swap" && !prompt.trim()}
                    onClick={handleSubmit}
                  />
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
                      <span className="adv-group-title">Model</span>
                      <select
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
                        Auto routes to the best model by weight and pipeline. Choosing a specific model overrides auto routing for this job.
                      </p>
                      {selectedModel !== "auto" && selectedImageModelMeta?.image_defaults && (
                        <p className="generator-help">
                          Using recommended defaults for this model (source: {imageDefaultsBadge}). Leave fields blank to apply them automatically.
                        </p>
                      )}
                    </div>
                    <div className="adv-group">
                      <span className="adv-group-title">Negative prompt</span>
                      <label className="generator-checkbox">
                        <input
                          type="checkbox"
                          checked={useStandardNegative}
                          onChange={(e) => setUseStandardNegative(e.target.checked)}
                        />
                        <span>Use standard negative prompt (recommended)</span>
                      </label>
                      <p className="generator-help">
                        When enabled, the coordinator appends the model negative + global negatives automatically.
                      </p>
                      <label className="generator-label" htmlFor="negative-prompt">
                        Extra negatives
                      </label>
                      <textarea
                        id="negative-prompt"
                        className={`generator-input${useStandardNegative ? " is-disabled" : ""}`}
                        placeholder={useStandardNegative ? "Disable standard negative to type here" : "Optional extra negatives to append"}
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        rows={2}
                        disabled={useStandardNegative}
                      />
                      {useStandardNegative && (
                        <p className="generator-help muted-hint">
                          Uncheck &ldquo;Use standard negative prompt&rdquo; above to enter custom negatives.
                        </p>
                      )}
                      <label className="generator-checkbox">
                        <input
                          type="checkbox"
                          checked={hardcoreMode}
                          onChange={(e) => setHardcoreMode(e.target.checked)}
                        />
                        <span>Hardcore mode (explicit)</span>
                      </label>
                      <p className="generator-help">
                        Enables hardcore prompt enhancement only when explicitly turned on. No keyword auto-trigger.
                      </p>
                    </div>
                    <div className="adv-group">
                      <span className="adv-group-title">Generation settings</span>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="steps">
                          Steps
                        </label>
                        <input
                          id="steps"
                          type="number"
                          min={25}
                          max={35}
                          step={5}
                          className="generator-input"
                          placeholder="30"
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
                          min={1}
                          max={15}
                          step={0.1}
                          className="generator-input"
                          placeholder="Auto (registry)"
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
                          max={1536}
                          step={64}
                          className="generator-input"
                          placeholder="Auto (registry)"
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
                          max={1536}
                          step={64}
                          className="generator-input"
                          placeholder="Auto (registry)"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="generator-row">
                      <div>
                        <label className="generator-label" htmlFor="sampler">
                          Sampler
                        </label>
                        <input
                          id="sampler"
                          type="text"
                          className="generator-input"
                          placeholder="Auto (registry)"
                          value={sampler}
                          onChange={(e) => setSampler(e.target.value)}
                        />
                      </div>
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
                    {/* LoRA Browser + Stack – hidden when ENABLE_LORA is false */}
                    {ENABLE_LORA && (
                    <div className="lora-section">
                      <div className="lora-section-header">
                        <span className="generator-label" style={{ margin: 0 }}>
                          LoRA stack {loras.length > 0 && <span className="lora-count">{loras.length}</span>}
                        </span>
                        <button
                          type="button"
                          className={`lora-browse-toggle ${loraBrowserOpen ? "is-open" : ""}`}
                          onClick={() => setLoraBrowserOpen(!loraBrowserOpen)}
                          disabled={!availableLoras.length}
                        >
                          {loraBrowserOpen
                            ? "Close browser"
                            : `Browse ${availableLoras.length} LoRA${availableLoras.length !== 1 ? "s" : ""}${currentPipeline ? ` (${currentPipeline.toUpperCase()})` : ""}`}
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {advancedOpen && mode === "video" && (
                  <div className="generator-advanced">
                    <span className="generator-label">Video settings</span>
                    <p className="generator-help">
                      LTX2 defaults to 16 frames at 8fps (~2s). AnimateDiff can go longer but is heavier.
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
                          max={50}
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
                          max={12}
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
                          max={768}
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
                          max={768}
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
                          max={64}
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
                          max={24}
                          step={1}
                          className="generator-input"
                          placeholder="Recommended"
                          value={fps}
                          onChange={(e) => setFps(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="generator-help">
                      AnimateDiff: 16 frames optimal, max 32 (4s @ 8fps). LTX2: max 16 frames (2s @ 8fps). Use <strong>auto-extend chunks</strong> below for longer videos.
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
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default TestPage;
