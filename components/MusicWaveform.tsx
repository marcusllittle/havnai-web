import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BAR_COUNT = 96;
const PEAK_CACHE = new Map<string, number[]>();
const MAX_CACHE_ENTRIES = 40;

/**
 * Decode an audio file down to a fixed number of RMS peaks.
 *
 * Decoding is done once per URL and memoised, because a studio page can show a
 * dozen tracks and each decode is comparatively expensive.
 */
async function loadPeaks(url: string, signal: AbortSignal): Promise<number[]> {
  const cached = PEAK_CACHE.get(url);
  if (cached) return cached;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`waveform_fetch_failed_${response.status}`);
  const buffer = await response.arrayBuffer();

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("no_audio_context");

  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(buffer);
    const channel = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks: number[] = [];
    for (let index = 0; index < BAR_COUNT; index += 1) {
      const start = index * blockSize;
      let sum = 0;
      for (let offset = 0; offset < blockSize; offset += 1) {
        const sample = channel[start + offset] || 0;
        sum += sample * sample;
      }
      peaks.push(Math.sqrt(sum / blockSize));
    }
    const ceiling = Math.max(...peaks, 0.0001);
    const normalised = peaks.map((peak) => Math.max(0.06, peak / ceiling));
    if (PEAK_CACHE.size >= MAX_CACHE_ENTRIES) {
      const oldest = PEAK_CACHE.keys().next().value;
      if (oldest) PEAK_CACHE.delete(oldest);
    }
    PEAK_CACHE.set(url, normalised);
    return normalised;
  } finally {
    void context.close().catch(() => undefined);
  }
}

/** A flat placeholder so layout never jumps while peaks are still decoding. */
function placeholderPeaks(seed: string): number[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return Array.from({ length: BAR_COUNT }, (_unused, index) => {
    const wobble = Math.sin((index + (hash % 17)) * 0.35) * 0.5 + 0.5;
    return 0.18 + wobble * 0.34;
  });
}

export interface MusicWaveformProps {
  audioUrl?: string;
  /** 0-1 playback position, drives the played/unplayed split. */
  progress?: number;
  /** Seek to a 0-1 position. Omit to render a non-interactive waveform. */
  onSeek?: (position: number) => void;
  height?: number;
  accent?: string;
  label?: string;
}

export function MusicWaveform({
  audioUrl,
  progress = 0,
  onSeek,
  height = 56,
  accent = "#55dbe6",
  label = "Waveform",
}: MusicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const fallback = useMemo(() => placeholderPeaks(audioUrl || label), [audioUrl, label]);

  useEffect(() => {
    if (!audioUrl) {
      setPeaks(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    loadPeaks(audioUrl, controller.signal)
      .then((next) => {
        if (active) setPeaks(next);
      })
      .catch(() => {
        // A decode failure is cosmetic — the placeholder stays and playback is unaffected.
        if (active) setPeaks(null);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [audioUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ratio = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    if (!width) return;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const values = peaks || fallback;
    const gap = 2;
    const barWidth = Math.max(1, width / values.length - gap);
    const clamped = Math.min(1, Math.max(0, progress));
    const playedUpTo = clamped * width;

    values.forEach((value, index) => {
      const x = index * (barWidth + gap);
      const barHeight = Math.max(2, value * (height - 6));
      const y = (height - barHeight) / 2;
      const played = x + barWidth / 2 <= playedUpTo;
      context.fillStyle = played
        ? accent
        : peaks
        ? "rgba(255, 255, 255, 0.22)"
        : "rgba(255, 255, 255, 0.12)";
      const radius = Math.min(barWidth / 2, 2);
      context.beginPath();
      if (typeof context.roundRect === "function") {
        context.roundRect(x, y, barWidth, barHeight, radius);
      } else {
        context.rect(x, y, barWidth, barHeight);
      }
      context.fill();
    });
  }, [accent, fallback, height, peaks, progress]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [draw]);

  function seekFromEvent(event: React.MouseEvent<HTMLDivElement>) {
    if (!onSeek) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    onSeek(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)));
  }

  function seekFromKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSeek) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onSeek(Math.min(1, progress + 0.05));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSeek(Math.max(0, progress - 0.05));
    }
  }

  return (
    <div
      className={`music-waveform${onSeek ? " is-seekable" : ""}`}
      style={{ height }}
      onClick={seekFromEvent}
      onKeyDown={seekFromKey}
      role={onSeek ? "slider" : "img"}
      tabIndex={onSeek ? 0 : -1}
      aria-label={label}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

export default MusicWaveform;
