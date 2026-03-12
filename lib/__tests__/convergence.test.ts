import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeJobLifecycleEvent } from "../sse";

async function importHavnaiFresh() {
  vi.resetModules();
  return await import("../havnai");
}

describe("canonical job lifecycle event normalization", () => {
  it("normalizes canonical job_lifecycle events", () => {
    const evt = normalizeJobLifecycleEvent("job_lifecycle", {
      job_id: "job-1",
      job_type: "IMAGE_GEN",
      lifecycle_status: "SUCCEEDED",
      settlement_status: "spent",
      quality_status: "valid",
      message: "done",
    });

    expect(evt).not.toBeNull();
    expect(evt?.event).toBe("job_lifecycle");
    expect(evt?.job_id).toBe("job-1");
    expect(evt?.lifecycle_status).toBe("SUCCEEDED");
    expect(evt?.settlement_status).toBe("spent");
    expect(evt?.quality_status).toBe("valid");
  });

  it("normalizes legacy lifecycle status aliases", () => {
    const legacyQueued = normalizeJobLifecycleEvent("job_queued", {
      job_id: "job-queued",
      task_type: "VIDEO_GEN",
    });
    const legacyCancelled = normalizeJobLifecycleEvent("job_failed", {
      job_id: "job-cancel",
      status: "cancelled",
    });

    expect(legacyQueued?.lifecycle_status).toBe("QUEUED");
    expect(legacyQueued?.job_type).toBe("VIDEO_GEN");
    expect(legacyCancelled?.lifecycle_status).toBe("CANCELLED");
  });
});

describe("API contract convergence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_ENABLE_LEGACY_WAN_STATUS;
  });

  it("cancelJob calls POST /jobs/<id>/cancel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "cancelled", job_id: "job-abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    const res = await havnai.cancelJob("job-abc");

    expect(res.status).toBe("cancelled");
    expect(res.job_id).toBe("job-abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/jobs/job-abc/cancel");
    expect(init.method).toBe("POST");
  });

  it("fetchWanVideoJob is gated when legacy endpoint support is disabled", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_LEGACY_WAN_STATUS;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const havnai = await importHavnaiFresh();
    await expect(havnai.fetchWanVideoJob("job-video")).rejects.toMatchObject({
      code: "feature_disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
