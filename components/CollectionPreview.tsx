import React, { useState } from "react";
import { ImageOff, ImageIcon, Film } from "lucide-react";

export function CollectionPreview({ src, type, label }: { src?: string; type: string; label: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  const unavailable = !src || failedSource === src;
  return (
    <>
      {unavailable ? (
        <span className="collection-preview-fallback">
          <ImageOff size={26} strokeWidth={1.3} aria-hidden="true" />
          <span>Preview unavailable</span>
        </span>
      ) : type === "video" ? (
        <video src={src} muted playsInline preload="metadata" onError={() => setFailedSource(src)} />
      ) : (
        <img src={src} alt={label} loading="lazy" onError={() => setFailedSource(src)} />
      )}
      <span className="collection-media-type">
        {type === "video" ? <Film size={12} aria-hidden="true" /> : <ImageIcon size={12} aria-hidden="true" />}
        {type === "video" ? "Video" : type === "image" ? "Image" : "Media"}
      </span>
    </>
  );
}
