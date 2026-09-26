import React, { useEffect, useMemo, useState } from "react";

/**
 * Download panel for the HavnAI Node desktop app.
 *
 * Installers are published as GitHub release assets on the public havnai-core
 * repo, so this reads the newest desktop release directly and offers the file
 * matching the visitor's system. Everything degrades: if no release exists yet, or the
 * API is unreachable, the panel says so and points at the terminal installer
 * rather than showing a dead button.
 */

const RELEASES_API =
  "https://api.github.com/repos/marcusllittle/havnai-core/releases?per_page=30";
const RELEASES_PAGE = "https://github.com/marcusllittle/havnai-core/releases";

export type Platform = "windows" | "macos-arm" | "macos-intel" | "linux-deb" | "linux-appimage";

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

export type Release = {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
};

export type DownloadOption = {
  platform: Platform;
  label: string;
  url: string;
  size: number;
};

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  "macos-arm": "macOS (Apple Silicon)",
  "macos-intel": "macOS (Intel)",
  "linux-deb": "Linux (Ubuntu / Debian)",
  "linux-appimage": "Linux (AppImage)",
};

/** Classify a release asset by filename. Returns null for checksums etc. */
export function classifyAsset(name: string): Platform | null {
  const lower = name.toLowerCase();
  if (lower.endsWith("-setup.exe") || lower.endsWith(".msi")) return "windows";
  if (lower.endsWith(".dmg")) {
    // Tauri tags the arch in the filename; treat anything non-Intel as arm so a
    // future naming change fails toward the more common Mac rather than hiding.
    return lower.includes("x64") || lower.includes("x86_64") ? "macos-intel" : "macos-arm";
  }
  if (lower.endsWith(".deb")) return "linux-deb";
  if (lower.endsWith(".appimage")) return "linux-appimage";
  return null;
}

export function toDownloadOptions(assets: ReleaseAsset[]): DownloadOption[] {
  const seen = new Set<Platform>();
  const options: DownloadOption[] = [];
  for (const asset of assets) {
    const platform = classifyAsset(asset.name);
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    options.push({
      platform,
      label: PLATFORM_LABELS[platform],
      url: asset.browser_download_url,
      size: asset.size,
    });
  }
  const order: Platform[] = ["windows", "macos-arm", "macos-intel", "linux-deb", "linux-appimage"];
  return options.sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
}

/**
 * The newest published desktop release that actually carries installers.
 *
 * havnai-core publishes other releases too, and GitHub's "latest" is whichever
 * came last - so reading it showed an unrelated release with no files and told
 * visitors there were no desktop installers. GitHub lists newest first.
 */
export function pickDesktopRelease(releases: Release[]): Release | null {
  return releases.find(release =>
    !release.draft
    && !release.prerelease
    && String(release.tag_name ?? "").startsWith("desktop-v")
    && toDownloadOptions(release.assets ?? []).length > 0,
  ) ?? null;
}

/** Best guess at the visitor's system, used only to pick the primary button. */
export function detectPlatform(userAgent: string): Platform | null {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod|android/.test(ua)) return null;
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) {
    // Browsers still report Intel on Apple Silicon, so this is a coin flip we
    // resolve toward current hardware; both options stay visible either way.
    return "macos-arm";
  }
  if (ua.includes("linux") && !ua.includes("android")) return "linux-deb";
  return null;
}

function humanSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

type LoadState = "loading" | "ready" | "empty" | "unavailable";

export const NodeAppDownload: React.FC = () => {
  const [state, setState] = useState<LoadState>("loading");
  const [options, setOptions] = useState<DownloadOption[]>([]);
  const [version, setVersion] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setState("loading");
    fetch(RELEASES_API, { signal: controller.signal, headers: { Accept: "application/vnd.github+json" } })
      .then(async response => {
        if (response.status === 404) return [];
        if (!response.ok) throw new Error("Release lookup failed");
        return response.json();
      }).then(releases => {
        if (cancelled) return;
        const release = pickDesktopRelease(Array.isArray(releases) ? releases : []);
        const parsed = toDownloadOptions(release?.assets ?? []);
        setOptions(parsed);
        setVersion(String(release?.tag_name ?? "").replace(/^desktop-v?/, ""));
        setState(parsed.length ? "ready" : "empty");
      }).catch(() => { if (!cancelled) setState("unavailable"); })
      .finally(() => window.clearTimeout(timer));
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [refreshKey]);
  const detected = useMemo(() => typeof navigator === "undefined" ? null : detectPlatform(navigator.userAgent), []);
  const sortedOptions = useMemo(() => [...options].sort((a, b) => Number(b.platform === detected) - Number(a.platform === detected)), [options, detected]);

  return <section className="network-panel node-download-panel" id="download-app" aria-labelledby="download-title">
    <span className="network-eyebrow">Desktop setup</span><h2 id="download-title">Your node, in one app.</h2>
    <p>Set up your wallet, download models, and check what your machine can serve from one control panel.</p>
    {state === "loading" && <p role="status" className="network-empty">Checking desktop releases...</p>}
    {state === "unavailable" && <div className="network-notice" role="alert"><p>Desktop downloads could not be loaded. Try again or check the releases page.</p><button className="network-secondary" onClick={() => setRefreshKey(value => value + 1)}>Retry downloads</button></div>}
    {state === "empty" && <p className="network-empty">No desktop installers have been published yet. You can use the terminal installer.</p>}
    {state === "ready" && <>
      <div className="setup-downloads">{sortedOptions.map(option => <a key={option.platform} className={option.platform === detected ? "is-recommended" : undefined} href={option.url}><span>Download for {option.label}</span><small>{humanSize(option.size)}{option.platform === detected ? " / Your system" : ""}</small></a>)}</div>
      {version && <p className="network-caption">Version {version}</p>}
      <details className="network-disclosure"><summary>Opening the desktop app</summary><p>These builds are not yet signed. On macOS, right-click the app and choose Open. On Windows, choose More info, then Run anyway, if you trust the downloaded release.</p></details>
    </>}
    <p className="network-caption">Windows operators: the app installs the node natively. Install Python 3.12 from python.org first, with Add python.exe to PATH checked.</p>
    <a className="setup-release-link" href={RELEASES_PAGE} target="_blank" rel="noreferrer">View releases on GitHub</a>
  </section>;
};
export default NodeAppDownload;
