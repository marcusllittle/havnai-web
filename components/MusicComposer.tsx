import React, { useRef } from "react";
import { AudioLines, Music2, Paperclip, Scissors, SlidersHorizontal, Sparkles, Wand2, X } from "lucide-react";
import {
  MUSIC_AUDIO_FORMATS,
  MUSIC_BATCH_SIZES,
  MUSIC_DURATIONS,
  MUSIC_MODES_NEEDING_SOURCE,
  MUSIC_MODES_NEEDING_TRACK,
  MUSIC_MODE_LABELS,
  MUSIC_REPAINT_MODES,
  MUSIC_TRACK_NAMES,
  trackLabel,
  type MusicFormState,
  type MusicMode,
  type MusicTrackName,
} from "../lib/musicStudioState";
import { formatMusicDuration } from "../lib/musicJobPresentation";

const STRUCTURE_TAGS = ["[Intro]", "[Verse]", "[Pre-Chorus]", "[Chorus]", "[Bridge]", "[Outro]"];

const STARTERS = [
  {
    title: "Midnight R&B",
    style: "R&B, soulful, late night",
    prompt: "A warm late-night R&B track with brushed drums, deep bass, intimate vocals, and a hopeful chorus.",
  },
  {
    title: "Indie lift",
    style: "Indie pop, bright, uplifting",
    prompt: "An uplifting indie pop song with jangly guitars, a driving beat, and a chorus that feels like the first day of summer.",
  },
  {
    title: "Ambient focus",
    style: "Ambient, minimal, atmospheric",
    prompt: "A gentle instrumental soundscape with soft piano, slow evolving synths, and plenty of space to think.",
  },
];

export interface SourceClip {
  assetId: string;
  filename: string;
}

export interface MusicComposerProps {
  form: MusicFormState;
  modes: MusicMode[];
  models: Array<{ id: string; label: string; capabilities: string[]; maxBatch: number }>;
  source: SourceClip | null;
  uploading: boolean;
  submitting: boolean;
  blocker: string | null;
  maxBatch: number;
  onChange: <K extends keyof MusicFormState>(key: K, value: MusicFormState[K]) => void;
  onApplyStarter: (prompt: string, style: string) => void;
  onUpload: (file: File) => void;
  onClearSource: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function MusicComposer({
  form,
  modes,
  models,
  source,
  uploading,
  submitting,
  blocker,
  maxBatch,
  onChange,
  onApplyStarter,
  onUpload,
  onClearSource,
  onSubmit,
}: MusicComposerProps) {
  const lyricsRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const needsSource = MUSIC_MODES_NEEDING_SOURCE.has(form.mode);
  const needsTrack = MUSIC_MODES_NEEDING_TRACK.has(form.mode);
  const describesSong = form.mode === "create" || form.mode === "remix" || form.mode === "repaint";
  const wantsLyrics = describesSong && !form.instrumental;
  const batchOptions = MUSIC_BATCH_SIZES.filter((size) => size <= Math.max(1, maxBatch));

  function insertStructureTag(tag: string) {
    const element = lyricsRef.current;
    const current = form.lyrics;
    if (!element) {
      onChange("lyrics", current ? `${current}\n${tag}\n` : `${tag}\n`);
      return;
    }
    const start = element.selectionStart ?? current.length;
    const end = element.selectionEnd ?? start;
    const prefix = current.slice(0, start);
    const suffix = current.slice(end);
    const needsLeadingBreak = prefix && !prefix.endsWith("\n");
    const snippet = `${needsLeadingBreak ? "\n" : ""}${tag}\n`;
    const next = `${prefix}${snippet}${suffix}`;
    onChange("lyrics", next);
    window.requestAnimationFrame(() => {
      const caret = prefix.length + snippet.length;
      element.focus();
      element.setSelectionRange(caret, caret);
    });
  }

  function toggleTrackClass(track: MusicTrackName) {
    const selected = form.trackClasses.includes(track)
      ? form.trackClasses.filter((item) => item !== track)
      : [...form.trackClasses, track];
    onChange("trackClasses", selected);
  }

  return (
    <form className="music-composer" onSubmit={onSubmit}>
      {modes.length > 1 && (
        <div className="music-mode-tabs" role="tablist" aria-label="Studio mode">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={form.mode === mode}
              className={form.mode === mode ? "is-active" : ""}
              onClick={() => onChange("mode", mode)}
            >
              {MUSIC_MODE_LABELS[mode].title}
            </button>
          ))}
        </div>
      )}
      <p className="music-mode-blurb">{MUSIC_MODE_LABELS[form.mode].blurb}</p>

      {needsSource && (
        <div className={`music-source${source ? " has-clip" : ""}`}>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
          {source ? (
            <>
              <AudioLines size={18} aria-hidden="true" />
              <div>
                <strong>{source.filename}</strong>
                <span>Working from this track</span>
              </div>
              <button type="button" onClick={onClearSource} aria-label="Remove source track" title="Remove">
                <X size={17} />
              </button>
            </>
          ) : (
            <button type="button" className="music-source-pick" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Paperclip size={17} aria-hidden="true" />
              {uploading ? "Uploading..." : "Add the track you want to work from"}
            </button>
          )}
        </div>
      )}

      {describesSong && (
        <>
          <label className="music-prompt-field">
            <span>{form.mode === "create" ? "Song description" : "What should change?"}</span>
            <textarea
              value={form.prompt}
              onChange={(event) => onChange("prompt", event.target.value)}
              maxLength={4000}
              placeholder={
                form.mode === "create"
                  ? "A hazy late-night R&B track with brushed drums, warm bass, and a hopeful chorus..."
                  : "Turn it into a slow bossa nova with nylon guitar and brushed drums..."
              }
            />
          </label>
          {form.mode === "create" && (
            <div className="studio-music-starters" role="group" aria-label="Song ideas">
              <span>Try a direction</span>
              {STARTERS.map((idea) => (
                <button type="button" key={idea.title} onClick={() => onApplyStarter(idea.prompt, idea.style)}>
                  {idea.title}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {needsTrack && (
        <label className="music-track-field">
          <span>{form.mode === "extract" ? "Track to pull out" : "Track to add"}</span>
          <select value={form.trackName} onChange={(event) => onChange("trackName", event.target.value as MusicTrackName)}>
            {MUSIC_TRACK_NAMES.map((track) => (
              <option key={track} value={track}>
                {trackLabel(track)}
              </option>
            ))}
          </select>
        </label>
      )}

      {form.mode === "arrange" && (
        <div className="music-track-picker" role="group" aria-label="Parts to add">
          <span>Parts to add</span>
          <div>
            {MUSIC_TRACK_NAMES.map((track) => (
              <button
                key={track}
                type="button"
                aria-pressed={form.trackClasses.includes(track)}
                className={form.trackClasses.includes(track) ? "is-on" : ""}
                onClick={() => toggleTrackClass(track)}
              >
                {trackLabel(track)}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.mode === "remix" && (
        <label className="music-slider-field">
          <span>
            How close to the original?
            <strong>{Math.round(form.coverStrength * 100)}%</strong>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(form.coverStrength * 100)}
            onChange={(event) => onChange("coverStrength", Number(event.target.value) / 100)}
          />
          <small>Lower reinvents it. Higher keeps the arrangement intact.</small>
        </label>
      )}

      {form.mode === "repaint" && (
        <div className="music-repaint-fields">
          <label>
            <span>From</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.repaintStart}
              onChange={(event) => onChange("repaintStart", event.target.value)}
              placeholder="0"
            />
            <small>seconds</small>
          </label>
          <label>
            <span>To</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.repaintEnd}
              onChange={(event) => onChange("repaintEnd", event.target.value)}
              placeholder="end"
            />
            <small>blank = to the end</small>
          </label>
          <label>
            <span>Strength</span>
            <select value={form.repaintMode} onChange={(event) => onChange("repaintMode", event.target.value)}>
              {MUSIC_REPAINT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="music-composer-grid">
        {describesSong && (
          <label>
            <span>Style</span>
            <input
              value={form.style}
              maxLength={500}
              onChange={(event) => onChange("style", event.target.value)}
              placeholder="Dream pop, soulful, cinematic"
            />
          </label>
        )}
        <label>
          <span>Length</span>
          <select value={form.duration} onChange={(event) => onChange("duration", Number(event.target.value))}>
            {MUSIC_DURATIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatMusicDuration(seconds)}
              </option>
            ))}
          </select>
        </label>
        {batchOptions.length > 1 && (
          <label>
            <span>Takes</span>
            <select value={form.batchSize} onChange={(event) => onChange("batchSize", Number(event.target.value))}>
              {batchOptions.map((size) => (
                <option key={size} value={size}>
                  {size === 1 ? "1 take" : `${size} takes`}
                </option>
              ))}
            </select>
          </label>
        )}
        {describesSong && (
          <label className="music-switch">
            <span>
              <strong>Instrumental</strong>
              <small>Create without vocals</small>
            </span>
            <input
              type="checkbox"
              checked={form.instrumental}
              onChange={(event) => onChange("instrumental", event.target.checked)}
            />
          </label>
        )}
      </div>

      {wantsLyrics && (
        <details className="music-lyrics" open={Boolean(form.lyrics)}>
          <summary>
            Lyrics <span>Optional</span>
          </summary>
          <div className="music-structure-tags" role="group" aria-label="Insert a song section">
            <Wand2 size={14} aria-hidden="true" />
            {STRUCTURE_TAGS.map((tag) => (
              <button type="button" key={tag} onClick={() => insertStructureTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">Lyrics</span>
            <textarea
              ref={lyricsRef}
              value={form.lyrics}
              maxLength={12000}
              onChange={(event) => onChange("lyrics", event.target.value)}
              placeholder={"[Verse]\nWrite your lyrics here..."}
            />
          </label>
        </details>
      )}

      <details className="music-advanced">
        <summary>
          <SlidersHorizontal size={17} /> Advanced settings
        </summary>
        <div>
          {models.length > 1 && (
            <label className="music-advanced-wide">
              <span>Model</span>
              <select value={form.model} onChange={(event) => onChange("model", event.target.value)}>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>BPM</span>
            <input
              type="number"
              min={30}
              max={300}
              value={form.bpm}
              onChange={(event) => onChange("bpm", event.target.value)}
              placeholder="Auto"
            />
          </label>
          <label>
            <span>Key</span>
            <input
              value={form.key}
              maxLength={64}
              onChange={(event) => onChange("key", event.target.value)}
              placeholder="Auto"
            />
          </label>
          <label>
            <span>Seed</span>
            <input
              type="number"
              min={0}
              max={2147483647}
              value={form.seed}
              onChange={(event) => onChange("seed", event.target.value)}
              placeholder="Random"
            />
          </label>
          <label>
            <span>Steps</span>
            <input
              type="number"
              min={1}
              max={200}
              value={form.inferenceSteps}
              onChange={(event) => onChange("inferenceSteps", event.target.value)}
              placeholder="Model default"
            />
          </label>
          <label>
            <span>Guidance</span>
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={form.guidanceScale}
              onChange={(event) => onChange("guidanceScale", event.target.value)}
              placeholder="Model default"
            />
          </label>
          <label>
            <span>Format</span>
            <select value={form.audioFormat} onChange={(event) => onChange("audioFormat", event.target.value)}>
              {MUSIC_AUDIO_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                  {format === "mp3" ? " (smallest)" : format === "flac" ? " (lossless)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <button className="music-generate" type="submit" disabled={submitting || Boolean(blocker)}>
        {form.mode === "extract" ? <Scissors size={19} /> : form.mode === "create" ? <Sparkles size={19} /> : <Music2 size={19} />}
        {submitting ? "Adding to studio..." : blocker || MUSIC_MODE_LABELS[form.mode].cta}
      </button>
    </form>
  );
}

export default MusicComposer;
