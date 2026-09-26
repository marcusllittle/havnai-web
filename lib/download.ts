export async function downloadAsset(url: string, filename?: string): Promise<void> {
  if (typeof window === "undefined") return;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`download failed: ${res.status} ${text}`);
  }
  const blob = await res.blob();
  const extensions: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "image/gif": "gif", "image/avif": "avif", "video/mp4": "mp4",
    "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav",
    "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/flac": "flac",
  };
  let downloadName = filename || new URL(url, window.location.href).pathname.split("/").pop() || "havnai-output";
  const extension = extensions[blob.type.toLowerCase().split(";", 1)[0].trim()];
  // Private media routes end in an artifact ID, not a filename. Give the saved
  // file its media extension so desktop apps can open it normally.
  if (!filename && extension && !/\.[a-z0-9]{1,5}$/i.test(downloadName)) downloadName += `.${extension}`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
