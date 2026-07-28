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

  it("fetchNetworkSummary uses the versioned network contract", async () => {
    const payload = {
      schema_version: "network-summary.v1",
      generated_at: "2026-07-11T12:00:00Z",
      coordinator: { status: "operational", version: "1.0.0" },
      nodes: { total: 4, online: 3, offline: 1, operators_online: 2 },
      capacity: {
        by_job_type: { IMAGE_GEN: 3, VIDEO_GEN: 1 },
        total_vram_mb: 73728,
        average_gpu_utilization: 42,
      },
      queue: { queued: 2, running: 1, completed: 20, failed: 1 },
      recovery: { lease_seconds: 1800, max_retries: 3, jobs_retried: 2, expired_claims: 0 },
      scheduler: {
        strategy: "capability_weighted_v1",
        preference_grace_seconds: 8,
        signals: ["availability", "gpu_headroom", "vram", "trust", "freshness"],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const summary = await havnai.fetchNetworkSummary();

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/network/summary");
    expect(summary.capacity.total_vram_mb).toBe(73728);
    expect(summary.queue.running).toBe(1);
    expect(summary.recovery.jobs_retried).toBe(2);
    expect(summary.scheduler.strategy).toBe("capability_weighted_v1");
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

  it("fetchJobTimeline reads the durable execution contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        job_id: "job-1",
        event_count: 2,
        current_stage: "CLAIMED",
        current_status: "RUNNING",
        total_elapsed_ms: 1250,
        events: [
          { id: 1, job_id: "job-1", sequence: 1, stage: "QUEUED", status: "QUEUED", metadata: {}, stage_latency_ms: 0, total_elapsed_ms: 0, created_at: 1 },
          { id: 2, job_id: "job-1", sequence: 2, stage: "CLAIMED", status: "RUNNING", metadata: {}, stage_latency_ms: 1250, total_elapsed_ms: 1250, created_at: 2.25 },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const timeline = await havnai.fetchJobTimeline("job-1");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/jobs/job-1/timeline");
    expect(timeline.events.map((event) => event.stage)).toEqual(["QUEUED", "CLAIMED"]);
    expect(timeline.total_elapsed_ms).toBe(1250);
  });

  it("reads and verifies a Proof of Creation receipt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          job_id: "job-1",
          schema_version: "proof-of-creation.v1",
          payload: {},
          receipt_hash: "abc",
          signature: "sig",
          signature_algorithm: "hmac-sha256",
          artifact_sha256: "artifact",
          created_at: 1,
          signed: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          job_id: "job-1",
          valid: true,
          integrity_valid: true,
          hash_valid: true,
          artifact_exists: true,
          artifact_valid: true,
          signature_valid: true,
          authenticity: "verified",
          receipt_hash: "abc",
          schema_version: "proof-of-creation.v1",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const receipt = await havnai.fetchProofReceipt("job-1");
    const verification = await havnai.verifyProofReceipt("job-1");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/jobs/job-1/receipt");
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/jobs/job-1/receipt/verify");
    expect(receipt.signed).toBe(true);
    expect(verification.authenticity).toBe("verified");
  });

  it("verifies an unsigned receipt hash locally without trusting the API", async () => {
    const digestBytes = Uint8Array.from(
      "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
        .match(/.{2}/g)!
        .map((pair) => Number.parseInt(pair, 16))
    );
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockResolvedValue(digestBytes.buffer),
      },
    });
    const havnai = await importHavnaiFresh();

    const verification = await havnai.verifyProofReceiptLocally({
      job_id: "job-1",
      schema_version: "proof-of-creation.v1",
      payload: {},
      canonical_payload: "{}",
      receipt_hash: "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
      signature_algorithm: "sha256",
      artifact_sha256: "artifact",
      created_at: 1,
      signed: false,
    });

    expect(verification.supported).toBe(true);
    expect(verification.hash_valid).toBe(true);
    expect(verification.valid).toBe(true);
    expect(verification.signature_valid).toBeNull();
  });

  it("fetches a receipt Merkle inclusion proof", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batch_id: 7,
        job_id: "job-1",
        leaf_index: 0,
        receipt_hash: "01".repeat(32),
        leaf_hash: "02".repeat(32),
        proof: [{ position: "right", hash: "03".repeat(32) }],
        schema_version: "receipt-merkle-batch.v1",
        merkle_root: "04".repeat(32),
        leaf_count: 2,
        status: "ready",
        valid: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const havnai = await importHavnaiFresh();

    const proof = await havnai.fetchReceiptInclusionProof("job-1");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/jobs/job-1/receipt/proof");
    expect(proof.batch_id).toBe(7);
    expect(proof.proof[0].position).toBe("right");
  });

  it("fetches the privacy-safe network control plane", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: "network-control-plane.v1",
        generated_at: "2026-07-11T17:00:00Z",
        health: { status: "healthy", alerts: [] },
        nodes: { tracked: 2, online: 2, ready: 1, busy: 1, offline: 0 },
        queue: { queued: 1, running: 1, failed: 0, oldest_wait_seconds: 12 },
        latency_24h: { sample_size: 5, queue_p50_seconds: 2, queue_p95_seconds: 4, run_p50_seconds: 10, run_p95_seconds: 20 },
        claims: { at_risk: 0, active: [] },
        scheduler_24h: { strategy: "capability_weighted_v1", decisions: {}, preferred: 4, fallback: 1 },
        receipts: { unbatched: 3, batch_size: 100, recent_batches: [] },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const havnai = await importHavnaiFresh();

    const control = await havnai.fetchNetworkControlPlane();

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/network/control-plane");
    expect(control.health.status).toBe("healthy");
    expect(control.nodes.ready).toBe(1);
    expect(control.scheduler_24h.fallback).toBe(1);
  });
});
