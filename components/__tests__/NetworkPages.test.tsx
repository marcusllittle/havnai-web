import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodesPage from "../../pages/nodes";
import AnalyticsPage from "../../pages/analytics";
import * as api from "../../lib/havnai";
import type { SSEEvent } from "../../lib/sse";

const { events } = vi.hoisted(() => ({ events: { node: null as ((event: SSEEvent) => void) | null } }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../../lib/sse", () => ({
  getJobSSE: () => ({ connect: vi.fn(), disconnect: vi.fn(), subscribe: () => vi.fn() }),
  getNodeSSE: () => ({ connect: vi.fn(), disconnect: vi.fn(), subscribe: (callback: typeof events.node) => { events.node = callback; return () => { events.node = null; }; } }),
}));
vi.mock("../../lib/havnai", async original => ({ ...await original<typeof import("../../lib/havnai")>(),
  fetchNodes: vi.fn(), fetchOperatorWorkers: vi.fn(), fetchLeaderboard: vi.fn(), fetchNetworkSummary: vi.fn(), fetchNetworkControlPlane: vi.fn(),
  fetchAnalyticsOverview: vi.fn(), fetchAnalyticsJobs: vi.fn(), fetchAnalyticsCosts: vi.fn(), fetchAnalyticsRewards: vi.fn(),
}));
const node = { node_id: "north", node_name: "North Studio", role: "worker", online: true, gpu: { gpu_name: "RTX 4090", utilization: 37 }, models: ["sdxl"], last_seen: "2026-09-17T18:00:00Z", tasks_completed: 42, rewards: 1 } as api.NodeInfo;
const days = Array.from({ length: 30 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, count: i + 1, success: i, failed: 1 }));

describe("Network dashboards", () => {
  let container: HTMLDivElement; let root: Root;
  const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
  const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(element => element.textContent?.trim() === text)!;
  const search = async (value: string) => { const input = container.querySelector("input")!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); };
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(api.fetchOperatorWorkers).mockResolvedValue({ workers: [node] } as api.OperatorWorkersResponse);
    vi.mocked(api.fetchNodes).mockResolvedValue([node]);
    vi.mocked(api.fetchNetworkSummary).mockResolvedValue({ nodes: { online: 1, offline: 0 }, capacity: { total_vram_mb: 24576, average_gpu_utilization: 37, by_job_type: { IMAGE_GEN: 1 } }, queue: { running: 1, queued: 0 }, recovery: { jobs_retried: 0, expired_claims: 0 } } as unknown as api.NetworkSummary);
    vi.mocked(api.fetchNetworkControlPlane).mockRejectedValue(new Error("Unavailable"));
    vi.mocked(api.fetchLeaderboard).mockResolvedValue([{ wallet: "0xaaa111", nodes: ["one"], jobs: 10, last_24h: 1, total_rewards: 3 }, { wallet: "0xbbb222", nodes: ["two"], jobs: 5, last_24h: 0, total_rewards: 2 }]);
    vi.mocked(api.fetchAnalyticsOverview).mockResolvedValue({ total_jobs: 480, jobs_today: 42, active_nodes: 2, success_rate: 97.2, total_rewards: 20, total_credits_spent: 300 });
    vi.mocked(api.fetchAnalyticsJobs).mockResolvedValue({ days, by_model: [{ model: "sdxl", count: 465 }], by_type: [] });
    vi.mocked(api.fetchAnalyticsCosts).mockResolvedValue({ by_model: [], by_day: [], total_spent: 0 });
    vi.mocked(api.fetchAnalyticsRewards).mockResolvedValue({ by_node: [], by_model: [], total: 0 });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("keeps node browsing visible, searchable, and details collapsed", async () => {
    await render(<NodesPage />);
    expect(container.querySelector(".page-container, .chart-section")).toBeNull();
    expect(container.querySelector<HTMLDetailsElement>(".node-card details")?.open).toBe(false);
    await search("  rtx 4090  ");
    expect(container.querySelectorAll(".node-card")).toHaveLength(1);
    await search("No matching GPU");
    expect(container.querySelectorAll(".node-card")).toHaveLength(0);
    expect(container.textContent).toContain("No nodes match");
  });

  it("preserves leaderboard ranks when searching wallet addresses", async () => {
    await render(<NodesPage />);
    await act(async () => button("Leaderboard").click());
    await search("bbb");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector("tbody td")?.textContent).toBe("2");
    expect(button("Leaderboard").getAttribute("aria-pressed")).toBe("true");
  });

  it("reports unavailable nodes instead of an empty directory and retries", async () => {
    vi.mocked(api.fetchOperatorWorkers).mockRejectedValueOnce(new Error("Unavailable"));
    vi.mocked(api.fetchNodes).mockRejectedValueOnce(new Error("Unavailable"));
    await render(<NodesPage />);
    expect(container.textContent).toContain("We could not load the node directory");
    expect(container.textContent).not.toContain("No nodes match");
    await act(async () => button("Retry network data").click());
    expect(container.querySelectorAll(".node-card")).toHaveLength(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("retains GPU metadata when a partial live update arrives", async () => {
    await render(<NodesPage />);
    await act(async () => events.node?.({ event: "node_heartbeat", node_id: "north", gpu: { utilization: 83 } }));
    expect(container.querySelector(".node-card")?.textContent).toContain("RTX 4090");
    expect(container.querySelector(".node-card")?.textContent).toContain("83%");
    await act(async () => events.node?.({ event: "node_disconnected", node_id: "north" }));
    expect(container.querySelector(".node-status")?.textContent).toBe("Offline");
  });

  it("shows the full activity period and supports choosing a day and a new range", async () => {
    await render(<AnalyticsPage />);
    expect(container.querySelectorAll(".network-bar")).toHaveLength(30);
    expect(container.querySelectorAll('[aria-label="Daily job totals"] tbody tr')).toHaveLength(30);
    await act(async () => container.querySelector<HTMLButtonElement>(".network-bar")!.click());
    expect(container.querySelector(".network-chart-reading")?.textContent).toContain("2026-08-01");
    expect(container.querySelector(".network-bar")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("90 days").click());
    expect(api.fetchAnalyticsJobs).toHaveBeenLastCalledWith(90, expect.any(AbortSignal));
    expect(api.fetchAnalyticsCosts).toHaveBeenLastCalledWith(90, expect.any(AbortSignal));
    expect(container.textContent).toContain("Last 30 days / 0.0000 HAI");
  });

  it("keeps available analytics visible and retries a failed report", async () => {
    vi.mocked(api.fetchAnalyticsJobs).mockRejectedValueOnce(new Error("Unavailable"));
    await render(<AnalyticsPage />);
    expect(container.textContent).toContain("We could not load job activity");
    expect(container.textContent).toContain("480");
    expect(container.textContent).not.toContain("No job activity was recorded");
    await act(async () => button("Retry analytics").click());
    expect(container.querySelectorAll(".network-bar")).toHaveLength(30);
  });

  it("aborts a stalled analytics report and presents retry after twelve seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(api.fetchAnalyticsJobs).mockImplementationOnce((_days, signal) => new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new Error("Timed out")))));
    await render(<AnalyticsPage />);
    expect(container.textContent).toContain("Loading network analytics");
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(container.textContent).toContain("We could not load job activity");
    expect(button("Retry analytics")).toBeDefined();
  });
});
