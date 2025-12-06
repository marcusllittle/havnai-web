import React from "react";

interface OutputCardProps {
  imageUrl?: string;
  model?: string;
  runtimeSeconds?: number | null;
  jobId?: string;
}

export const OutputCard: React.FC<OutputCardProps> = ({
  imageUrl,
  model,
  runtimeSeconds,
  jobId,
}) => {
  if (!imageUrl) return null;
  const runtimeDisplay =
    typeof runtimeSeconds === "number"
      ? runtimeSeconds.toFixed(1)
      : undefined;

  return (
    <div className="generator-output-card">
      <img src={imageUrl} alt={jobId || "Generated image"} />

      <div className="generator-output-meta">
        <span>
          Generated using{" "}
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
