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
    <div
      className="
        mt-8 p-4 rounded-2xl
        bg-[rgba(255,255,255,0.08)]
        border border-[rgba(255,255,255,0.15)]
        shadow-xl backdrop-blur-lg
      "
    >
      <img
        className="rounded-xl w-full"
        src={imageUrl}
        alt={jobId || "Generated image"}
      />

      <p className="text-slate-300 text-xs mt-3">
        Generated using{" "}
        <span className="font-semibold text-white">
          {model || "auto-selected model"}
        </span>{" "}
        {runtimeDisplay && <>in {runtimeDisplay} seconds.</>}
      </p>

      {jobId && (
        <p className="text-slate-400 text-[11px] mt-1">
          Job ID: <span className="font-mono text-slate-300">{jobId}</span>
        </p>
      )}
    </div>
  );
};

