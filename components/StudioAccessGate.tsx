import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, AudioLines, Film, UserRound } from "lucide-react";

export function StudioAccessGate({ kind, error = "" }: {
  kind: "music" | "video";
  error?: string;
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
        <div className="studio-entry-form">
          <span className="studio-entry-eyebrow"><UserRound size={14} aria-hidden="true" /> Account studio</span>
          <h1>Your {music ? "sound" : "scene"} starts here.</h1>
          <p>{music ? "Sign in to describe a mood, write a lyric, or start with a rhythm. Your songs stay with your account." : "Sign in to turn a still image into a short clip. Your renders stay with your account."}</p>
          <p id="studio-access-help" className="studio-entry-help">No invite code or operator key is needed for launch access.</p>
          {error && <p className="studio-entry-error" role="alert">{error}</p>}
          <Link className="studio-entry-primary" href="/sign-in">Sign in<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link href="/sign-up">Create account <ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link href={music ? "/discover" : "/create"}>{music ? "Explore community music" : "Open the image & video creator"} <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
