import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_CREATE_JOB_KEY,
  ACTIVE_CREATE_JOB_MAX_AGE_MS,
  clearActiveCreateJob,
  loadActiveCreateJob,
  saveActiveCreateJob,
} from "../activeCreateJob";

describe("active create job persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores a current job", () => {
    const job = {
      id: "job-abc123",
      prompt: "test prompt",
      mode: "image" as const,
      startedAt: 1_000,
    };
    saveActiveCreateJob(job);

    expect(loadActiveCreateJob(2_000)).toEqual(job);
  });

  it("removes expired or malformed jobs", () => {
    window.localStorage.setItem(
      ACTIVE_CREATE_JOB_KEY,
      JSON.stringify({ id: "not-a-job", prompt: "test", mode: "image", startedAt: 1_000 })
    );
    expect(loadActiveCreateJob(2_000)).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_CREATE_JOB_KEY)).toBeNull();

    saveActiveCreateJob({ id: "job-old", prompt: "test", mode: "video", startedAt: 1_000 });
    expect(loadActiveCreateJob(1_000 + ACTIVE_CREATE_JOB_MAX_AGE_MS + 1)).toBeNull();
  });

  it("only clears the expected active job", () => {
    const job = {
      id: "job-current",
      prompt: "test",
      mode: "face_swap" as const,
      startedAt: Date.now(),
    };
    saveActiveCreateJob(job);

    clearActiveCreateJob("job-older");
    expect(loadActiveCreateJob()).toEqual(job);

    clearActiveCreateJob(job.id);
    expect(loadActiveCreateJob()).toBeNull();
  });
});
