import React, { useState } from "react";

interface OutputCardProps {
  imageUrl?: string;
  videoUrl?: string;
  model?: string;
  runtimeSeconds?: number | null;
  jobId?: string;
  onUseLastFrame?: (dataUrl: string) => void;
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
  if (!imageUrl && !videoUrl) return null;
  const runtimeDisplay =
    typeof runtimeSeconds === "number"
      ? runtimeSeconds.toFixed(1)
      : undefined;
  const label = videoUrl ? "Generated video" : "Generated image";
  const downloadName = `${jobId || "havnai-output"}.${videoUrl ? "mp4" : "png"}`;

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
      // Fallback: open in a new tab if direct download is blocked by CORS.
      window.open(url, "_blank", "noopener");
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
      // Best-effort only; keep the UI usable even if capture fails.
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
        <span>{label}</span>
        <span>
          {` · `}
          <strong>{model || "auto-selected model"}</strong>
        </span>
        {runtimeDisplay && <span>{` · ${runtimeDisplay}s`}</span>}
        {jobId && (
          <span>{` · Job ID: `}
            <code>{jobId}</code>
          </span>
        )}
      </div>
      {(videoUrl || imageUrl) && (
        <div className="generator-output-actions">
          <button
            type="button"
            onClick={handleDownload}
            className="generator-download"
          >
            {videoUrl ? "Download video" : "Download image"}
          </button>
          {videoUrl && onUseLastFrame ? (
            <button
              type="button"
              onClick={handleUseLastFrame}
              className="generator-download"
              disabled={frameBusy}
            >
              {frameBusy ? "Capturing frame…" : "Use last frame"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
