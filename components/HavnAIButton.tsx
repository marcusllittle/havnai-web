import React from "react";

interface HavnAIButtonProps {
  label: string;
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const HavnAIButton: React.FC<HavnAIButtonProps> = ({
  label,
  loading,
  onClick,
  disabled,
}) => {
  const effectiveLabel = loading ? "Generating…" : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full py-4 mt-4 rounded-full
                  bg-gradient-to-r from-cyan-400 to-blue-600
                  text-white font-semibold text-lg
                  shadow-[0_0_20px_rgba(0,200,255,0.4)]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${loading ? "animate-pulse" : ""}`}
    >
      {effectiveLabel}{" "}
      {!loading && <span className="ml-1 text-base align-middle">»</span>}
    </button>
  );
};

