import Head from "next/head";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  KeyRound,
  LogOut,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { useMusicPlayer } from "../components/MusicPlayer";
import {
  cancelMusicJob,
  createMusicJob,
  fetchMusicCapabilities,
  fetchMusicJob,
  fetchMusicJobs,
  musicMediaUrl,
  type MusicCapabilities,
  type MusicJob,
} from "../lib/musicStudioApi";
import {
  FINAL_MUSIC_STATES,
  formatMusicDuration,
  musicJobError,
  musicJobTitle,
  musicStageLabel,
} from "../lib/musicJobPresentation";
import { DEFAULT_MUSIC_FORM, restoreMusicForm, type MusicFormState } from "../lib/musicStudioState";

const FORM_STORAGE_KEY = "havnai_music_studio_form_v1";
const ACTIVE_STORAGE_KEY = "havnai_music_studio_active_job";
const STUDIO_KEY = "havnai_studio_key";

function mergeJobs(current: MusicJob[], incoming: MusicJob[]): MusicJob[] {
  const jobs = new Map(current.map((job) => [job.id, job]));
  incoming.forEach((job) => jobs.set(job.id, job));
  return [...jobs.values()]
    .sort((left, right) => Number(right.updated_at || right.created_at || 0) - Number(left.updated_at || left.created_at || 0))
    .slice(0, 20);
}

function friendlyError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  if (message.includes("studio_access_denied")) return "That studio access key was not accepted.";
  if (message.includes("owner_api_not_configured")) return "Music Studio is not configured on this deployment.";
  if (message.includes("owner_api_unavailable")) return "Music Studio cannot reach HavnAI right now.";
  if (message.includes("invalid_duration")) return "Choose a song length between 10 seconds and 10 minutes.";
  if (message.includes("invalid_bpm")) return "BPM must be between 30 and 300.";
  if (message.includes("invalid_seed")) return "Seed must be a whole number from 0 to 2,147,483,647.";
  if (message.includes("unknown_model")) return "The selected music model is no longer available.";
  return message || "Something interrupted the request. Please try again.";
}

function jobDuration(job: MusicJob): number {
  const artifact = job.artifacts.find((item) => item.kind === "audio");
  return Number(artifact?.metadata?.duration || job.resolved_spec?.parameters?.duration || 0);
}

function jobStyle(job: MusicJob): string {
  return String(job.resolved_spec?.parameters?.style || "HavnAI original");
}

export default function MusicStudioPage() {
  const [accessKey, setAccessKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [capabilities, setCapabilities] = useState<MusicCapabilities | null>(null);
  const [form, setForm] = useState<MusicFormState>(DEFAULT_MUSIC_FORM);
  const [jobs, setJobs] = useState<MusicJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const { currentTrack, isPlaying, playTrack, toggle } = useMusicPlayer();

  useEffect(() => {
    setForm(restoreMusicForm(window.localStorage.getItem(FORM_STORAGE_KEY)));
    const savedKey = window.sessionStorage.getItem(STUDIO_KEY) || "";
    if (savedKey) {
      setAccessKey(savedKey);
      void connect(savedKey);
    }
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    try { window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form]);

  const activeIds = jobs.filter((job) => !job.id.startsWith("pending-") && !FINAL_MUSIC_STATES.has(job.status)).map((job) => job.id).join(",");
  useEffect(() => {
    if (!unlocked || !activeIds) return;
    const timer = window.setTimeout(() => {
      void Promise.all(activeIds.split(",").map((id) => fetchMusicJob(id, accessKey)))
        .then((updates) => {
          setJobs((current) => mergeJobs(current, updates));
          const remaining = updates.find((job) => !FINAL_MUSIC_STATES.has(job.status));
          if (remaining) window.localStorage.setItem(ACTIVE_STORAGE_KEY, remaining.id);
          else window.localStorage.removeItem(ACTIVE_STORAGE_KEY);
        })
        .catch((reason) => setError(friendlyError(reason)));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [accessKey, activeIds, unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const timer = window.setInterval(() => {
      void Promise.all([fetchMusicJobs(accessKey), fetchMusicCapabilities(accessKey)])
        .then(([recent, nextCapabilities]) => {
          setJobs((current) => mergeJobs(current, recent));
          setCapabilities(nextCapabilities);
        })
        .catch(() => undefined);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [accessKey, unlocked]);

  const musicModels = capabilities?.models.filter((model) =>
    model.available && model.capabilities?.includes("text_to_music")
  ) || [];
  const selectedModel = musicModels[0]?.id || "";
  const musicAvailable = musicModels.length > 0;

  async function connect(key: string) {
    const normalized = key.trim();
    if (!normalized) return;
    setCheckingAccess(true);
    setError("");
    try {
      const [nextCapabilities, recent] = await Promise.all([
        fetchMusicCapabilities(normalized),
        fetchMusicJobs(normalized),
      ]);
      setCapabilities(nextCapabilities);
      setJobs(recent);
      setAccessKey(normalized);
      setUnlocked(true);
      window.sessionStorage.setItem(STUDIO_KEY, normalized);
      const activeId = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
      if (activeId && !recent.some((job) => job.id === activeId)) {
        const active = await fetchMusicJob(activeId, normalized).catch(() => null);
        if (active) setJobs((current) => mergeJobs(current, [active]));
      }
    } catch (reason) {
      window.sessionStorage.removeItem(STUDIO_KEY);
      setUnlocked(false);
      setError(friendlyError(reason));
    } finally {
      setCheckingAccess(false);
    }
  }

  function update<K extends keyof MusicFormState>(key: K, value: MusicFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedModel || !form.prompt.trim()) return;
    setError("");
    setSubmitting(true);
    const optimisticId = `pending-${Date.now()}`;
    const optimistic: MusicJob = {
      id: optimisticId,
      type: "text_to_music",
      status: "queued",
      stage: "queued",
      progress: 0,
      model: selectedModel,
      created_at: Date.now() / 1000,
      resolved_spec: { parameters: { ...form, bpm: form.bpm ? Number(form.bpm) : null, seed: form.seed ? Number(form.seed) : null } },
      artifacts: [],
    };
    setJobs((current) => mergeJobs(current, [optimistic]));
    try {
      const created = await createMusicJob({
        model: selectedModel,
        prompt: form.prompt.trim(),
        style: form.style.trim(),
        lyrics: form.instrumental ? "" : form.lyrics,
        instrumental: form.instrumental,
        duration: form.duration,
        bpm: form.bpm ? Number(form.bpm) : undefined,
        key: form.key.trim() || undefined,
        seed: form.seed ? Number(form.seed) : undefined,
      }, accessKey);
      setJobs((current) => mergeJobs(current.filter((job) => job.id !== optimisticId), [created]));
      window.localStorage.setItem(ACTIVE_STORAGE_KEY, created.id);
    } catch (reason) {
      setJobs((current) => current.filter((job) => job.id !== optimisticId));
      setError(friendlyError(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(job: MusicJob) {
    try {
      await cancelMusicJob(job.id, accessKey);
      const updated = await fetchMusicJob(job.id, accessKey);
      setJobs((current) => mergeJobs(current, [updated]));
    } catch (reason) {
      setError(friendlyError(reason));
    }
  }

  if (!unlocked) {
    return (
      <>
        <Head><title>Music Studio | HavnAI</title></Head>
        <SiteHeader />
        <main className="music-gate">
          <form onSubmit={(event) => { event.preventDefault(); void connect(accessKey); }}>
            <span className="music-gate-icon"><KeyRound size={22} /></span>
            <p>HavnAI Music Studio</p>
            <h1>Enter the studio</h1>
            <label>Studio access key<input type="password" autoComplete="current-password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} autoFocus /></label>
            {error && <div className="music-alert" role="alert">{error}</div>}
            <button type="submit" disabled={checkingAccess || !accessKey.trim()}>{checkingAccess ? "Opening..." : "Open Music Studio"}</button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <Head><title>Music Studio | HavnAI</title><meta name="description" content="Create original music on the HavnAI network." /></Head>
      <SiteHeader />
      <main className="music-studio-page">
        <header className="music-studio-heading">
          <div><span><Music2 size={18} /> Music Studio</span><h1>What do you want to hear?</h1><p>Describe the feeling, scene, rhythm, or sound. HavnAI will shape it into a song.</p></div>
          <div className="music-runtime-row">
            <span className={musicAvailable ? "is-online" : ""}>{musicAvailable ? "Music ready" : "No music node available"}</span>
            <button type="button" title="Leave studio" aria-label="Leave studio" onClick={() => { window.sessionStorage.removeItem(STUDIO_KEY); setUnlocked(false); setCapabilities(null); }}><LogOut size={18} /></button>
          </div>
        </header>

        {!musicAvailable && (
          <div className="music-offline" role="status"><WifiOff size={20} /><div><strong>Music generation is offline</strong><span>Your settings are saved. Try again when a music node is available.</span></div></div>
        )}
        {error && <div className="music-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button></div>}

        <form className="music-composer" onSubmit={submit}>
          <label className="music-prompt-field">
            <span>Song description</span>
            <textarea value={form.prompt} onChange={(event) => update("prompt", event.target.value)} maxLength={4000} required placeholder="A hazy late-night R&B track with brushed drums, warm bass, and a hopeful chorus..." />
          </label>
          <div className="music-composer-grid">
            <label><span>Style</span><input value={form.style} maxLength={500} onChange={(event) => update("style", event.target.value)} placeholder="Dream pop, soulful, cinematic" /></label>
            <label><span>Length</span><select value={form.duration} onChange={(event) => update("duration", Number(event.target.value))}><option value={30}>0:30</option><option value={60}>1:00</option><option value={90}>1:30</option><option value={120}>2:00</option><option value={180}>3:00</option></select></label>
            <label className="music-switch"><span><strong>Instrumental</strong><small>Create without vocals</small></span><input type="checkbox" checked={form.instrumental} onChange={(event) => update("instrumental", event.target.checked)} /></label>
          </div>
          {!form.instrumental && (
            <details className="music-lyrics" open={Boolean(form.lyrics)}>
              <summary>Lyrics <span>Optional</span></summary>
              <label><span>Lyrics</span><textarea value={form.lyrics} maxLength={12000} onChange={(event) => update("lyrics", event.target.value)} placeholder="[Verse]\nWrite your lyrics here..." /></label>
            </details>
          )}
          <details className="music-advanced">
            <summary><SlidersHorizontal size={17} /> Advanced settings</summary>
            <div>
              <label><span>BPM</span><input type="number" min={30} max={300} value={form.bpm} onChange={(event) => update("bpm", event.target.value)} placeholder="Auto" /></label>
              <label><span>Key</span><input value={form.key} maxLength={64} onChange={(event) => update("key", event.target.value)} placeholder="Auto" /></label>
              <label><span>Seed</span><input type="number" min={0} max={2147483647} value={form.seed} onChange={(event) => update("seed", event.target.value)} placeholder="Random" /></label>
            </div>
          </details>
          <button className="music-generate" type="submit" disabled={submitting || !musicAvailable || !form.prompt.trim()}><Sparkles size={19} />{submitting ? "Adding to studio..." : "Create song"}</button>
        </form>

        <section className="music-results" aria-live="polite">
          <div className="music-results-heading"><div><span>Your studio</span><h2>Recent songs</h2></div><span>{jobs.length}</span></div>
          {jobs.length === 0 ? (
            <div className="music-empty"><Music2 size={28} /><strong>Your songs will appear here</strong><span>Start with a mood, a scene, or a sound you cannot stop thinking about.</span></div>
          ) : (
            <div className="music-song-list">
              {jobs.map((job) => {
                const audio = musicMediaUrl(job.artifacts.find((artifact) => artifact.kind === "audio")?.url);
                const title = musicJobTitle(job);
                const style = jobStyle(job);
                const duration = jobDuration(job);
                const playing = currentTrack?.id === job.id && isPlaying;
                const active = !FINAL_MUSIC_STATES.has(job.status);
                const jobError = musicJobError(job);
                return (
                  <article className={`music-song ${active ? "is-generating" : ""}`} key={job.id}>
                    <div className="music-cover">
                      <Image src="/music-default-cover.png" alt="" fill sizes="(max-width: 640px) 88px, 112px" />
                      {audio ? (
                        <button type="button" aria-label={playing ? `Pause ${title}` : `Play ${title}`} onClick={() => playing ? toggle() : playTrack({ id: job.id, title, style, audioUrl: audio, artworkUrl: "/music-default-cover.png", duration })}>
                          {playing ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}
                        </button>
                      ) : active ? <span className="music-cover-pulse" /> : null}
                    </div>
                    <div className="music-song-body">
                      <div className="music-song-title"><div><strong>{title}</strong><span>{style}</span></div><span className={`music-song-state state-${job.status}`}>{musicStageLabel(job)}</span></div>
                      {active && <div className="music-job-progress"><span style={{ width: `${Math.max(8, Math.min(99, job.progress || 8))}%` }} /></div>}
                      {jobError && <p className="music-song-error">{jobError}</p>}
                      <div className="music-song-meta"><span>{formatMusicDuration(duration)}</span>{job.resolved_spec?.parameters?.bpm && <span>{job.resolved_spec.parameters.bpm} BPM</span>}{job.resolved_spec?.parameters?.key && <span>{job.resolved_spec.parameters.key}</span>}{job.resolved_spec?.parameters?.instrumental && <span>Instrumental</span>}</div>
                    </div>
                    <div className="music-song-actions">
                      {active && !job.id.startsWith("pending-") && <button type="button" onClick={() => void cancel(job)} aria-label={`Cancel ${title}`} title="Cancel"><X size={18} /></button>}
                      {audio && <a href={audio} download aria-label={`Download ${title}`} title="Download"><Download size={18} /></a>}
                      <details><summary aria-label={`More actions for ${title}`} title="More actions"><MoreHorizontal size={19} /></summary><div>{audio ? <a href={audio} target="_blank" rel="noreferrer">Open audio</a> : <span>{musicStageLabel(job)}</span>}</div></details>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
