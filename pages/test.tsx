import React, { useEffect, useState } from "react";
import { HavnAIPrompt } from "../components/HavnAIPrompt";
import { HavnAIButton } from "../components/HavnAIButton";
import { StatusBox } from "../components/StatusBox";
import { OutputCard } from "../components/OutputCard";
import { HistoryFeed, HistoryItem } from "../components/HistoryFeed";
import { JobDetailsDrawer, JobSummary } from "../components/JobDetailsDrawer";
import {
  submitAutoJob,
  submitFaceSwapJob,
  fetchJob,
  fetchResult,
  fetchJobWithResult,
  fetchQuota,
  HavnaiApiError,
  JobDetailResponse,
  ResultResponse,
  SubmitJobOptions,
  QuotaStatus,
} from "../lib/havnai";
import { addToLibrary, LibraryItemType } from "../lib/libraryStore";
import { clearInviteCode, getInviteCode, setInviteCode } from "../lib/invite";

const HISTORY_KEY = "havnai_test_history_v1";

const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (let grid choose best)" },
  { id: "juggernautXL_ragnarokBy", label: "juggernautXL_ragnarokBy · SDXL studio" },
  { id: "epicrealismXL_vxviiCrystalclear", label: "epicrealismXL_vxviiCrystalclear · SDXL daylight" },
  { id: "epicrealismXL_purefix", label: "epicrealismXL_purefix · SDXL realism" },
  { id: "perfectdeliberate_v60", label: "perfectdeliberate_v60 · SDXL realism" },
  { id: "zavychromaxl_v100", label: "zavychromaxl_v100 · SDXL realism" },
  { id: "babesByStableYogiPony_xlV4", label: "babesByStableYogiPony_xlV4 · SDXL stylized" },
  { id: "perfectdeliberate_v5SD15", label: "perfectdeliberate_v5SD15 · portraits" },
  { id: "divineelegancemix_V10", label: "divineelegancemix_V10 · SD1.5 realism" },
  { id: "uberRealisticPornMerge_v23Final", label: "uberRealisticPornMerge_v23Final · glossy studio" },
  { id: "triomerge_v10", label: "triomerge_v10 · fantasy stylized" },
  { id: "unstablePornhwa_beta", label: "unstablePornhwa_beta · manhwa" },
  { id: "disneyPixarCartoon_v10", label: "disneyPixarCartoon_v10 · cartoon" },
  { id: "kizukiAnimeHentai_animeHentaiV4", label: "kizukiAnimeHentai_animeHentaiV4 · anime" },
];

const FACE_SWAP_MODELS: { id: string; label: string }[] = [
  { id: "epicrealismXL_vxviiCrystalclear", label: "epicrealismXL_vxviiCrystalclear · SDXL daylight" },
  { id: "juggernautXL_ragnarokBy", label: "juggernautXL_ragnarokBy · SDXL studio" },
];

type LoraDraft = {
  name: string;
  weight: string;
};

type GeneratorMode = "image" | "face_swap";

const TestPage: React.FC = () => {
  const [mode, setMode] = useState<GeneratorMode>("image");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [runtimeSeconds, setRuntimeSeconds] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [useStandardNegative, setUseStandardNegative] = useState(true);
  const [steps, setSteps] = useState("");
  const [guidance, setGuidance] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [sampler, setSampler] = useState("");
  const [seed, setSeed] = useState("");
  const [loras, setLoras] = useState<LoraDraft[]>([]);
  const [faceswapModel, setFaceswapModel] = useState(FACE_SWAP_MODELS[0].id);
  const [baseImageUrl, setBaseImageUrl] = useState("");
  const [baseImageData, setBaseImageData] = useState<string | undefined>();
  const [baseImageName, setBaseImageName] = useState<string | undefined>();
  const [faceSourceUrl, setFaceSourceUrl] = useState("");
  const [faceSourceData, setFaceSourceData] = useState<string | undefined>();
  const [faceSourceName, setFaceSourceName] = useState<string | undefined>();
  const [faceswapStrength, setFaceswapStrength] = useState("0.8");
  const [faceswapSteps, setFaceswapSteps] = useState("20");
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
  const inviteSaved = Boolean(savedInviteCode);

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

  const removeLora = (index: number) => {
    setLoras((prev) => prev.filter((_, idx) => idx !== index));
  };

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

  const buildLoraPayload = (): { name: string; weight?: number }[] => {
    return loras
      .map((entry) => {
        const name = entry.name.trim();
        if (!name) return null;
        const weightValue = parseOptionalFloat(entry.weight);
        const payload: { name: string; weight?: number } = { name };
        if (weightValue !== undefined) {
          payload.weight = weightValue;
        }
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

    const loraPayload = buildLoraPayload();
    if (loraPayload.length > 0) {
      options.loras = loraPayload;
    }

    return Object.keys(options).length > 0 ? options : undefined;
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

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (mode !== "face_swap" && !trimmed) {
      setStatusMessage("Prompt is required.");
      return;
    }
    setLoading(true);
    setStatusMessage("Job submitted…");
    setImageUrl(undefined);
    setVideoUrl(undefined);
    setRuntimeSeconds(null);
    setModel(undefined);
    setJobId(undefined);

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
        await pollJob(id, trimmed, 360);
      } else if (mode === "face_swap") {
        const baseUrl = baseImageData || baseImageUrl.trim();
        const faceUrl = faceSourceData || faceSourceUrl.trim();
        if (!baseUrl || !faceUrl) {
          setStatusMessage("Base image and face source are required.");
          return;
        }
        const loraPayload = buildLoraPayload();
        const seedValue = parseOptionalInt(seed);
        const strengthValue = parseOptionalFloat(faceswapStrength) ?? 0.8;
        const stepsValue = parseOptionalInt(faceswapSteps) ?? 20;
        const id = await submitFaceSwapJob({
          prompt: trimmed,
          model: faceswapModel,
          baseImageUrl: baseUrl,
          faceSourceUrl: faceUrl,
          strength: strengthValue,
          numSteps: stepsValue,
          loras: loraPayload.length > 0 ? loraPayload : undefined,
          seed: seedValue,
        });
        setJobId(id);
        setStatusMessage("Waiting for GPU node…");
        await pollJob(id, trimmed || "Face swap", 900);
      }
    } catch (err: any) {
      if (err instanceof HavnaiApiError || err?.code) {
        const code = err.code || err?.data?.error;
        if (code === "invite_required") {
          setStatusMessage("Invite code required. Add your code to submit jobs.");
          setInviteOpen(true);
        } else if (code === "rate_limited") {
          const resetLabel = formatResetAt(err?.data?.reset_at);
          setStatusMessage(
            resetLabel
              ? `Invite quota exceeded. Resets at ${resetLabel}.`
              : "Invite quota exceeded. Please try again later."
          );
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

  const pollJob = async (id: string, usedPrompt: string, maxWaitSeconds = 600) => {
    const start = Date.now();

    while ((Date.now() - start) / 1000 < maxWaitSeconds) {
      try {
        const job = await fetchJob(id);
        const status = (job.status || "").toUpperCase();

        if (status === "QUEUED") {
          setStatusMessage("Job queued…");
        } else if (status === "RUNNING") {
          setStatusMessage("Rendering on HavnAI node…");
        } else if (status === "SUCCESS" || status === "COMPLETED") {
          setStatusMessage("Finalizing output…");

          // Compute runtime from timestamps if available
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
            return;
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
          } else if (resolvedImage) {
            setImageUrl(resolvedImage);
          }
          setRuntimeSeconds(runtime);
          setModel(job.model);
          setStatusMessage("Done.");

          if (resolvedImage) {
            const item: HistoryItem = {
              jobId: id,
              prompt: usedPrompt,
              imageUrl: resolvedImage,
              model: job.model,
              timestamp: Date.now(),
            };
            const next = [item, ...history].slice(0, 5);
            saveHistory(next);
          }
          return;
        } else if (status === "FAILED") {
          setStatusMessage("Job failed on the grid.");
          return;
        } else {
          setStatusMessage(`Status: ${status || "Unknown"}`);
        }
      } catch (err: any) {
        setStatusMessage(err?.message || "Error while polling job.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const elapsed = (Date.now() - start) / 1000;
    setStatusMessage(`Gave up after ${elapsed.toFixed(1)} seconds without completion.`);
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setImageUrl(item.imageUrl);
    setVideoUrl(undefined);
    setModel(item.model);
    setRuntimeSeconds(null);
    setJobId(item.jobId);
    setStatusMessage("Showing from history. Generate again to refresh.");
    const summary: JobSummary = {
      job_id: item.jobId,
      model: item.model,
      image_url: item.imageUrl,
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
            <a href="https://joinhavn.io#how">How It Works</a>
            <a href="https://joinhavn.io#smart-routing">Smart Routing</a>
            <a href="https://joinhavn.io#rewards">Rewards</a>
            <a href="https://joinhavn.io#models">Models</a>
            <a href="/library">My Library</a>
            <a href="http://api.joinhavn.io:5001/dashboard" target="_blank" rel="noreferrer">
              Dashboard
            </a>
            <a href="https://joinhavn.io#join">Join Alpha</a>
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
                    <div className="invite-quota">
                      Today:{" "}
                      {quota.max_daily > 0
                        ? `${quota.used_today}/${quota.max_daily}`
                        : `${quota.used_today}/unlimited`}
                      {" • "}
                      Concurrent:{" "}
                      {quota.max_concurrent > 0
                        ? `${quota.used_concurrent}/${quota.max_concurrent}`
                        : `${quota.used_concurrent}/unlimited`}
                    </div>
                  )}
                  {!quota && quotaError && (
                    <div className="invite-quota invite-error">{quotaError}</div>
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
                      placeholder="alpha-abc123"
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
                      placeholder="http://server/static/outputs/<job_id>.png"
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
                      placeholder="http://server/static/outputs/<job_id>.png"
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
                          value={faceswapSteps}
                          onChange={(e) => setFaceswapSteps(e.target.value)}
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
                      {FACE_SWAP_MODELS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="generator-label">Optional LoRAs</span>
                    {loras.map((entry, index) => (
                      <div className="generator-lora-row" key={`faceswap-lora-${index}`}>
                        <input
                          type="text"
                          className="generator-input"
                          placeholder="LoRA name"
                          value={entry.name}
                          onChange={(e) => updateLora(index, "name", e.target.value)}
                        />
                        <input
                          type="number"
                          min={0}
                          max={2}
                          step={0.05}
                          className="generator-input"
                          placeholder="Weight"
                          value={entry.weight}
                          onChange={(e) => updateLora(index, "weight", e.target.value)}
                        />
                        <button
                          type="button"
                          className="generator-mini-button"
                          onClick={() => removeLora(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="generator-mini-button" onClick={addLora}>
                      Add LoRA
                    </button>
                  </div>
                )}

                <div className="generator-controls">
                  <HavnAIButton
                    label={mode === "face_swap" ? "Swap face" : "Generate"}
                    loading={loading}
                    disabled={mode !== "face_swap" && !prompt.trim()}
                    onClick={handleSubmit}
                  />
                  {mode === "image" && (
                    <button
                      type="button"
                      className="generator-advanced-toggle"
                      onClick={() => setAdvancedOpen((v) => !v)}
                    >
                      {advancedOpen ? "Hide advanced options" : "Show advanced options"}
                    </button>
                  )}
                </div>

                {advancedOpen && mode === "image" && (
                  <div className="generator-advanced">
                    <span className="generator-label">Model</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="generator-select"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="generator-help">
                      Auto routes to the highest-performing model based on weight and pipeline. Choosing a specific model overrides auto routing for this job only.
                    </p>
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
                      Negative prompt (extra)
                    </label>
                    <textarea
                      id="negative-prompt"
                      className="generator-input"
                      placeholder="Optional extra negatives to append"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      rows={2}
                      disabled={useStandardNegative}
                    />
                    <p className="generator-help">
                      Only used when the standard negative prompt is disabled.
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
                          min={5}
                          max={50}
                          step={1}
                          className="generator-input"
                          placeholder="Auto (registry)"
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
                    <span className="generator-label">LoRA stack (order matters)</span>
                    <p className="generator-help">
                      Leave blank to use server defaults. Weights are optional.
                    </p>
                    {loras.map((entry, index) => (
                      <div className="generator-lora-row" key={`lora-${index}`}>
                        <input
                          type="text"
                          className="generator-input"
                          placeholder="LoRA name (e.g. Handv2)"
                          value={entry.name}
                          onChange={(e) => updateLora(index, "name", e.target.value)}
                        />
                        <input
                          type="number"
                          min={0}
                          max={2}
                          step={0.05}
                          className="generator-input"
                          placeholder="Weight"
                          value={entry.weight}
                          onChange={(e) => updateLora(index, "weight", e.target.value)}
                        />
                        <button
                          type="button"
                          className="generator-mini-button"
                          onClick={() => removeLora(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="generator-mini-button" onClick={addLora}>
                      Add LoRA
                    </button>
                  </div>
                )}

                <StatusBox message={statusMessage} />
              </div>

              <div className="generator-right">
                <label className="generator-label">Output</label>
                <OutputCard
                  imageUrl={imageUrl}
                  videoUrl={videoUrl}
                  model={model}
                  runtimeSeconds={runtimeSeconds || null}
                  jobId={jobId}
                />
              </div>
            </div>

            <HistoryFeed
              items={history}
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
