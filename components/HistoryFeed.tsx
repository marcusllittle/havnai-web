import React, { useState } from "react";
import { Film, ImageOff } from "lucide-react";

export interface HistoryItem {
  jobId: string;
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  model?: string;
  timestamp: number;
}

interface HistoryFeedProps {
  items: HistoryItem[];
  activeJobId?: string;
  onSelect?: (item: HistoryItem) => void;
  onClear?: () => void;
}

function HistoryPreview({ item }: { item: HistoryItem }) {
  const [failed, setFailed] = useState(false);
  if (failed || (!item.imageUrl && !item.videoUrl)) {
    return <span className="studio-history-unavailable"><ImageOff size={22} aria-hidden="true" /><span>Preview unavailable</span></span>;
  }
  return item.videoUrl
    ? <video src={item.videoUrl} muted playsInline preload="metadata" aria-hidden="true" onError={() => setFailed(true)} />
    : <img src={item.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({
  items,
  activeJobId,
  onSelect,
  onClear,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  if (!items.length) return null;

  return (
    <div className="generator-history">
      <div className="generator-history-header">
        <div><h2>Recent creations</h2><p>Pick up where you left off.</p></div>
        {onClear && (
          <button
            type="button"
            onClick={() => setConfirmClear(value => !value)}
            className="generator-history-clear"
            aria-expanded={confirmClear}
          >
            Clear history
          </button>
        )}
      </div>
      {confirmClear ? (
        <div className="studio-history-confirm">
          <p>Clear recent history on this browser? Items saved to Collection stay there.</p>
          <button type="button" onClick={() => setConfirmClear(false)}>Keep history</button>
          <button type="button" onClick={() => { onClear?.(); setConfirmClear(false); }}>Clear recent history</button>
        </div>
      ) : null}
      <div className="generator-history-grid">
        {items.slice(0, 9).map((item) => {
          const isActive = activeJobId === item.jobId;
          return (
            <button
              key={item.jobId}
              type="button"
              onClick={() => onSelect?.(item)}
              className={`generator-history-thumb ${isActive ? "is-active" : ""}`}
              aria-label={`Open ${item.videoUrl ? "video" : "image"}: ${item.prompt || "Untitled creation"}`}
              aria-pressed={isActive}
              disabled={!onSelect}
            >
              <span className="studio-history-art"><HistoryPreview key={item.videoUrl || item.imageUrl || item.jobId} item={item} />
                <span className="studio-history-kind">{item.videoUrl ? <Film size={12} aria-hidden="true" /> : null}{item.videoUrl ? "Video" : "Image"}</span>
              </span>
              <span className="studio-history-title">{item.prompt || "Untitled creation"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
