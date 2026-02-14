import React, { useState } from "react";

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

export const HistoryFeed: React.FC<HistoryFeedProps> = ({
  items,
  activeJobId,
  onSelect,
  onClear,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  if (!items.length) return null;

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    onClear?.();
    setConfirmClear(false);
  };

  return (
    <div className="generator-history">
      <div className="generator-history-header">
        <h3>Recent Creations</h3>
        <span className="history-count">{items.length}</span>
        {onClear && (
          <button
            type="button"
            onClick={handleClear}
            className={`generator-history-clear ${confirmClear ? "is-confirm" : ""}`}
          >
            {confirmClear ? "Tap again to clear" : "Clear"}
          </button>
        )}
      </div>
      <div className="generator-history-grid">
        {items.slice(0, 9).map((item) => {
          const isActive = activeJobId === item.jobId;
          return (
            <button
              key={item.jobId}
              type="button"
              onClick={() => onSelect?.(item)}
              className={`generator-history-thumb ${isActive ? "is-active" : ""}`}
              title={item.prompt}
            >
              {item.videoUrl ? (
                <video src={item.videoUrl} muted playsInline preload="metadata" />
              ) : item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.prompt}
                  loading="lazy"
                />
              ) : (
                <div className="history-placeholder" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
