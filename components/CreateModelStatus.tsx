import React from "react";
import { CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";

interface CreateModelStatusProps {
  loading: boolean;
  error: boolean;
  modelName?: string;
  mode: "image" | "video" | "face_swap";
  onRetry: () => void;
}

export function CreateModelStatus({ loading, error, modelName, mode, onRetry }: CreateModelStatusProps) {
  const label = mode === "face_swap" ? "face swap" : mode;

  if (!loading && !error && modelName) {
    return <p className="studio-model-summary"><span>Using</span> <strong>{modelName}</strong></p>;
  }

  return (
    <div className="studio-model-notice" role="status" aria-live="polite">
      {loading ? <LoaderCircle size={17} className="studio-loading-icon" aria-hidden="true" /> : <CircleAlert size={17} aria-hidden="true" />}
      <div>
        <strong>{loading ? "Finding available models…" : error ? "Models couldn’t load" : `No ${label} models online`}</strong>
        <p>{loading ? "You can write your prompt while we connect." : "Your prompt stays here. Check again in a moment."}</p>
      </div>
      {!loading && <button type="button" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" /> Retry</button>}
    </div>
  );
}
