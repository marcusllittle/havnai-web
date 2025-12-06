import React from "react";

interface StatusBoxProps {
  message?: string;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      className="
        mt-6 p-4 rounded-xl
        bg-[rgba(255,255,255,0.05)]
        border border-[rgba(255,255,255,0.07)]
        text-slate-300 text-sm backdrop-blur-lg
      "
    >
      <p>{message}</p>
    </div>
  );
};

