import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importHavnaiFresh() {
  vi.resetModules();
  return await import("../havnai");
}

describe("operator worker API helpers", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_HAVNAI_API_BASE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchOperatorWorkers calls canonical operator worker endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workers: [
          {
            node_id: "node-alpha",
            node_name: "alpha",
            role: "creator",
            os: "linux",
            gpu: { gpu_name: "RTX 4090", utilization: 51 },
            models: ["perfectdeliberate_v60"],
            pipelines: ["sdxl"],
            rewards: 12.34,
            tasks_completed: 9,
            last_seen: "2026-03-12T20:00:00Z",
            status: "online",
            online: true,
            supports: ["image", "face_swap"],
            supported_job_types: ["IMAGE_GEN", "FACE_SWAP"],
            operator: {
              wallet: "0x1111111111111111111111111111111111111111",
              display_name: "Alice Operator",
              identity: "0x1111111111111111111111111111111111111111",
            },
            performance: {
              attempts_total: 12,
              completed_attempts: 10,
              failed_attempts: 2,
              malformed_attempts: 1,
              success_rate: 0.8333,
              malformed_rate: 0.1,
              recent_attempt_at: 1710000000,
            },
            payouts: {
              total: 9.5,
              count: 10,
              window_days: 30,
              window_total: 3.1,
              window_count: 4,
              last_payout_at: 1710000001,
            },
            trust: { score: 82.2, level: "monitoring", sample_size: 12 },
            recent_activity_at: 1710000002,
          },
        ],
        summary: {
          total_workers: 1,
          online_workers: 1,
          offline_workers: 0,
          total_payouts: 9.5,
          timestamp: "2026-03-12T20:00:00Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const response = await havnai.fetchOperatorWorkers(100);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/operators/workers?limit=100");
    expect(response.workers).toHaveLength(1);
    expect(response.workers[0].operator?.display_name).toBe("Alice Operator");
    expect(response.workers[0].supported_job_types).toEqual(["IMAGE_GEN", "FACE_SWAP"]);
    expect(response.workers[0].performance?.failed_attempts).toBe(2);
    expect(response.workers[0].payouts?.window_total).toBe(3.1);
    expect(response.workers[0].trust?.level).toBe("monitoring");
  });

  it("fetchOperatorWorkers includes status filter query when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workers: [], summary: { total_workers: 0 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    await havnai.fetchOperatorWorkers(25, "online");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/operators/workers?limit=25&status=online");
  });

  it("fetchNodeDetail exposes recent attempts and payouts for operator traceability", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        node_id: "node-alpha",
        node_name: "alpha",
        role: "creator",
        os: "linux",
        gpu: {},
        models: [],
        pipelines: [],
        rewards: 0,
        tasks_completed: 0,
        status: "offline",
        last_seen: "2026-03-12T20:00:00Z",
        recent_attempts: [{ id: 1, job_id: "job-1", status: "success", claim_time: 1 }],
        recent_payouts: [{ id: 2, node_id: "node-alpha", job_id: "job-1", reward_amount: 0.2, reward_asset_type: "simulated_hai", status: "completed", created_at: 1, updated_at: 1 }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const detail = await havnai.fetchNodeDetail("node-alpha");

    expect(detail.recent_attempts).toHaveLength(1);
    expect(detail.recent_payouts).toHaveLength(1);
  });
});
