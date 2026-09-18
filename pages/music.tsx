import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ArrowUpRight,
  LogOut,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  WifiOff,
  X,
} from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { StudioAccessGate } from "../components/StudioAccessGate";
import { useMusicPlayer } from "../components/MusicPlayer";
import { useWallet } from "../components/WalletProvider";
import { MusicComposer, type SourceClip } from "../components/MusicComposer";
import { MusicWaveform } from "../components/MusicWaveform";
import {
  fetchMusicDiscover,
  publishMusicJob,
  unpublishMusicPublication,
  type MusicPublication,
} from "../lib/havnai";
import {
  cancelMusicJob,
  createMusicJob,
  fetchMusicCapabilities,
  fetchMusicJob,
  fetchMusicJobs,
  musicJobRequest,
  musicMediaUrl,
  musicTakes,
  uploadMusicAsset,
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
import {
  availableModes,
  musicFormBlocker,
  restoreMusicForm,
  trackLabel,
  DEFAULT_MUSIC_FORM,
  MUSIC_MODES_NEEDING_SOURCE,
  MUSIC_MODE_LABELS,
  type MusicFormState,
  type MusicMode,
} from "../lib/musicStudioState";

// v1 key retained deliberately: restoreMusicForm fills new fields with defaults,
// so older saved drafts still load instead of being discarded.
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
  if (message.includes("mode_unsupported_by_model")) {
    return "This model cannot run that mode. Pick another model in Advanced settings.";
  }
  if (message.includes("source_audio_required")) return "Add the track you want to work from first.";
  if (message.includes("invalid_repaint_range")) return "The repaint end must come after the start.";
  if (message.includes("invalid_track_classes")) return "Pick at least one part to add.";
  if (message.includes("unsupported_asset_type")) return "That file is not an audio format we can read.";
  if (message.includes("insufficient_storage")) return "The network is out of upload space right now.";
  return message || "Something interrupted the request. Please try again.";
}

function jobDuration(job: MusicJob): number {
  const artifact = job.artifacts.find((item) => item.kind === "audio");
  return Number(artifact?.metadata?.duration || job.resolved_spec?.parameters?.duration || 0);
}

function jobStyle(job: MusicJob): string {
  return String(job.resolved_spec?.parameters?.style || "HavnAI original");
}

function jobMode(job: MusicJob): MusicMode | null {
  const raw = String(job.resolved_spec?.mode || job.resolved_spec?.parameters?.mode || "");
  return raw in MUSIC_MODE_LABELS ? (raw as MusicMode) : null;
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
  const [source, setSource] = useState<SourceClip | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [publications, setPublications] = useState<MusicPublication[]>([]);
  const [publishJob, setPublishJob] = useState<MusicJob | null>(null);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishTags, setPublishTags] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState("");
  const mountedRef = useRef(false);
  const { currentTrack, isPlaying, playTrack, toggle, currentTime, duration, seek } = useMusicPlayer();
  const wallet = useWallet();
  const activeWallet = wallet.activeWallet;
  const connectedWallet = wallet.connectedWallet;
  const [loadingPublications, setLoadingPublications] = useState(false);
  const publicationReadInFlight = useRef(false);
  const publicationWallet = useRef(connectedWallet);
  publicationWallet.current = connectedWallet;

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

  // Close the row action menu on any outside click.
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenu]);

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
      void Promise.all([
        fetchMusicJobs(accessKey),
        fetchMusicCapabilities(accessKey),
      ])
        .then(([recent, nextCapabilities]) => {
          setJobs((current) => mergeJobs(current, recent));
          setCapabilities(nextCapabilities);
        })
        .catch(() => undefined);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [accessKey, unlocked]);

  useEffect(() => { setPublications([]); }, [activeWallet]);

  async function loadPublishingStatus() {
    if (!connectedWallet || publicationReadInFlight.current) return;
    publicationReadInFlight.current = true;
    setLoadingPublications(true);
    try {
      const response = await fetchMusicDiscover({ creator_wallet: connectedWallet, wallet: connectedWallet, limit: 100 });
      if (publicationWallet.current === connectedWallet) setPublications(response.publications);
    } catch (reason) { setError(friendlyError(reason)); }
    finally { publicationReadInFlight.current = false; setLoadingPublications(false); }
  }

  const musicModels = useMemo(
    () =>
      (capabilities?.models || [])
        .filter((model) => model.available && (model.capabilities || []).includes("text_to_music"))
        .map((model) => ({
          id: model.id,
          label: `${model.id}${model.model_version ? ` · ${model.model_version}` : ""}`,
          capabilities: model.capabilities || [],
          maxBatch: Number(model.max_batch_size) || 1,
        })),
    [capabilities]
  );
  const musicAvailable = musicModels.length > 0;
  const selectedModel = useMemo(
    () => musicModels.find((model) => model.id === form.model) || musicModels[0] || null,
    [form.model, musicModels]
  );
  const modes = useMemo(() => availableModes(selectedModel?.capabilities), [selectedModel]);

  // Keep the form pointed at a model and a mode that actually exist right now.
  useEffect(() => {
    if (!selectedModel) return;
    setForm((current) => {
      const nextModel = current.model === selectedModel.id ? current.model : selectedModel.id;
      const nextMode = modes.includes(current.mode) ? current.mode : modes[0] || "create";
      const ceiling = Math.max(1, selectedModel.maxBatch);
      const nextBatch = Math.min(current.batchSize, ceiling);
      if (nextModel === current.model && nextMode === current.mode && nextBatch === current.batchSize) {
        return current;
      }
      return { ...current, model: nextModel, mode: nextMode, batchSize: nextBatch };
    });
  }, [modes, selectedModel]);

  const blocker = musicAvailable
    ? musicFormBlocker(form, Boolean(source))
    : "Music creation is offline.";

  const publicationByJobId = useMemo(() => {
    return new Map(
      publications
        .filter((publication) => publication.job_id)
        .map((publication) => [publication.job_id!, publication])
    );
  }, [publications]);

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

  async function uploadSource(file: File) {
    setUploading(true);
    setError("");
    try {
      const asset = await uploadMusicAsset(file, accessKey);
      setSource({ assetId: asset.id, filename: asset.filename || file.name });
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocker || !selectedModel) return;
    setError("");
    setSubmitting(true);
    const optimisticId = `pending-${Date.now()}`;
    const optimistic: MusicJob = {
      id: optimisticId,
      type: "text_to_music",
      status: "queued",
      stage: "queued",
      progress: 0,
      model: selectedModel.id,
      wallet: activeWallet || undefined,
      created_at: Date.now() / 1000,
      resolved_spec: {
        mode: form.mode,
        parameters: {
          mode: form.mode,
          prompt: form.prompt,
          style: form.style,
          duration: form.duration,
          instrumental: form.instrumental,
          bpm: form.bpm ? Number(form.bpm) : null,
          batch_size: form.batchSize,
          track_name: form.trackName,
        },
      },
      artifacts: [],
    };
    setJobs((current) => mergeJobs(current, [optimistic]));
    try {
      const created = await createMusicJob(
        musicJobRequest(form, {
          audioAssetId: source?.assetId,
          wallet: activeWallet || undefined,
        }),
        accessKey
      );
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

  function beginPublish(job: MusicJob) {
    setPublishJob(job);
    setPublishTitle(musicJobTitle(job));
    setPublishTags(jobStyle(job));
    setPublishProgress("");
    setError("");
  }

  async function submitPublish(event: React.FormEvent) {
    event.preventDefault();
    if (!publishJob) return;
    let signerWallet = activeWallet;
    if (!signerWallet) {
      signerWallet = await wallet.connect().catch((reason) => {
        setError(friendlyError(reason));
        return null;
      });
    }
    if (!signerWallet) return;
    setPublishing(true);
    setPublishProgress("Preparing signature...");
    try {
      const publication = await publishMusicJob(
        {
          wallet: signerWallet,
          job_id: publishJob.id,
          title: publishTitle,
          style: publishTags,
          tags: publishTags.split(",").map((tag) => tag.trim()).filter(Boolean),
        },
        {
          onProgress: (step) => {
            if (step === "requesting_nonce") setPublishProgress("Preparing signature...");
            else if (step === "awaiting_signature") setPublishProgress("Confirm in wallet...");
            else if (step === "submitting_publication") setPublishProgress("Publishing...");
          },
        }
      );
      setPublications((current) => [
        publication,
        ...current.filter((item) => item.id !== publication.id && item.job_id !== publication.job_id),
      ]);
      setPublishJob(null);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setPublishing(false);
      setPublishProgress("");
    }
  }

  async function unpublish(publication: MusicPublication) {
    if (!activeWallet) return;
    setError("");
    try {
      await unpublishMusicPublication(publication.id, activeWallet);
      setPublications((current) => current.filter((item) => item.id !== publication.id));
    } catch (reason) {
      setError(friendlyError(reason));
    }
  }

  if (!unlocked) {
    return (
      <>
        <Head><title>Music Studio | HavnAI</title></Head>
        <SiteHeader />
        <StudioAccessGate kind="music" accessKey={accessKey} onChange={setAccessKey} onSubmit={event => { event.preventDefault(); void connect(accessKey); }} checking={checkingAccess} error={error} />
      </>
    );
  }

  return (
    <>
      <Head><title>Music Studio | HavnAI</title><meta name="description" content="Create original music on the HavnAI network." /></Head>
      <SiteHeader />
      <main className="music-studio-page studio-workspace-music">
        <header className="music-studio-heading">
          <div><span><Music2 size={14} aria-hidden="true" /> Music Studio</span><h1>Make a little noise.</h1><p>A feeling, a scene, a sound. Start with what moves you.</p></div>
          <div className="music-runtime-row">
            <span className={musicAvailable ? "is-online" : ""}>{musicAvailable ? "Music ready" : "Music unavailable"}</span>
            <button type="button" title="Leave studio" aria-label="Leave studio" onClick={() => { window.sessionStorage.removeItem(STUDIO_KEY); setAccessKey(""); setUnlocked(false); setCapabilities(null); setError(""); }}><LogOut size={18} /></button>
          </div>
        </header>

        {!musicAvailable && (
          <div className="music-offline" role="status"><WifiOff size={20} /><div><strong>Music creation is offline</strong><span>Your settings are saved. Try again when music creation is back online.</span></div></div>
        )}
        {error && <div className="music-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button></div>}

        <div className="studio-music-layout">
        <MusicComposer
          form={form}
          modes={modes}
          models={musicModels}
          source={source}
          uploading={uploading}
          submitting={submitting}
          blocker={blocker}
          maxBatch={selectedModel?.maxBatch || 1}
          onChange={update}
          onApplyStarter={(prompt, style) => setForm((current) => ({ ...current, prompt, style }))}
          onUpload={(file) => void uploadSource(file)}
          onClearSource={() => setSource(null)}
          onSubmit={submit}
        />

        <section className="music-results" aria-live="polite">
          <div className="music-results-heading"><div><span>Your studio</span><h2>Recent songs <span className="studio-song-count">{jobs.length}</span></h2></div><Link href="/music/library">Music library <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
          {connectedWallet && jobs.length > 0 && <button type="button" className="studio-publishing-status" disabled={loadingPublications} onClick={() => void loadPublishingStatus()}>{loadingPublications ? "Checking publishing status..." : "Check publishing status (wallet signature)"}</button>}
          {jobs.length === 0 ? (
            <div className="music-empty studio-music-empty"><div className="studio-record" aria-hidden="true"><Image src="/music-default-cover.png" alt="" fill sizes="200px" /></div><strong>There&rsquo;s a song in that idea.</strong><span>Your creations will appear here, ready to play, download, or publish.</span><Link href="/discover">Find inspiration in Discover <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
          ) : (
            <div className="music-song-list">
              {jobs.map((job) => {
                const takes = musicTakes(job);
                const audio = takes[0]?.url || musicMediaUrl(job.artifacts.find((artifact) => artifact.kind === "audio")?.url);
                const title = musicJobTitle(job);
                const style = jobStyle(job);
                const songDuration = jobDuration(job);
                const playing = currentTrack?.id === job.id && isPlaying;
                const isCurrent = currentTrack?.id === job.id;
                const active = !FINAL_MUSIC_STATES.has(job.status);
                const jobError = musicJobError(job);
                const publication = publicationByJobId.get(job.id);
                const mode = jobMode(job);
                const track = job.resolved_spec?.parameters?.track_name;
                const canPublish = Boolean(audio && !active && activeWallet && job.wallet?.toLowerCase() === activeWallet.toLowerCase());
                const progress = isCurrent && duration > 0 ? currentTime / duration : 0;
                return (
                  <article className={`music-song ${active ? "is-generating" : ""}`} key={job.id}>
                    <div className="music-cover">
                      <Image src="/music-default-cover.png" alt="" fill sizes="(max-width: 640px) 88px, 112px" />
                      {audio ? (
                        <button type="button" aria-label={playing ? `Pause ${title}` : `Play ${title}`} onClick={() => playing ? toggle() : playTrack({ id: job.id, title, style, audioUrl: audio, artworkUrl: "/music-default-cover.png", duration: songDuration })}>
                          {playing ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}
                        </button>
                      ) : active ? <span className="music-cover-pulse" /> : null}
                    </div>
                    <div className="music-song-body">
                      <div className="music-song-title">
                        <div>
                          <strong>{title}</strong>
                          <span>{style}</span>
                        </div>
                        <span className={`music-song-state state-${job.status}`}>{publication ? "Published" : musicStageLabel(job)}</span>
                      </div>
                      {active && <div className="music-job-progress"><span style={{ width: `${Math.max(8, Math.min(99, job.progress || 8))}%` }} /></div>}
                      {audio && !active && (
                        <MusicWaveform
                          audioUrl={audio}
                          progress={progress}
                          height={44}
                          label={`Waveform for ${title}`}
                          onSeek={isCurrent && duration > 0 ? (position) => seek(position * duration) : undefined}
                        />
                      )}
                      {jobError && <p className="music-song-error">{jobError}</p>}
                      <div className="music-song-meta">
                        {mode && mode !== "create" && <span className="music-song-mode">{MUSIC_MODE_LABELS[mode].title}</span>}
                        {track && <span>{trackLabel(String(track))}</span>}
                        <span>{formatMusicDuration(songDuration)}</span>
                        {job.resolved_spec?.parameters?.bpm && <span>{job.resolved_spec.parameters.bpm} BPM</span>}
                        {job.resolved_spec?.parameters?.key && <span>{job.resolved_spec.parameters.key}</span>}
                        {job.resolved_spec?.parameters?.instrumental && <span>Instrumental</span>}
                      </div>
                      {takes.length > 1 && (
                        <div className="music-takes" role="group" aria-label={`Takes for ${title}`}>
                          <span>{takes.length} takes</span>
                          {takes.map((take) => {
                            const takeId = `${job.id}::${take.index}`;
                            const takePlaying = currentTrack?.id === takeId && isPlaying;
                            return (
                              <button
                                key={takeId}
                                type="button"
                                className={currentTrack?.id === takeId ? "is-active" : ""}
                                onClick={() =>
                                  takePlaying
                                    ? toggle()
                                    : playTrack({
                                        id: takeId,
                                        title: `${title} — take ${take.index}`,
                                        style,
                                        audioUrl: take.url,
                                        artworkUrl: "/music-default-cover.png",
                                        duration: songDuration,
                                      })
                                }
                              >
                                {takePlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                                {take.index}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="music-song-actions">
                      {active && !job.id.startsWith("pending-") && <button type="button" onClick={() => void cancel(job)} aria-label={`Cancel ${title}`} title="Cancel"><X size={18} /></button>}
                      {audio && <a href={audio} download aria-label={`Download ${title}`} title="Download"><Download size={18} /></a>}
                      <div className={`music-song-menu${openMenu === job.id ? " is-open" : ""}`}>
                        <button
                          type="button"
                          aria-label={`More actions for ${title}`}
                          aria-expanded={openMenu === job.id}
                          aria-haspopup="menu"
                          title="More actions"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenu(openMenu === job.id ? null : job.id);
                          }}
                        >
                          <MoreHorizontal size={19} />
                        </button>
                        {openMenu === job.id && (
                          <div role="menu" onClick={(event) => event.stopPropagation()}>
                            {audio ? <a href={audio} target="_blank" rel="noreferrer" role="menuitem">Open audio</a> : <span>{musicStageLabel(job)}</span>}
                            {audio && !active && MUSIC_MODES_NEEDING_SOURCE.size > 0 && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setError("Download this take, then add it as the source track to remix or repaint it.");
                                }}
                              >
                                Use as source
                              </button>
                            )}
                            {publication ? (
                              <>
                                <Link href={`/discover?track=${encodeURIComponent(publication.id)}`} role="menuitem">View in Discover</Link>
                                <button type="button" role="menuitem" onClick={() => void unpublish(publication)}>Unpublish</button>
                              </>
                            ) : canPublish ? (
                              <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); beginPublish(job); }}>Publish</button>
                            ) : audio && !active ? (
                              <span>{activeWallet ? "Connect the creator wallet to publish" : "Connect wallet to publish"}</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </div>
        {publishJob && (
          <div className="music-publish-backdrop" role="presentation" onMouseDown={() => !publishing && setPublishJob(null)}>
            <form className="music-publish-modal" onSubmit={submitPublish} onMouseDown={(event) => event.stopPropagation()}>
              <div className="music-publish-cover">
                <Image src="/music-default-cover.png" alt="" fill sizes="180px" />
              </div>
              <div className="music-publish-fields">
                <div className="music-publish-heading">
                  <span>Publish to Discover</span>
                  <button type="button" aria-label="Close publish dialog" title="Close" onClick={() => setPublishJob(null)} disabled={publishing}><X size={18} /></button>
                </div>
                <label>
                  <span>Title</span>
                  <input value={publishTitle} maxLength={120} onChange={(event) => setPublishTitle(event.target.value)} required />
                </label>
                <label>
                  <span>Style and tags</span>
                  <input value={publishTags} maxLength={160} onChange={(event) => setPublishTags(event.target.value)} placeholder="Dream pop, cinematic, late night" />
                </label>
                <div className="music-publish-summary">
                  <span>{formatMusicDuration(jobDuration(publishJob))}</span>
                  {publishJob.resolved_spec?.parameters?.bpm && <span>{publishJob.resolved_spec.parameters.bpm} BPM</span>}
                  {publishJob.resolved_spec?.parameters?.key && <span>{publishJob.resolved_spec.parameters.key}</span>}
                  {publishJob.resolved_spec?.parameters?.instrumental && <span>Instrumental</span>}
                </div>
                {publishProgress && <p className="music-publish-progress">{publishProgress}</p>}
                <button className="music-generate" type="submit" disabled={publishing || !publishTitle.trim()}>
                  {publishing ? "Publishing..." : activeWallet ? "Publish" : "Connect and publish"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
