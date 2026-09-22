import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function HomeVideoPreview({ src, poster, alt }: { src?: string; poster: string; alt: string }) {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(preference.matches);
    const visibility = () => setPageVisible(!document.hidden);
    motion(); visibility();
    preference.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    // Unsupported observers keep the static poster, rather than eagerly downloading.
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 }) : null;
    if (container.current) observer?.observe(container.current);
    return () => {
      preference.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      observer?.disconnect();
    };
  }, [src]);

  const shouldPlay = Boolean(src && inView && !reducedMotion && pageVisible && !paused && !failed);
  useEffect(() => { if (shouldPlay) setLoaded(true); }, [shouldPlay]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    if (shouldPlay) {
      element.play().catch(() => { if (!cancelled) { setPaused(true); setPlaying(false); } });
    } else element.pause();
    return () => { cancelled = true; element.pause(); };
  }, [shouldPlay, loaded]);

  return <div className="havn-video-preview" ref={container}>
    <Image src={poster} alt={alt} fill sizes="(max-width: 600px) calc(100vw - 32px), 410px" />
    {src && loaded && !reducedMotion && !failed && <video
      ref={video} src={src} poster={poster} muted loop playsInline preload="none"
      aria-hidden="true" className={playing ? "is-playing" : undefined}
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setFailed(true); setPlaying(false); }}
    />}
    {src && loaded && !reducedMotion && !failed && <button type="button"
      className="havn-preview-control" aria-label={playing ? "Pause video preview" : "Play video preview"}
      onClick={() => setPaused(!paused)}>
      {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
      {playing ? "Pause" : "Play"}
    </button>}
  </div>;
}
