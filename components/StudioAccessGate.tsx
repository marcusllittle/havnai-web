import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, AudioLines, Film, KeyRound } from "lucide-react";

export function StudioAccessGate({ kind, accessKey, onChange, onSubmit, checking, error }: {
  kind: "music" | "video";
  accessKey: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  checking: boolean;
  error: string;
}) {
  const music = kind === "music";
  return (
    <main className={`studio-entry ${music ? "studio-tone-music" : "studio-tone-video"}`}>
      <section className="studio-entry-card">
        <div className="studio-entry-art">
          <Image src={music ? "/music-default-cover.png" : "/create/coastal-light.webp"} alt={music ? "" : "Morning light over a Mediterranean coast"} fill sizes="(max-width: 760px) 100vw, 560px" priority />
          <div className="studio-entry-art-copy">
            <span>{music ? <AudioLines size={16} aria-hidden="true" /> : <Film size={16} aria-hidden="true" />} HavnAI {music ? "Music" : "Video"}</span>
            <p>{music ? "Find a sound\nthat feels like you." : "A single frame.\nA whole new story."}</p>
            <small>{music ? "From an idea to an original song." : "AI-made inspiration · bring your own starting image."}</small>
          </div>
        </div>
        <form className="studio-entry-form" onSubmit={onSubmit}>
          <span className="studio-entry-eyebrow"><KeyRound size={14} aria-hidden="true" /> Studio access</span>
          <h1>Your {music ? "sound" : "scene"} starts here.</h1>
          <p>{music ? "Describe a mood, write a lyric, or start with a rhythm. Make it your own in Music Studio." : "Turn a still image into a short clip. Direct the movement, choose your frame, and bring the scene to life."}</p>
          <label htmlFor="studio-access-key">Studio access key</label>
          <input id="studio-access-key" type="password" autoComplete="current-password" value={accessKey} onChange={event => onChange(event.target.value)} required aria-describedby="studio-access-help" />
          <p id="studio-access-help" className="studio-entry-help">This studio currently requires an access key from its operator.</p>
          {error && <p className="studio-entry-error" role="alert">{error}</p>}
          <button type="submit" disabled={checking || !accessKey.trim()}>{checking ? "Opening studio…" : `Open ${music ? "Music" : "Video"} Studio`}<ArrowUpRight size={16} aria-hidden="true" /></button>
          <Link href={music ? "/discover" : "/create"}>{music ? "Explore community music" : "Open the image & video creator"} <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </form>
      </section>
    </main>
  );
}
