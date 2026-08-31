import Image from "next/image";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from "lucide-react";
import { formatMusicDuration } from "../lib/musicJobPresentation";
import { getApiBase } from "../lib/apiBase";
import { adjacentQueueIndex, playableQueue, resolveQueueSelection } from "../lib/musicPlayerQueue";

export interface PlayerTrack {
  id: string;
  title: string;
  style: string;
  audioUrl: string;
  artworkUrl?: string;
  duration?: number;
  publicationId?: string;
}

interface PlayerContextValue {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  queue: PlayerTrack[];
  queueIndex: number;
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[], index?: number) => void;
  playQueue: (queue: PlayerTrack[], index?: number) => void;
  next: () => void;
  previous: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  toggle: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const STORAGE_KEY = "havnai_music_player_track";
const QUEUE_STORAGE_KEY = "havnai_music_player_queue";
const VOLUME_KEY = "havnai_music_player_volume";
const SESSION_KEY = "havnai_music_listener_session";

function listenerSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `listener-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "listener-anonymous";
  }
}

function recordPublicationPlay(publicationId: string, secondsListened: number, completed = false): void {
  void fetch(`${getApiBase()}/music/publications/${encodeURIComponent(publicationId)}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seconds_listened: Math.max(0, secondsListened),
      completed,
      session_id: listenerSessionId(),
    }),
  }).catch(() => undefined);
}

export function useMusicPlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return value;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldPlayRef = useRef(false);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playerError, setPlayerError] = useState("");
  const countedPlayRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const savedQueue = window.localStorage.getItem(QUEUE_STORAGE_KEY);
      const savedVolumeRaw = window.localStorage.getItem(VOLUME_KEY);
      const savedVolume = savedVolumeRaw === null ? Number.NaN : Number(savedVolumeRaw);
      const parsedTrack = saved ? JSON.parse(saved) as PlayerTrack : null;
      const parsedQueue = savedQueue ? JSON.parse(savedQueue) : null;
      if (Array.isArray(parsedQueue) && parsedQueue.every((item) => item?.id && item?.audioUrl)) {
        setQueue(parsedQueue);
        const index = parsedTrack ? parsedQueue.findIndex((item) => item.id === parsedTrack.id) : -1;
        setQueueIndex(index >= 0 ? index : 0);
      } else if (parsedTrack) {
        setQueue([parsedTrack]);
      }
      if (parsedTrack) setCurrentTrack(parsedTrack);
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) setVolume(savedVolume);
    } catch {
      // Browser storage is optional; playback still works without it.
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    try { window.localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* ignore */ }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setPlayerError("");
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);
    countedPlayRef.current = null;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTrack)); } catch { /* ignore */ }
    if (shouldPlayRef.current) {
      shouldPlayRef.current = false;
      void audio.play().catch(() => setPlayerError("Playback could not start. Try pressing play again."));
    }
  }, [currentTrack?.id, currentTrack?.audioUrl]);

  useEffect(() => {
    if (!currentTrack) return;
    try { window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue)); } catch { /* ignore */ }
  }, [currentTrack, queue]);

  const playTrack = useCallback((track: PlayerTrack, nextQueue?: PlayerTrack[], index?: number) => {
    const audio = audioRef.current;
    const resolved = resolveQueueSelection(track, nextQueue, index);
    if (!resolved.track) return;
    setQueue(resolved.queue);
    setQueueIndex(resolved.index);
    if (currentTrack?.id === track.id && audio) {
      setPlayerError("");
      void audio.play().catch(() => setPlayerError("This audio could not be played."));
      return;
    }
    shouldPlayRef.current = true;
    setCurrentTrack(resolved.track);
  }, [currentTrack?.id]);

  const playQueue = useCallback((nextQueue: PlayerTrack[], index = 0) => {
    const playable = playableQueue(nextQueue);
    if (playable.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, playable.length - 1));
    shouldPlayRef.current = true;
    setQueue(playable);
    setQueueIndex(safeIndex);
    setCurrentTrack(playable[safeIndex]);
  }, []);

  const hasPrevious = queueIndex > 0;
  const hasNext = queueIndex >= 0 && queueIndex < queue.length - 1;

  const previous = useCallback(() => {
    const nextIndex = adjacentQueueIndex(queue.length, queueIndex, -1);
    if (nextIndex == null) return;
    shouldPlayRef.current = true;
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  }, [queue, queueIndex]);

  const next = useCallback(() => {
    const nextIndex = adjacentQueueIndex(queue.length, queueIndex, 1);
    if (nextIndex == null) return;
    shouldPlayRef.current = true;
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  }, [queue, queueIndex]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setPlayerError("");
    if (audio.paused) void audio.play().catch(() => setPlayerError("This audio could not be played."));
    else audio.pause();
  }, [currentTrack]);

  const contextValue = useMemo(
    () => ({ currentTrack, isPlaying, queue, queueIndex, playTrack, playQueue, next, previous, hasNext, hasPrevious, toggle }),
    [currentTrack, hasNext, hasPrevious, isPlaying, next, playQueue, playTrack, previous, queue, queueIndex, toggle]
  );
  const displayedDuration = duration || currentTrack?.duration || 0;

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
      <audio
        ref={audioRef}
        src={currentTrack?.audioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => {
          const nextTime = event.currentTarget.currentTime;
          setCurrentTime(nextTime);
          if (
            currentTrack?.publicationId &&
            countedPlayRef.current !== currentTrack.publicationId &&
            nextTime >= 5
          ) {
            countedPlayRef.current = currentTrack.publicationId;
            recordPublicationPlay(currentTrack.publicationId, nextTime);
          }
        }}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => {
          if (currentTrack?.publicationId && countedPlayRef.current !== currentTrack.publicationId) {
            countedPlayRef.current = currentTrack.publicationId;
            recordPublicationPlay(currentTrack.publicationId, audioRef.current?.currentTime || duration, true);
          }
          if (hasNext) {
            next();
          } else {
            setIsPlaying(false);
          }
        }}
        onError={() => {
          if (hasNext) {
            setPlayerError("This audio file is unavailable. Playing the next track.");
            next();
          } else {
            setIsPlaying(false);
            setPlayerError("This audio file is unavailable or could not be played.");
          }
        }}
      />
      {currentTrack && (
        <aside className="music-player" aria-label="Now playing">
          <div className="music-player-track">
            <Image src={currentTrack.artworkUrl || "/music-default-cover.png"} alt="" width={56} height={56} />
            <div><strong>{currentTrack.title}</strong><span>{currentTrack.style || "HavnAI Music"}</span></div>
          </div>
          <div className="music-player-transport">
            <button type="button" onClick={previous} disabled={!hasPrevious} aria-label="Previous track" title="Previous">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button type="button" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button type="button" onClick={next} disabled={!hasNext} aria-label="Next track" title="Next">
              <SkipForward size={18} fill="currentColor" />
            </button>
            <span>{formatMusicDuration(currentTime)}</span>
            <input
              aria-label="Seek"
              type="range"
              min={0}
              max={Math.max(displayedDuration, 1)}
              step={0.1}
              value={Math.min(currentTime, Math.max(displayedDuration, 1))}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = next;
                setCurrentTime(next);
              }}
            />
            <span>{formatMusicDuration(displayedDuration)}</span>
          </div>
          <div className="music-player-volume">
            {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
            <input aria-label="Volume" type="range" min={0} max={1} step={0.02} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          </div>
          {playerError && <p className="music-player-error" role="alert">{playerError}</p>}
          <button
            className="music-player-close"
            type="button"
            aria-label="Close player"
            title="Close player"
            onClick={() => {
              audioRef.current?.pause();
              setCurrentTrack(null);
              setQueue([]);
              setQueueIndex(0);
              setPlayerError("");
              try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
              try { window.localStorage.removeItem(QUEUE_STORAGE_KEY); } catch { /* ignore */ }
            }}
          ><X size={18} /></button>
        </aside>
      )}
    </PlayerContext.Provider>
  );
}
