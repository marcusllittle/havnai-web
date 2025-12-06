import React from "react";

interface HavnAIPromptProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const HavnAIPrompt: React.FC<HavnAIPromptProps> = ({
  value,
  onChange,
  onSubmit,
  disabled,
}) => {
  return (
    <div>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe what you want…"
        className="generator-prompt"
        disabled={disabled}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (!disabled) onSubmit();
          }
        }}
      />
      <p className="generator-help">
        Press <strong>Ctrl+Enter</strong> to generate.
      </p>
    </div>
  );
};
