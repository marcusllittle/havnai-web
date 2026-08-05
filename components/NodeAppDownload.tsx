import React, { useEffect, useMemo, useState } from "react";

/**
 * Download panel for the HavnAI Node desktop app.
 *
 * Installers are published as GitHub release assets on the public havnai-core
 * repo, so this reads the latest release directly and offers the file matching
 * the visitor's system. Everything degrades: if no release exists yet, or the
 * API is unreachable, the panel says so and points at the terminal installer
 * rather than showing a dead button.
 */

const RELEASES_API =
  "https://api.github.com/repos/marcusllittle/havnai-core/releases/latest";
const RELEASES_PAGE = "https://github.com/marcusllittle/havnai-core/releases";

export type Platform = "windows" | "macos-arm" | "macos-intel" | "linux-deb" | "linux-appimage";

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
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

/** Best guess at the visitor's system, used only to pick the primary button. */
export function detectPlatform(userAgent: string): Platform | null {
  const ua = userAgent.toLowerCase();
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

type LoadState = "loading" | "ready" | "unavailable";

export const NodeAppDownload: React.FC = () => {
  const [state, setState] = useState<LoadState>("loading");
  const [options, setOptions] = useState<DownloadOption[]>([]);
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((release) => {
        if (cancelled) return;
        const parsed = toDownloadOptions(release?.assets ?? []);
        if (!parsed.length) {
          setState("unavailable");
          return;
        }
        setOptions(parsed);
        setVersion(String(release?.tag_name ?? "").replace(/^desktop-/, ""));
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const detected = useMemo(
    () => (typeof navigator === "undefined" ? null : detectPlatform(navigator.userAgent)),
    []
  );

  const primary = useMemo(
    () => options.find((option) => option.platform === detected) ?? options[0] ?? null,
    [options, detected]
  );
  const others = useMemo(
    () => options.filter((option) => option.platform !== primary?.platform),
    [options, primary]
  );

  return (
    <div className="chart-section" id="download-app">
      <div className="chart-header">
        <h2 className="chart-title">Download the node app</h2>
      </div>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.7 }}>
        The simplest way to run a node. Open the app, paste your wallet address, and click
        Install — it sets up everything, downloads the models, and tells you when your machine
        is ready to serve jobs. No terminal required.
      </p>

      {state === "loading" && (
        <p style={{ color: "var(--text-muted)" }}>Checking for the latest version…</p>
      )}

      {state === "unavailable" && (
        <div style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
          <p style={{ marginBottom: "0.75rem" }}>
            No desktop build has been published yet. You can still set up a node with the
            one-line installer below, which does exactly the same thing.
          </p>
          <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            Check the releases page →
          </a>
        </div>
      )}

      {state === "ready" && primary && (
        <>
          <a
            className="jh-btn jh-btn-primary"
            href={primary.url}
            style={{ display: "inline-block", marginBottom: "0.85rem" }}
          >
            Download for {primary.label}
            {primary.size ? ` (${humanSize(primary.size)})` : ""}
          </a>

          {others.length > 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.9 }}>
              Other systems:{" "}
              {others.map((option, index) => (
                <span key={option.platform}>
                  {index > 0 ? " · " : ""}
                  <a href={option.url} style={{ color: "var(--accent)" }}>
                    {option.label}
                  </a>
                </span>
              ))}
            </div>
          )}

          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "1rem", lineHeight: 1.6 }}>
            {version ? `Version ${version}. ` : ""}
            These builds are not yet signed, so your system will warn you the first time you open
            the app. On macOS, right-click it and choose <strong>Open</strong>. On Windows, click{" "}
            <strong>More info</strong> then <strong>Run anyway</strong>.
          </p>
        </>
      )}
    </div>
  );
};

export default NodeAppDownload;
