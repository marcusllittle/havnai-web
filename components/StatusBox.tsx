import React from "react";

type StatusType = "loading" | "success" | "error" | "info";

function detectType(message: string): StatusType {
  const lower = message.toLowerCase();
  if (
    lower.includes("waiting") ||
    lower.includes("queued") ||
    lower.includes("rendering") ||
    lower.includes("generating") ||
    lower.includes("loading") ||
    lower.includes("uploading") ||
    lower.includes("stitching") ||
    lower.includes("submitted") ||
    lower.includes("finalizing") ||
    lower.includes("capturing") ||
    lower.includes("still running")
  ) {
    return "loading";
  }
  if (
    lower.includes("failed") ||
    lower.includes("stopped") ||
    lower.includes("error") ||
    lower.includes("required") ||
    lower.includes("not enough") ||
    lower.includes("unavailable")
  ) {
    return "error";
  }
  if (
    lower.includes("done") ||
    lower.includes("ready") ||
    lower.includes("loaded") ||
    lower.includes("showing from history")
  ) {
    return "success";
  }
  return "info";
}

/** Parse step progress like "(2/5)" from a message */
function parseSteps(message: string): { current: number; total: number } | null {
  const match = message.match(/\((\d+)\/(\d+)\)/);
  if (!match) return null;
  return { current: parseInt(match[1], 10), total: parseInt(match[2], 10) };
}

function parsePercentage(message: string): number | null {
  const match = message.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

interface StatusBoxProps {
  message?: string;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ message }) => {
  if (!message) return null;
  const type = detectType(message);
  const steps = parseSteps(message);
  const percentage = parsePercentage(message);

  return (
    <div className={`status-box status-${type}`}>
      <div className="status-row">
        <span className="status-icon">
          {type === "loading" && <span className="status-spinner" />}
          {type === "success" && "\u2714"}
          {type === "error" && "\u2718"}
          {type === "info" && "\u2139"}
        </span>
        <span className="status-text">{message}</span>
      </div>
      {steps && (
        <div className="status-steps">
          <div className="status-steps-track">
            {Array.from({ length: steps.total }, (_, i) => (
              <div
                key={i}
                className={`status-step-dot ${
                  i < steps.current ? "is-done" : i === steps.current ? "is-active" : ""
                }`}
              />
            ))}
          </div>
          <span className="status-steps-label">
            Step {steps.current} of {steps.total}
          </span>
        </div>
      )}
      {percentage !== null && (
        <div
          className="status-progress"
          role="progressbar"
          aria-label="Render progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div className="status-progress-track">
            <span style={{ width: `${percentage}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};
