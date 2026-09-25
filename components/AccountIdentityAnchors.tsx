import { useEffect, useRef, useState } from "react";
import type { AccountStudioAccess } from "../lib/musicStudioApi";
import { uploadStudioAsset } from "../lib/videoStudioApi";

type Anchor = { slug: string; display_name: string; asset_id: string };

export function AccountIdentityAnchors({ access, onUse }: { access: AccountStudioAccess; onUse: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const controller = useRef(new AbortController());
  const pending = useRef(false);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  useEffect(() => {
    const current = new AbortController(); controller.current = current;
    const abort = () => current.abort();
    access.signal.addEventListener("abort", abort, { once: true });
    if (access.signal.aborted) abort();
    return () => { current.abort(); access.signal.removeEventListener("abort", abort); };
  }, [access]);
  useEffect(() => {
    if (!open) return;
    const current = new AbortController();
    setError("");
    void access.request<{ anchors: Anchor[] }>("/v2/account/identity-anchors", { signal: current.signal, cache: "no-store" })
      .then(data => { if (!current.signal.aborted) setAnchors(data.anchors); })
      .catch(reason => { if (!current.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load saved faces."); });
    return () => current.abort();
  }, [open, access, revision]);
  async function mutate(remove?: string) {
    if (pending.current) return;
    const signal = controller.current.signal;
    pending.current = true; setBusy(true); setError("");
    try {
      if (remove) {
        await access.request(`/v2/account/identity-anchors/${encodeURIComponent(remove)}`, { method: "DELETE", signal });
      } else {
        if (!file || !name.trim() || !/^[a-z0-9_-]{1,64}$/.test(slug)) throw new Error("Choose a face image, a name, and a tag using lowercase letters, numbers, hyphens, or underscores.");
        if (uploaded.current?.file !== file) {
          const asset = await uploadStudioAsset(file, "image", { request: access.request, signal });
          signal.throwIfAborted();
          uploaded.current = { file, id: asset.id };
        }
        await access.request(`/v2/account/identity-anchors/${encodeURIComponent(slug)}`, { method: "PUT", signal,
          body: JSON.stringify({ display_name: name.trim(), asset_id: uploaded.current!.id }) });
      }
      signal.throwIfAborted();
      setRevision(value => value + 1);
    } catch (reason) {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : "Could not update saved faces.");
    } finally { pending.current = false; if (!signal.aborted) setBusy(false); }
  }
  return <section className="studio-account">
    <button type="button" className="generator-mini-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>Saved faces</button>
    {open && <>
      <p className="generator-help">Save a face to reuse in SDXL images. Select Use face to add its identity anchor tag to your prompt. Saved faces are private to your account.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="generator-mini-button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh saved faces</button>
      <ul>{anchors.map(anchor => <li key={anchor.slug}>
        {anchor.display_name} <code>{anchor.slug}</code>{" "}
        <button type="button" className="generator-mini-button" disabled={busy} onClick={() => onUse(anchor.slug)}>Use {anchor.display_name}</button>{" "}
        <button type="button" className="generator-mini-button" disabled={busy} onClick={() => void mutate(anchor.slug)}>Remove {anchor.display_name}</button>
      </li>)}</ul>
      <label className="generator-label" htmlFor="anchor-name">Face name</label>
      <input id="anchor-name" className="generator-input" value={name} maxLength={100} disabled={busy} onChange={event => setName(event.target.value)} />
      <label className="generator-label" htmlFor="anchor-slug">Prompt tag</label>
      <input id="anchor-slug" className="generator-input" value={slug} maxLength={64} placeholder="my-character" disabled={busy} onChange={event => setSlug(event.target.value.toLowerCase())} />
      <label className="generator-label" htmlFor="anchor-file">Face image</label>
      <input id="anchor-file" className="generator-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} />
      <button type="button" className="generator-mini-button" disabled={busy || !file || !name.trim() || !slug} onClick={() => void mutate()}>{busy ? "Saving changes..." : "Save face"}</button>
      <p className="generator-help">Removing a saved face leaves existing creations intact.</p>
    </>}
  </section>;
}
