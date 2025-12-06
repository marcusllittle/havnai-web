import React from "react";

interface StatusBoxProps {
  message?: string;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="generator-status">{message}</p>
  );
};
