import React from "react";

interface AlphaDisclaimerProps {
  message?: string;
  className?: string;
}

export const AlphaDisclaimer: React.FC<AlphaDisclaimerProps> = ({
  message = "Public Alpha reward tracking, pricing, and settlement rules may continue to evolve. Any testnet activity should be treated as alpha-state.",
  className,
}) => {
  return (
    <div className={`alpha-disclaimer${className ? ` ${className}` : ""}`} role="note">
      <span className="alpha-disclaimer-label">Public Alpha</span>
      <span className="alpha-disclaimer-text">{message}</span>
    </div>
  );
};
