import type { MusicJob } from "./musicStudioApi";

export const FINAL_MUSIC_STATES = new Set(["succeeded", "failed", "cancelled", "expired"]);

export function musicStageLabel(job?: Pick<MusicJob, "status" | "stage"> | null): string {
  const value = String(job?.stage || job?.status || "queued").toLowerCase();
  if (job?.status === "succeeded") return "Ready";
  if (job?.status === "failed" || job?.status === "expired") return "Could not create";
  if (job?.status === "cancelled" || value.includes("cancel")) return "Cancelled";
  if (value.includes("upload") || value.includes("finish")) return "Finishing";
  if (value.includes("creat") || value.includes("generat") || value === "running") return "Creating";
  return "Preparing";
}

export function musicJobTitle(job: MusicJob): string {
  const prompt = String(
    (job.resolved_spec as { prompts?: { original?: string } })?.prompts?.original
    || job.resolved_spec?.parameters?.prompt
    || ""
  ).trim();
  const source = prompt || `New track`;
  const words = source.replace(/[.?!,;:]+/g, " ").split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return "New track";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function musicJobError(job: MusicJob): string | null {
  if (job.status === "succeeded" && !job.artifacts.some((item) => item.kind === "audio" && item.url)) {
    return "The song finished, but its audio file is unavailable.";
  }
  if (job.status !== "failed" && job.status !== "expired") return null;
  if (job.error_code === "authentication") return "The music service could not authenticate.";
  if (job.error_code === "timeout") return "The song took too long to finish. Try a shorter duration.";
  if (job.error_code === "storage" || job.error_code === "upload") return "The song was created but could not be saved.";
  return "This song could not be created. Try again or adjust the description.";
}

export function formatMusicDuration(value?: number | null): string {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
