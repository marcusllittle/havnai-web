export async function downloadAsset(url: string, filename?: string): Promise<void> {
  if (typeof window === "undefined") return;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`download failed: ${res.status} ${text}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || url.split("/").pop() || "havnai-output";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
