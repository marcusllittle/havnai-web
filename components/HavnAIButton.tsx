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
      className="btn primary wide"
    >
      {effectiveLabel}
    </button>
  );
};
