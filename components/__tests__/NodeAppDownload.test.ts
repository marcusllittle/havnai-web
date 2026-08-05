import { describe, expect, it } from "vitest";
import { classifyAsset, detectPlatform, toDownloadOptions } from "../NodeAppDownload";

// Filenames exactly as Tauri's bundler emits them, so a naming change upstream
// shows up here rather than as a download button that silently disappears.
const RELEASE_ASSETS = [
  { name: "HavnAI Node_0.1.0_x64-setup.exe", browser_download_url: "https://x/win", size: 8_000_000 },
  { name: "HavnAI Node_0.1.0_aarch64.dmg", browser_download_url: "https://x/mac-arm", size: 9_000_000 },
  { name: "HavnAI Node_0.1.0_x64.dmg", browser_download_url: "https://x/mac-intel", size: 9_500_000 },
  { name: "HavnAI Node_0.1.0_amd64.deb", browser_download_url: "https://x/deb", size: 1_400_000 },
  { name: "HavnAI Node_0.1.0_amd64.AppImage", browser_download_url: "https://x/appimage", size: 76_000_000 },
  { name: "SHA256SUMS.txt", browser_download_url: "https://x/sums", size: 400 },
];

describe("classifyAsset", () => {
  it("maps each installer to its platform", () => {
    expect(classifyAsset("HavnAI Node_0.1.0_x64-setup.exe")).toBe("windows");
    expect(classifyAsset("HavnAI Node_0.1.0_aarch64.dmg")).toBe("macos-arm");
    expect(classifyAsset("HavnAI Node_0.1.0_x64.dmg")).toBe("macos-intel");
    expect(classifyAsset("HavnAI Node_0.1.0_amd64.deb")).toBe("linux-deb");
    expect(classifyAsset("HavnAI Node_0.1.0_amd64.AppImage")).toBe("linux-appimage");
  });

  it("ignores assets that are not installers", () => {
    expect(classifyAsset("SHA256SUMS.txt")).toBeNull();
    expect(classifyAsset("source.tar.gz")).toBeNull();
  });
});

describe("toDownloadOptions", () => {
  it("returns one option per platform in a stable order", () => {
    const options = toDownloadOptions(RELEASE_ASSETS);
    expect(options.map((option) => option.platform)).toEqual([
      "windows",
      "macos-arm",
      "macos-intel",
      "linux-deb",
      "linux-appimage",
    ]);
  });

  it("drops checksum files so they never render as a download", () => {
    const options = toDownloadOptions(RELEASE_ASSETS);
    expect(options.some((option) => option.url.endsWith("/sums"))).toBe(false);
  });

  it("yields nothing when a release carries no installers", () => {
    expect(toDownloadOptions([])).toEqual([]);
    expect(toDownloadOptions([RELEASE_ASSETS[5]])).toEqual([]);
  });
});

describe("detectPlatform", () => {
  it("recognises the common desktop systems", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos-arm");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux-deb");
  });

  it("does not mistake Android for a Linux desktop", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBeNull();
  });

  it("returns null for anything unrecognised, so the first option is used", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBeNull();
  });
});
