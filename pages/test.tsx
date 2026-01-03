import React, { useEffect, useState } from "react";
import { HavnAIPrompt } from "../components/HavnAIPrompt";
import { HavnAIButton } from "../components/HavnAIButton";
import { StatusBox } from "../components/StatusBox";
import { OutputCard } from "../components/OutputCard";
import { HistoryFeed, HistoryItem } from "../components/HistoryFeed";
import { submitAutoJob, fetchJob, fetchResult, SubmitJobOptions } from "../lib/havnai";

const HISTORY_KEY = "havnai_test_history_v1";

const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto (let grid choose best)" },
  { id: "juggernautXL_ragnarokBy", label: "juggernautXL_ragnarokBy · SDXL studio" },
  { id: "epicrealismXL_vxviiCrystalclear", label: "epicrealismXL_vxviiCrystalclear · SDXL daylight" },
  { id: "perfectdeliberate_v5SD15", label: "perfectdeliberate_v5SD15 · portraits" },
  { id: "uberRealisticPornMerge_v23Final", label: "uberRealisticPornMerge_v23Final · glossy studio" },
  { id: "triomerge_v10", label: "triomerge_v10 · fantasy stylized" },
  { id: "unstablePornhwa_beta", label: "unstablePornhwa_beta · manhwa" },
  { id: "disneyPixarCartoon_v10", label: "disneyPixarCartoon_v10 · cartoon" },
  { id: "kizukiAnimeHentai_animeHentaiV4", label: "kizukiAnimeHentai_animeHentaiV4 · anime" },
];

type LoraDraft = {
  name: string;
  weight: string;
};

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
  const [useStandardNegative, setUseStandardNegative] = useState(true);
  const [steps, setSteps] = useState("");
  const [guidance, setGuidance] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [sampler, setSampler] = useState("");
  const [seed, setSeed] = useState("");
  const [loras, setLoras] = useState<LoraDraft[]>([]);

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

    const loraPayload = loras
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

    if (loraPayload.length > 0) {
      options.loras = loraPayload;
    }

    return Object.keys(options).length > 0 ? options : undefined;
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setLoading(true);
    setStatusMessage("Job submitted…");
    setImageUrl(undefined);
    setRuntimeSeconds(null);
    setModel(undefined);
    setJobId(undefined);

    try {
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
