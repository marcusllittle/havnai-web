import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Clapperboard, Download, Film, SlidersHorizontal } from "lucide-react";

interface OutputCardProps {
  imageUrl?: string;
  videoUrl?: string;
  model?: string;
  runtimeSeconds?: number | null;
  jobId?: string;
  pending?: boolean;
  statusMessage?: string;
  onRetry?: () => void;
  onUseLastFrame?: (dataUrl: string) => void;
  onAnimateImage?: () => void;
  onRefineImage?: () => void;
}

function friendlyModel(name?: string): string {
  if (!name) return "Auto";
  return name.replace(/_v\d+SD15/i, "").replace(/_v[xvi]+[a-z]*/i, "")
    .replace(/_v\d+/i, "").replace(/By$/i, "").replace(/_beta$/i, "")
    .replace(/_final$/i, "").replace(/Merge$/i, "").replace(/_/g, " ").trim() || name;
}

// A damaged or unsupported clip must not leave the capture button busy forever.
function waitForVideo(video: HTMLVideoElement, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener("error", fail);
      signal.removeEventListener("abort", fail);
    };
    const ready = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Video could not be read")); };
    const timer = setTimeout(fail, 15000);
    video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", fail, { once: true });
    signal.addEventListener("abort", fail, { once: true });
    if (signal.aborted) fail();
  });
}

export const OutputCard: React.FC<OutputCardProps> = ({
  imageUrl, videoUrl, model, runtimeSeconds, jobId, pending = false,
  statusMessage, onRetry, onUseLastFrame, onAnimateImage, onRefineImage,
}) => {
  const [frameBusy, setFrameBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const lifecycle = useRef<AbortController | null>(null);
  const downloading = useRef(false);
  const capturing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    downloading.current = false;
    capturing.current = false;
    setFrameBusy(false);
    setDownloadBusy(false);
    setNotice("");
    setDownloadFailed(false);
    setMediaFailed(false);
    setMediaRevision(0);
    return () => controller.abort();
  }, [imageUrl, videoUrl, jobId]);

  const mediaUrl = videoUrl || imageUrl;
  const isCurrent = (controller: AbortController) =>
    lifecycle.current === controller && !controller.signal.aborted;

  const handleDownload = async () => {
    const controller = lifecycle.current;
    if (!mediaUrl || !controller || downloading.current) return;
    downloading.current = true;
    setDownloadBusy(true);
    setNotice("");
    setDownloadFailed(false);
    try {
      const response = await fetch(mediaUrl, { signal: controller.signal });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      if (!isCurrent(controller)) return;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      // Preserve the actual asset type instead of renaming every image to PNG.
      const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm" } as Record<string, string>)[blob.type.split(";")[0]];
      link.download = `havnai-${(jobId || "output").slice(0, 12)}${extension ? "." + extension : ""}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice("Download started.");
    } catch {
      if (isCurrent(controller)) {
        setDownloadFailed(true);
        setNotice("The download couldn't finish. Try again, or open the original to save it.");
      }
    } finally {
      if (isCurrent(controller)) { downloading.current = false; setDownloadBusy(false); }
    }
  };

  const handleCopyId = async () => {
    const controller = lifecycle.current;
    if (!jobId || !controller) return;
    try {
      await navigator.clipboard.writeText(jobId);
      if (isCurrent(controller)) setNotice("Job ID copied.");
    } catch {
      if (isCurrent(controller)) setNotice("Couldn't copy the ID. Select the full ID in Result details to copy it manually.");
    }
  };

  const handleUseLastFrame = async () => {
    const controller = lifecycle.current;
    if (!videoUrl || !onUseLastFrame || !controller || capturing.current) return;
    capturing.current = true;
    setFrameBusy(true);
    setNotice("");
    let objectUrl: string | undefined;
    let video: HTMLVideoElement | undefined;
    try {
      const response = await fetch(videoUrl, { signal: controller.signal });
      if (!response.ok) throw new Error("Video unavailable");
      const blob = await response.blob();
      if (!isCurrent(controller)) return;
      objectUrl = URL.createObjectURL(blob);
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const loaded = waitForVideo(video, "loadeddata", controller.signal);
      video.src = objectUrl;
      await loaded;
      if (!Number.isFinite(video.duration) || !video.videoWidth || !video.videoHeight) throw new Error("Invalid video");
      const targetTime = Math.max(0, video.duration - 0.1);
      if (targetTime > 0) {
        const seeked = waitForVideo(video, "seeked", controller.signal);
        video.currentTime = targetTime;
        await seeked;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (isCurrent(controller)) {
        onUseLastFrame(canvas.toDataURL("image/png"));
        setNotice("Last frame added as your next video's start frame.");
      }
    } catch {
      if (isCurrent(controller)) setNotice("The last frame couldn't be captured. Try again, or upload a start image in Video.");
    } finally {
      if (video) { video.removeAttribute("src"); video.load(); }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (isCurrent(controller)) { capturing.current = false; setFrameBusy(false); }
    }
  };

  if (!mediaUrl) {
    return (
      <div className="generator-output-card generator-output-placeholder" aria-live="polite" aria-busy={pending}>
        <div className="generator-output-placeholder-body">
          {pending ? <span className="status-spinner" aria-hidden="true" /> : null}
          <strong>{pending ? "Bringing your idea to life" : jobId ? "Waiting for your result" : "Your canvas is ready"}</strong>
          <span>{statusMessage || (jobId ? "Output unavailable." : "Your next creation will appear here.")}</span>
          {jobId && !pending && onRetry ? <button type="button" className="generator-mini-button" onClick={onRetry}>Check status</button> : null}
        </div>
        {jobId ? <span className="generator-output-placeholder-id">#{jobId.slice(0, 12)}</span> : null}
      </div>
    );
  }

  return (
    <div className="generator-output-card">
      <div className="studio-output-canvas">
        {mediaFailed ? (
          <div className="generator-output-placeholder-body generator-output-media-error" role="alert">
            <strong>The preview couldn't load</strong>
            <span>Your result may still be available. Try loading it again.</span>
            <button type="button" className="generator-mini-button" onClick={() => { setMediaFailed(false); setMediaRevision(value => value + 1); }}>Retry preview</button>
          </div>
        ) : videoUrl ? (
          <video key={`${mediaUrl}-${mediaRevision}`} className="generator-output-media" src={mediaUrl} controls playsInline preload="metadata" onError={() => setMediaFailed(true)} />
        ) : (
          <img key={`${mediaUrl}-${mediaRevision}`} src={mediaUrl} alt="Generated image" onError={() => setMediaFailed(true)} />
        )}
      </div>
      <div className="generator-output-meta">
        <span className="output-meta-badge">{videoUrl ? "Video" : "Image"}</span>
        <span className="output-meta-model">{friendlyModel(model)}</span>
        {typeof runtimeSeconds === "number" && Number.isFinite(runtimeSeconds) && runtimeSeconds >= 0 ? <span className="output-meta-time">{runtimeSeconds.toFixed(1)}s</span> : null}
      </div>
      <div className="generator-output-actions" aria-label="Result actions">
        <button type="button" onClick={handleDownload} className="generator-download studio-output-download" disabled={downloadBusy}>
          <Download size={16} aria-hidden="true" />{downloadBusy ? "Downloading..." : videoUrl ? "Download video" : "Download image"}
        </button>
        {imageUrl && !videoUrl && onRefineImage ? <button type="button" onClick={onRefineImage} className="generator-download"><SlidersHorizontal size={16} aria-hidden="true" />Refine image</button> : null}
        {imageUrl && !videoUrl && onAnimateImage ? <button type="button" onClick={onAnimateImage} className="generator-download"><Clapperboard size={16} aria-hidden="true" />Animate image</button> : null}
        {videoUrl && onUseLastFrame ? <button type="button" onClick={handleUseLastFrame} className="generator-download" disabled={frameBusy}><Film size={16} aria-hidden="true" />{frameBusy ? "Capturing..." : "Use last frame"}</button> : null}
      </div>
      {notice ? <p className="studio-output-notice" role="status">{notice}</p> : null}
      {downloadFailed ? <a className="studio-output-original" href={mediaUrl} target="_blank" rel="noopener noreferrer" aria-label="Open original in a new tab">Open original <ArrowUpRight size={14} aria-hidden="true" /></a> : null}
      {jobId ? (
        <details className="studio-output-details">
          <summary>Result details</summary>
          <div><span>Job ID</span><code>{jobId}</code><button type="button" onClick={handleCopyId}>Copy ID</button></div>
        </details>
      ) : null}
    </div>
  );
};
