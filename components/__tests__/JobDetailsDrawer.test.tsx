import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobDetailsDrawer } from "../JobDetailsDrawer";
import { downloadAsset } from "../../lib/download";
import type { JobDetailResponse } from "../../lib/havnai";
import { fetchJobTimeline, fetchProofReceipt } from "../../lib/havnai";
import { loadLibrary } from "../../lib/libraryStore";

vi.mock("../../lib/havnai", async original => ({ ...await original<typeof import("../../lib/havnai")>(), fetchJobTimeline: vi.fn().mockResolvedValue({ events: [], event_count: 0, total_elapsed_ms: 0 }), fetchProofReceipt: vi.fn().mockRejectedValue(new Error("Unavailable")), verifyProofReceipt: vi.fn().mockRejectedValue(new Error("Unavailable")) }));
vi.mock("../../lib/download", () => ({ downloadAsset: vi.fn() }));
const job = { id: "result-one", status: "completed", model: "Studio SDXL", data: { prompt: "A coast at dawn", steps: 28 }, proof_receipt: { available: false } } as JobDetailResponse;

describe("Result review", () => {
  let container: HTMLDivElement, root: Root, opener: HTMLButtonElement;
  const onClose = vi.fn();
  const render = (open = true, detail: JobDetailResponse | null = job) => act(async () => root.render(<JobDetailsDrawer open={open} job={detail} jobId="result-one" result={{ image_url: "https://example.com/coast.webp" }} onClose={onClose} />));
  const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent?.trim() === text)!;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    opener = document.createElement("button"); document.body.appendChild(opener); opener.focus();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); opener.remove(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("leads with the media and keeps telemetry collapsed", async () => {
    await render();
    expect(container.querySelector(".job-drawer-body > .job-section h3")?.textContent).toBe("Result");
    expect(container.querySelector<HTMLDetailsElement>(".result-technical")!.open).toBe(false);
    expect(button("Copy debug info").closest("details")?.open).toBe(false);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("A coast at dawn");
    expect(button("Save to Collection")).toBeDefined();
  });

  it("saves private account media only to its account cache and avoids legacy telemetry", async () => {
    await act(async () => root.render(<JobDetailsDrawer open accountId="acct_alice" job={job}
      result={{ job_id: job.id, image_url: "/api/account-media/private" }} onClose={onClose} />));
    await act(async () => button("Save to Collection").click());
    expect(loadLibrary("acct_alice")[0].job_id).toBe(job.id);
    expect(loadLibrary()).toEqual([]);
    expect(loadLibrary("acct_bob")).toEqual([]);
    expect(fetchJobTimeline).not.toHaveBeenCalled();
    expect(fetchProofReceipt).not.toHaveBeenCalled();
  });

  it("names the dialog, closes with Escape, and returns focus", async () => {
    await render();
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-labelledby")).toBe("result-detail-title");
    expect(document.activeElement).toBe(button("Close"));
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
    await render(false);
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });

  it("provides an honest failed-preview state and retry", async () => {
    await render();
    await act(async () => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("preview couldn’t load");
    expect(container.querySelector('img[src="/HavnAI-logo.png"]')).toBeNull();
    await act(async () => button("Retry preview").click());
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/coast.webp");
  });

  it("recovers from download errors and avoids claiming an unknown job is running", async () => {
    vi.mocked(downloadAsset).mockRejectedValueOnce(new Error("Offline"));
    await render(true, null);
    expect(container.querySelector(".status-pill")?.textContent).toBe("Status unavailable");
    await act(async () => button("Download output").click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("download couldn’t finish");
    expect(button("Download output").disabled).toBe(false);
  });
});
