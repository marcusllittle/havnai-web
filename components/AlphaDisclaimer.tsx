import React from "react";

interface AlphaDisclaimerProps {
  message?: string;
  className?: string;
}

export const AlphaDisclaimer: React.FC<AlphaDisclaimerProps> = ({
  message = "Weights and rewards are simulated in Alpha and may change. No payouts are active yet.",
  className,
}) => {
  return (
    <div className={`alpha-disclaimer${className ? ` ${className}` : ""}`} role="note">
      <span className="alpha-disclaimer-label">Alpha Disclaimer</span>
      <span className="alpha-disclaimer-text">{message}</span>
    </div>
  );
};
