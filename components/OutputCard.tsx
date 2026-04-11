import React, { useState } from "react";

interface OutputCardProps {
  imageUrl?: string;
  videoUrl?: string;
  model?: string;
  runtimeSeconds?: number | null;
  jobId?: string;
  onUseLastFrame?: (dataUrl: string) => void;
}

/** Clean up model name for display */
function friendlyModel(name?: string): string {
  if (!name) return "Auto";
  return name
    .replace(/_v\d+SD15/i, "")
    .replace(/_v[xvi]+[a-z]*/i, "")
    .replace(/_v\d+/i, "")
    .replace(/By$/i, "")
    .replace(/_beta$/i, "")
    .replace(/_final$/i, "")
    .replace(/Merge$/i, "")
    .replace(/_/g, " ")
    .trim() || name;
}

export const OutputCard: React.FC<OutputCardProps> = ({
  imageUrl,
  videoUrl,
  model,
  runtimeSeconds,
  jobId,
  onUseLastFrame,
}) => {
  const [frameBusy, setFrameBusy] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  if (!imageUrl && !videoUrl) return null;
  const runtimeDisplay =
    typeof runtimeSeconds === "number"
      ? runtimeSeconds.toFixed(1)
      : undefined;
  const label = videoUrl ? "Video" : "Image";
  const downloadName = `havnai-${(jobId || "output").slice(0, 8)}.${videoUrl ? "mp4" : "png"}`;

  const handleDownload = async () => {
    if (!videoUrl && !imageUrl) return;
    const url = videoUrl || imageUrl!;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  const handleCopyId = async () => {
    if (!jobId) return;
    try {
      await navigator.clipboard.writeText(jobId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  const handleUseLastFrame = async () => {
    if (!videoUrl || !onUseLastFrame || frameBusy) return;
    setFrameBusy(true);
    let objectUrl: string | null = null;
    try {
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`download failed: ${res.status}`);
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
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
        const onSeeked = () => {
          video.onseeked = null;
          resolve();
        };
        video.onseeked = onSeeked;
        video.onerror = () => reject(new Error("Failed to seek video"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1;
      canvas.height = video.videoHeight || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      onUseLastFrame(dataUrl);
    } catch (err) {
      console.error("Failed to capture last frame", err);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFrameBusy(false);
    }
  };

  return (
    <div className="generator-output-card">
      {videoUrl ? (
        <video
          className="generator-output-media"
          src={videoUrl}
          controls
          playsInline
        />
      ) : (
        <img src={imageUrl} alt={jobId || "Generated image"} />
      )}

      <div className="generator-output-meta">
        <span className="output-meta-badge">{label}</span>
        <span className="output-meta-model">{friendlyModel(model)}</span>
        {runtimeDisplay && <span className="output-meta-time">{runtimeDisplay}s</span>}
        {jobId && (
          <button
            type="button"
            className="output-meta-id"
            onClick={handleCopyId}
            title="Copy job ID"
          >
            {idCopied ? "Copied!" : `#${jobId.slice(0, 8)}`}
          </button>
        )}
      </div>
      {(videoUrl || imageUrl) && (
        <div className="generator-output-actions">
          <button
            type="button"
            onClick={handleDownload}
            className="generator-download"
          >
            {videoUrl ? "\u2913 Download" : "\u2913 Download"}
          </button>
          {videoUrl && onUseLastFrame ? (
            <button
              type="button"
              onClick={handleUseLastFrame}
              className="generator-download"
              disabled={frameBusy}
            >
              {frameBusy ? "Capturing\u2026" : "\u21BB Use last frame"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
