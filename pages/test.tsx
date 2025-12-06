import React, { useEffect, useState } from "react";
import { HavnAIPrompt } from "../components/HavnAIPrompt";
import { HavnAIButton } from "../components/HavnAIButton";
import { StatusBox } from "../components/StatusBox";
import { OutputCard } from "../components/OutputCard";
import { HistoryFeed, HistoryItem } from "../components/HistoryFeed";
import { submitAutoJob, fetchJob, fetchResult } from "../lib/havnai";

const HISTORY_KEY = "havnai_test_history_v1";

const TestPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [runtimeSeconds, setRuntimeSeconds] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

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
    setLoading(true);
    setStatusMessage("Job submitted…");
    setImageUrl(undefined);
    setRuntimeSeconds(null);
    setModel(undefined);
    setJobId(undefined);

    try {
      const id = await submitAutoJob(trimmed);
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
    setPrompt(item.prompt);
    setStatusMessage("Showing from history. Generate again to refresh.");
  };

  // Simple particle field like the homepage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = document.querySelector(".particle-field") as HTMLElement | null;
    if (!container) return;
    if (container.childElementCount > 0) return;
    for (let i = 0; i < 60; i += 1) {
      const dot = document.createElement("span");
      dot.style.position = "absolute";
      dot.style.width = "3px";
      dot.style.height = "3px";
      dot.style.borderRadius = "999px";
      dot.style.background = "rgba(0,208,255,0.8)";
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.bottom = `${Math.random() * 100}%`;
      dot.style.opacity = String(Math.random());
      dot.style.animation = `float ${10 + Math.random() * 12}s linear infinite`;
      dot.style.animationDelay = `${Math.random() * 10}s`;
      container.appendChild(dot);
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#091823] via-[#030a0f] to-[#01060a] text-slate-100">
      <style jsx global>{`
        @keyframes float {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          25% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-260px);
            opacity: 0;
          }
        }
      `}</style>
      <div className="particle-field absolute inset-0 pointer-events-none" />

      <div className="relative z-10 px-6 pt-20 pb-10 max-w-md mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white tracking-wide">
            Create Something Amazing.
          </h1>
          <p className="text-center text-slate-300 text-sm mt-2">
            Type a description and let the HavnAI grid bring it to life.
          </p>
        </div>

        {/* Prompt + Button */}
        <HavnAIPrompt
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          disabled={loading}
        />

        <HavnAIButton
          label="Generate"
          loading={loading}
          disabled={!prompt.trim()}
          onClick={handleSubmit}
        />

        {/* Status */}
        <StatusBox message={statusMessage} />

        {/* Output */}
        <OutputCard
          imageUrl={imageUrl}
          model={model}
          runtimeSeconds={runtimeSeconds || null}
          jobId={jobId}
        />

        {/* History */}
        <HistoryFeed items={history} onSelect={handleHistorySelect} />
      </div>
    </div>
  );
};

export default TestPage;

