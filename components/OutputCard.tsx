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
    </div>
  );
};
