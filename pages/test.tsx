import React, { useEffect, useState } from "react";
import { HavnAIPrompt } from "../components/HavnAIPrompt";
import { HavnAIButton } from "../components/HavnAIButton";
import { StatusBox } from "../components/StatusBox";
import { OutputCard } from "../components/OutputCard";
import { HistoryFeed, HistoryItem } from "../components/HistoryFeed";
import { submitAutoJob, submitFaceSwapJob, fetchJob, fetchResult } from "../lib/havnai";

const HISTORY_KEY = "havnai_test_history_v1";

const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (let grid choose best)" },
  { id: "majicmixRealistic_v7", label: "majicmixRealistic_v7 · all‑round realism" },
  { id: "lazymixRealAmateur_v40", label: "lazymixRealAmateur_v40 · phone-photo realism" },
  { id: "juggernautXL_ragnarokBy", label: "juggernautXL_ragnarokBy · SDXL studio" },
  { id: "epicrealismXL_vxviiCrystalclear", label: "epicrealismXL_vxviiCrystalclear · SDXL daylight" },
  { id: "perfectdeliberate_v5SD15", label: "perfectdeliberate_v5SD15 · portraits" },
  { id: "uberRealisticPornMerge_v23Final", label: "uberRealisticPornMerge_v23Final · glossy studio" },
  { id: "triomerge_v10", label: "triomerge_v10 · fantasy stylized" },
  { id: "unstablePornhwa_beta", label: "unstablePornhwa_beta · manhwa" },
  { id: "disneyPixarCartoon_v10", label: "disneyPixarCartoon_v10 · cartoon" },
  { id: "kizukiAnimeHentai_animeHentaiV4", label: "kizukiAnimeHentai_animeHentaiV4 · anime" },
];

const TestPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [runtimeSeconds, setRuntimeSeconds] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [faceSwap, setFaceSwap] = useState(false);
  const [sourceFaceB64, setSourceFaceB64] = useState<string>("");
  const [ipadapterScale, setIpadapterScale] = useState<number>(0.85);
  const [sourcePreview, setSourcePreview] = useState<string | undefined>();

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

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    }
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (faceSwap && !sourceFaceB64) {
      setStatusMessage("Please upload a source face image for face swap.");
      return;
    }
    setLoading(true);
    setStatusMessage("Job submitted…");
    setImageUrl(undefined);
    setRuntimeSeconds(null);
    setModel(undefined);
    setJobId(undefined);

    try {
      const id = faceSwap
        ? await submitFaceSwapJob(
            trimmed,
            sourceFaceB64,
            selectedModel === "auto" ? undefined : selectedModel,
            negativePrompt.trim(),
            ipadapterScale
          )
        : await submitAutoJob(
            trimmed,
            selectedModel === "auto" ? undefined : selectedModel,
            negativePrompt.trim()
          );
      setJobId(id);
      setStatusMessage("Waiting for GPU node…");
      await pollJob(id, trimmed);
    } catch (err: any) {
      setStatusMessage(err?.message || "Failed to submit job.");
    } finally {
      setLoading(false);
    }
  };

  const pollJob = async (id: string, usedPrompt: string) => {
    const start = Date.now();
    let attempts = 0;

    while (attempts < 120) {
      attempts += 1;
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
          if (!result.image_url) {
            setStatusMessage("Job finished, but no image was found.");
            return;
          }

          const resolvedUrl = result.image_url;
          setImageUrl(resolvedUrl);
          setRuntimeSeconds(runtime);
          setModel(job.model);
          setStatusMessage("Done.");

          const item: HistoryItem = {
            jobId: id,
            prompt: usedPrompt,
            imageUrl: resolvedUrl,
            model: job.model,
            timestamp: Date.now(),
          };
          const next = [item, ...history].slice(0, 5);
          saveHistory(next);
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
    setModel(item.model);
    setRuntimeSeconds(null);
    setJobId(item.jobId);
    setStatusMessage("Showing from history. Generate again to refresh.");
  };

  const handleHistoryClear = () => {
    saveHistory([]);
    setImageUrl(undefined);
    setModel(undefined);
    setRuntimeSeconds(null);
    setJobId(undefined);
    setStatusMessage(undefined);
  };

  const handleFaceFile = (file: File | null) => {
    if (!file) {
      setSourceFaceB64("");
      setSourcePreview(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSourceFaceB64(result);
      setSourcePreview(result);
    };
    reader.readAsDataURL(file);
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
                <label className="generator-label" htmlFor="prompt">
                  Prompt
                </label>
                <HavnAIPrompt
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={handleSubmit}
                  disabled={loading}
                />

                <div className="generator-controls">
                  <HavnAIButton
                    label="Generate"
                    loading={loading}
                    disabled={!prompt.trim()}
                    onClick={handleSubmit}
                  />
                  <button
                    type="button"
                    className="generator-advanced-toggle"
                    onClick={() => setAdvancedOpen((v) => !v)}
                  >
                    {advancedOpen ? "Hide advanced options" : "Show advanced options"}
                  </button>
                </div>

                {advancedOpen && (
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
                    <label className="generator-label" htmlFor="negative-prompt">
                      Negative prompt
                    </label>
                    <textarea
                      id="negative-prompt"
                      className="prompt-input"
                      placeholder="e.g. extra limbs, bad anatomy, blurry, artifacts"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      rows={2}
                    />
                    <p className="generator-help">Sent directly to the coordinator; helps reduce artifacts.</p>
                    <div className="generator-face-swap">
                      <label className="generator-checkbox">
                        <input
                          type="checkbox"
                          checked={faceSwap}
                          onChange={(e) => setFaceSwap(e.target.checked)}
                        />
                        <span>Enable face swap (IP-Adapter FaceID PlusV2)</span>
                      </label>
                      {faceSwap && (
                        <>
                          <label className="generator-label" htmlFor="source-face">
                            Source face image
                          </label>
                          <input
                            id="source-face"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFaceFile(e.target.files?.[0] || null)}
                          />
                          {sourcePreview && (
                            <div className="generator-face-preview">
                              <span className="generator-help">Source preview</span>
                              <img src={sourcePreview} alt="Source face preview" />
                            </div>
                          )}
                          <label className="generator-label" htmlFor="ipadapter-scale">
                            Face strength (0.5–1.0)
                          </label>
                          <input
                            id="ipadapter-scale"
                            type="range"
                            min={0.5}
                            max={1.0}
                            step={0.01}
                            value={ipadapterScale}
                            onChange={(e) => setIpadapterScale(parseFloat(e.target.value))}
                          />
                          <p className="generator-help">Lower keeps more of the base model; higher enforces the source face harder.</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <StatusBox message={statusMessage} />
              </div>

              <div className="generator-right">
                <label className="generator-label">Output</label>
                <OutputCard
                  imageUrl={imageUrl}
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
    </>
  );
};

export default TestPage;
