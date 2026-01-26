import React from "react";

interface OutputCardProps {
  imageUrl?: string;
  videoUrl?: string;
  model?: string;
  runtimeSeconds?: number | null;
  jobId?: string;
}

export const OutputCard: React.FC<OutputCardProps> = ({
  imageUrl,
  videoUrl,
  model,
  runtimeSeconds,
  jobId,
}) => {
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
        </div>
      )}
    </div>
  );
};
