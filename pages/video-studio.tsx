import Head from "next/head";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import {
  cancelV1Job,
  createVideoJob,
  fetchV1Job,
  fetchVideoCapabilities,
  mediaUrl,
  uploadStudioAsset,
  V1Capabilities,
  V1Job,
  VideoAspect,
  VideoDuration,
  VideoPreset,
} from "../lib/videoStudioApi";


const finalStates = new Set(["succeeded", "failed", "cancelled", "expired"]);
const phases = ["queued", "loading", "encoding", "generation", "decoding", "finalizing", "uploading"];

function normalizeStage(value?: string): string {
  const stage = String(value || "queued").toLowerCase();
  if (stage.includes("upload")) return "uploading";
  if (stage.includes("final") || stage.includes("mux")) return "finalizing";
  if (stage.includes("decod")) return "decoding";
  if (stage.includes("infer") || stage.includes("generat") || stage.includes("render")) return "generation";
  if (stage.includes("encod") || stage.includes("prompt")) return "encoding";
  if (stage.includes("load") || stage === "leased" || stage === "running") return "loading";
  return stage;
}

export default function VideoStudioPage() {
  const [capabilities, setCapabilities] = useState<V1Capabilities | null>(null);
  const [source, setSource] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<VideoPreset>("fast_upscaled");
  const [aspect, setAspect] = useState<VideoAspect>("9:16");
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [seed, setSeed] = useState("");
  const [motion, setMotion] = useState(0.85);
  const [model, setModel] = useState("");
  const [job, setJob] = useState<V1Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [studioKey, setStudioKey] = useState("");
  const [studioUnlocked, setStudioUnlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourcePreview = useMemo(() => (source ? URL.createObjectURL(source) : ""), [source]);
  useEffect(() => () => sourcePreview && URL.revokeObjectURL(sourcePreview), [sourcePreview]);

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("havnai_studio_key");
    if (savedKey) {
      setStudioKey(savedKey);
      void connectStudio(savedKey);
    }
  }, []);

  useEffect(() => {
    if (!job || finalStates.has(job.status)) return;
    pollRef.current = setTimeout(() => {
      fetchV1Job(job.id, studioKey)
        .then(setJob)
        .catch((reason) => setError(reason.message));
    }, 1500);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [job]);

  const videoModels = capabilities?.models.filter((item) =>
    item.available && item.capabilities?.includes("image_to_video")
  ) || [];
  const output = mediaUrl(job?.artifacts.find((artifact) => artifact.kind === "video")?.url);
  const normalizedStage = normalizeStage(job?.stage);
  const stageIndex = Math.max(phases.indexOf(normalizedStage), 0);

  async function connectStudio(key: string) {
    const normalizedKey = key.trim();
    if (!normalizedKey) return;
    setCheckingAccess(true);
    setError("");
    try {
      const value = await fetchVideoCapabilities(normalizedKey);
      setCapabilities(value);
      const available = value.models.find((item) =>
        item.available && item.capabilities?.includes("image_to_video")
      );
      if (available) setModel(available.id);
      setStudioKey(normalizedKey);
      setStudioUnlocked(true);
      window.sessionStorage.setItem("havnai_studio_key", normalizedKey);
    } catch (reason) {
      window.sessionStorage.removeItem("havnai_studio_key");
      setStudioUnlocked(false);
      setError(reason instanceof Error ? reason.message : "Studio access failed");
    } finally {
      setCheckingAccess(false);
    }
  }

  function unlockStudio(event: React.FormEvent) {
    event.preventDefault();
    void connectStudio(studioKey);
  }

  function lockStudio() {
    window.sessionStorage.removeItem("havnai_studio_key");
    setStudioUnlocked(false);
    setStudioKey("");
    setCapabilities(null);
    setJob(null);
    setError("");
  }

  async function resolveSource(): Promise<File> {
    if (source) return source;
    if (!sourceUrl.trim()) throw new Error("Source image is required");
    const response = await fetch(sourceUrl.trim());
    if (!response.ok) throw new Error("Source result could not be loaded");
    const blob = await response.blob();
    return new File([blob], "havnai-source.png", { type: blob.type || "image/png" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const sourceAsset = await uploadStudioAsset(await resolveSource(), "image", studioKey);
      const audioAsset = audio ? await uploadStudioAsset(audio, "audio", studioKey) : undefined;
      const created = await createVideoJob({
        model,
        prompt: prompt.trim(),
        sourceAssetId: sourceAsset.id,
        audioAssetId: audioAsset?.id,
        preset,
        aspectRatio: aspect,
        durationSeconds: duration,
        seed: seed.trim() ? Number(seed) : undefined,
        motionStrength: motion,
      }, studioKey);
      setJob(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Job submission failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!job) return;
    setBusy(true);
    try {
      await cancelV1Job(job.id, studioKey);
      setJob(await fetchV1Job(job.id, studioKey));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cancellation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!studioUnlocked) {
    return (
      <>
        <Head><title>Video Studio | HavnAI</title></Head>
        <SiteHeader />
        <main className="video-studio">
          <form className="video-studio-lock" onSubmit={unlockStudio}>
            <h1>Video Studio</h1>
            <p>Enter the access key for this studio deployment.</p>
            <label>
              Studio access key
              <input
                type="password"
                autoComplete="current-password"
                value={studioKey}
                onChange={(event) => setStudioKey(event.target.value)}
                autoFocus
              />
            </label>
            {error && <p className="video-error" role="alert">{error}</p>}
            <button type="submit" disabled={checkingAccess || !studioKey.trim()}>
              {checkingAccess ? "Checking..." : "Open studio"}
            </button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <Head><title>Video Studio | HavnAI</title></Head>
      <SiteHeader />
      <main className="video-studio">
        <header className="video-studio-heading">
          <div>
            <p className="video-studio-kicker">Owner Studio</p>
            <h1>Video Studio</h1>
          </div>
          <div className="video-studio-status">
            <span className={`video-runtime ${capabilities?.video_v2_available ? "is-online" : ""}`}>
              {capabilities === null
                ? "Checking runtime"
                : capabilities.video_v2_available
                  ? "Video v2 online"
                  : capabilities.video_v2_enabled
                    ? "No video node available"
                    : "Video v2 offline"}
            </span>
            <button className="video-studio-lock-button" type="button" onClick={lockStudio}>
              Lock studio
            </button>
          </div>
        </header>

        <div className="video-studio-layout">
          <form className="video-controls" onSubmit={submit}>
            <section className="video-control-section">
              <h2>Source</h2>
              <div className="source-row">
                <label className="source-drop">
                  {sourcePreview ? <img src={sourcePreview} alt="Selected source" /> : <span>Choose image</span>}
                  <input type="file" accept="image/*" onChange={(event) => setSource(event.target.files?.[0] || null)} />
                </label>
                <div className="source-fields">
                  <label>HavnAI result URL<input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="/api/static/outputs/..." /></label>
                  <label>Optional audio<input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] || null)} /></label>
                </div>
              </div>
            </section>

            <section className="video-control-section">
              <label>Motion prompt<textarea required value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
              <label>Model<select required value={model} onChange={(event) => setModel(event.target.value)}>{videoModels.map((item) => <option key={item.id} value={item.id}>{item.id} {item.model_version || item.version ? `(${item.model_version || item.version})` : ""}</option>)}</select></label>
            </section>

            <section className="video-control-section video-option-grid">
              <fieldset><legend>Preset</legend><div className="video-segments"><button type="button" className={preset === "fast_upscaled" ? "active" : ""} onClick={() => setPreset("fast_upscaled")}>Fast Upscaled</button><button type="button" className={preset === "native_quality" ? "active" : ""} onClick={() => setPreset("native_quality")}>Native Quality</button></div></fieldset>
              <fieldset><legend>Aspect</legend><div className="video-segments"><button type="button" className={aspect === "9:16" ? "active" : ""} onClick={() => setAspect("9:16")}>9:16</button><button type="button" className={aspect === "16:9" ? "active" : ""} onClick={() => setAspect("16:9")}>16:9</button></div></fieldset>
              <label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value) as VideoDuration)}><option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={8}>8 seconds</option></select></label>
              <label>Seed<input type="number" min={0} value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Random" /></label>
              <label className="motion-control">Source preservation <output>{motion.toFixed(2)}</output><input type="range" min={0.1} max={1} step={0.05} value={motion} onChange={(event) => setMotion(Number(event.target.value))} /></label>
            </section>

            {error && <p className="video-error" role="alert">{error}</p>}
            <div className="video-actions">
              <button className="video-submit" type="submit" disabled={busy || !model || !capabilities?.video_v2_available}>{busy ? "Submitting..." : "Generate clip"}</button>
              {job && !finalStates.has(job.status) && <button className="video-cancel" type="button" onClick={cancel} disabled={busy} aria-label="Cancel active job">Cancel</button>}
            </div>
          </form>

          <section className="video-output" aria-live="polite">
            <div className={`video-frame aspect-${aspect.replace(":", "-")}`}>
              {output ? <video src={output} controls playsInline /> : sourcePreview ? <img src={sourcePreview} alt="Video source" /> : <div className="video-empty">No active render</div>}
            </div>
            <div className="video-progress-header"><strong>{job ? normalizedStage : "Ready"}</strong><span>{Math.round(job?.progress || 0)}%</span></div>
            <div className="video-progress"><span style={{ width: `${job?.progress || 0}%` }} /></div>
            <ol className="video-phases">{phases.map((phase, index) => <li key={phase} className={index <= stageIndex && job ? "active" : ""}>{phase}</li>)}</ol>
            {job && <details className="video-spec"><summary>Resolved settings</summary><pre>{JSON.stringify(job.resolved_spec, null, 2)}</pre></details>}
          </section>
        </div>
      </main>
    </>
  );
}
