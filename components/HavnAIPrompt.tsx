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
    <div className="mt-6">
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe what you want…"
        className="w-full px-5 py-4 rounded-2xl bg-[rgba(255,255,255,0.05)]
                   border border-[rgba(255,255,255,0.1)]
                   text-white placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-cyan-400/60
                   backdrop-blur-md resize-none"
        disabled={disabled}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (!disabled) onSubmit();
          }
        }}
      />
      <p className="mt-2 text-[11px] text-slate-400 text-right">
        Press <span className="font-semibold text-slate-200">Ctrl+Enter</span>{" "}
        to generate.
      </p>
    </div>
  );
};

