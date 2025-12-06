import React from "react";

export interface HistoryItem {
  jobId: string;
  prompt: string;
  imageUrl: string;
  model?: string;
  timestamp: number;
}

interface HistoryFeedProps {
  items: HistoryItem[];
  onSelect?: (item: HistoryItem) => void;
  onClear?: () => void;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({
  items,
  onSelect,
  onClear,
}) => {
  if (!items.length) return null;

  return (
    <div className="generator-history">
      <div className="generator-history-header">
        <h3>Your Recent Creations</h3>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="generator-history-clear"
          >
            Clear
          </button>
        )}
      </div>
      <div className="generator-history-grid">
        {items.slice(0, 9).map((item) => (
          <button
            key={item.jobId}
            type="button"
            onClick={() => onSelect?.(item)}
            className="generator-history-thumb"
            title={item.prompt}
          >
            <img
              src={item.imageUrl}
              alt={item.prompt}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
