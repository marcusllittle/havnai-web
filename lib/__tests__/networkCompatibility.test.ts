import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLeaderboard, fetchNetworkSummary } from "../havnai";
afterEach(() => vi.unstubAllGlobals());
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
describe("legacy coordinator network compatibility", () => {
  it("requests JSON rather than the HTML leaderboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ leaderboard: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLeaderboard();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/network/leaderboard?format=json");
  });
  it("uses live nodes and queue data when the versioned summary is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("Not found", { status: 404 }))
      .mockResolvedValueOnce(json({ nodes: [
        { node_id: "online", online: true, gpu: { memory_total_mb: 24576, utilization: 50 }, supports: ["image"], supported_job_types: ["IMAGE_GEN", "IMAGE_GEN"] },
        { node_id: "offline", online: false, gpu: { memory_total_mb: 24576 }, supports: ["image"] },
      ] })).mockResolvedValueOnce(json({ summary: { queued_jobs: 2, active_jobs: 1 } }));
    vi.stubGlobal("fetch", fetchMock);
    const summary = await fetchNetworkSummary();
    expect(summary.source).toBe("legacy");
    expect(summary.nodes.online).toBe(1);
    expect(summary.capacity.total_vram_mb).toBe(24576);
    expect(summary.capacity.by_job_type.IMAGE_GEN).toBe(1);
    expect(summary.queue.running).toBe(1);
    expect(summary.recovery.jobs_retried).toBeNull();
  });
  it("does not conceal a failed coordinator with a fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchNetworkSummary()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
