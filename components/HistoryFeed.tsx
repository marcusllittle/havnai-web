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
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({ items, onSelect }) => {
  if (!items.length) return null;

  return (
    <div className="mt-10">
      <h2 className="text-slate-200 text-sm font-semibold">
        Your Recent Creations
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {items.slice(0, 9).map((item) => (
          <button
            key={item.jobId}
            type="button"
            onClick={() => onSelect?.(item)}
            className="block focus:outline-none"
            title={item.prompt}
          >
            <img
              src={item.imageUrl}
              alt={item.prompt}
              className="rounded-lg opacity-80 hover:opacity-100 transition w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

