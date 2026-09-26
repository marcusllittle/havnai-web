import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "../../pages/library";
import { fetchJob, fetchMyJobs, fetchResult, type JobDetailResponse } from "../../lib/havnai";
import { saveLibrary } from "../../lib/libraryStore";

const { session } = vi.hoisted(() => ({ session: { activeWallet: null as string | null, connect: vi.fn() } }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../JobDetailsDrawer", () => ({ JobDetailsDrawer: () => null }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ ...session, source: "none" }) }));
vi.mock("../../lib/havnai", async importOriginal => ({
  ...await importOriginal<typeof import("../../lib/havnai")>(),
  fetchJob: vi.fn(), fetchResult: vi.fn(), fetchMyJobs: vi.fn(),
}));

const entries = [
  { job_id: "coast", created_at: "2026-09-17T12:00:00Z", type: "image" as const, preview_hint: "https://example.com/coast.webp" },
  { job_id: "motion", created_at: "2026-09-16T12:00:00Z", type: "video" as const },
];

describe("Collection browsing", () => {
  let container: HTMLDivElement;
  let root: Root;

  function click(label: string) {
    const target = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.trim() === label);
    expect(target, label).toBeDefined();
    target!.click();
  }

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    session.activeWallet = null;
    session.connect.mockReset().mockResolvedValue(undefined);
    vi.mocked(fetchMyJobs).mockResolvedValue([]);
    vi.mocked(fetchJob).mockImplementation(async id => ({ id, status: "completed", model: "SDXL", data: { prompt: id === "coast" ? "Coastal light" : "Moving clouds" } }) as JobDetailResponse);
    vi.mocked(fetchResult).mockImplementation(async id => ({ job_id: id, ...(id === "coast" ? { image_url: "https://example.com/coast.webp" } : { video_url: "https://example.com/motion.mp4" }) }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows cached previews immediately and fills cards without waiting for the slowest result", async () => {
    saveLibrary(entries);
    let finishSlow: (job: JobDetailResponse) => void = () => {};
    vi.mocked(fetchJob).mockImplementation(id => id === "motion" ? new Promise(resolve => { finishSlow = resolve; }) : Promise.resolve({ id, status: "completed", data: { prompt: "Coastal light" } } as JobDetailResponse));
    await act(async () => root.render(<LibraryPage />));
    expect(container.querySelectorAll(".library-card")).toHaveLength(2);
    expect(container.querySelector(".collection-preview-button img")?.getAttribute("src")).toBe(entries[0].preview_hint);
    expect(container.textContent).toContain("Coastal light");
    expect(container.textContent).toContain("Refreshing your creations");
    await act(async () => finishSlow({ id: "motion", status: "completed", data: { prompt: "Moving clouds" } } as JobDetailResponse));
    expect(container.textContent).toContain("Moving clouds");
    expect(container.querySelector(".collection-loading")).toBeNull();
  });

  it("filters media, clears unmatched searches, and selects work with a native checkbox", async () => {
    saveLibrary(entries);
    await act(async () => root.render(<LibraryPage />));
    await act(async () => container.querySelectorAll<HTMLButtonElement>(".collection-type-tabs button")[2].click());
    expect(container.querySelectorAll(".library-card")).toHaveLength(1);
    expect(container.querySelector(".collection-card-title")?.textContent).toBe("Moving clouds");
    await act(async () => click("Select"));
    const checkbox = container.querySelector<HTMLInputElement>('.collection-selection input')!;
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(true);
    expect(container.textContent).toContain("Remove (1)");
    const search = container.querySelector<HTMLInputElement>('[aria-label="Search collection"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "not present");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("No matches this time.");
    await act(async () => click("Clear filters"));
    expect(container.querySelectorAll(".library-card")).toHaveLength(2);
  });

  it("keeps unavailable previews in the collection after a timed-out request", async () => {
    vi.useFakeTimers();
    saveLibrary([entries[0]]);
    vi.mocked(fetchJob).mockImplementation((_id, options) => new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")))));
    vi.mocked(fetchResult).mockImplementation((_id, options) => new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")))));
    await act(async () => root.render(<LibraryPage />));
    await act(async () => vi.advanceTimersByTimeAsync(15000));
    expect(container.textContent).toContain("Unavailable");
    expect(container.querySelectorAll(".library-card")).toHaveLength(1);
    expect(container.querySelector(".collection-preview-button img")?.getAttribute("src")).toBe(entries[0].preview_hint);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Refresh collection"]')!.disabled).toBe(false);
  });

  it("distinguishes an empty collection from history that has not loaded", async () => {
    session.activeWallet = "0xfixture";
    let failHistory: (error: Error) => void = () => {};
    vi.mocked(fetchMyJobs).mockImplementation(() => new Promise((_, reject) => { failHistory = reject; }));
    await act(async () => root.render(<LibraryPage />));
    expect(container.textContent).toContain("Looking for your saved work");
    expect(container.querySelector(".collection-empty")).toBeNull();
    await act(async () => failHistory(new Error("Offline")));
    expect(container.textContent).toContain("Couldn’t refresh your history");
    expect(container.textContent).toContain("Nothing is saved in this browser yet");
  });

  it("replaces broken media with a useful preview fallback", async () => {
    saveLibrary([entries[0]]);
    await act(async () => root.render(<LibraryPage />));
    await act(async () => container.querySelector(".collection-preview-button img")!.dispatchEvent(new Event("error")));
    expect(container.textContent).toContain("Preview unavailable");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="View Coastal light"]')!.disabled).toBe(false);
  });

  it("keeps collection content visible when connecting a wallet fails", async () => {
    session.connect.mockRejectedValueOnce(new Error("Wallet connection was canceled."));
    saveLibrary([entries[0]]);
    await act(async () => root.render(<LibraryPage />));
    await act(async () => container.querySelector<HTMLButtonElement>(".wallet-status-actions button")!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Wallet connection was canceled.");
    expect(container.querySelector(".collection-preview-button")).not.toBeNull();
  });
});
