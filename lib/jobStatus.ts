export type CanonicalPhase =
  | "queued"
  | "assigned"
  | "running"
  | "uploading"
  | "ready"
  | "failed"
  | "unknown";

export interface NormalizedStatus {
  phase: CanonicalPhase;
  label: string;
  pill: string;
  activeIndex: number;
  isFailed: boolean;
  isUnknown: boolean;
}

const PHASE_ORDER: CanonicalPhase[] = [
  "queued",
  "assigned",
  "running",
  "uploading",
  "ready",
];

export function normalizeJobStatus(rawStatus?: string | null): NormalizedStatus {
  const status = (rawStatus || "").toString().trim().toLowerCase();

  if (["failed", "error", "cancelled", "canceled"].includes(status)) {
    return {
      phase: "failed",
      label: "Failed",
      pill: "Failed",
      activeIndex: PHASE_ORDER.length - 1,
      isFailed: true,
      isUnknown: false,
    };
  }

  if (["success", "completed", "ready"].includes(status)) {
    return {
      phase: "ready",
      label: "Ready",
      pill: "Ready",
      activeIndex: PHASE_ORDER.indexOf("ready"),
      isFailed: false,
      isUnknown: false,
    };
  }

  if (["queued", "pending"].includes(status)) {
    return {
      phase: "queued",
      label: "Queued",
      pill: "Running",
      activeIndex: PHASE_ORDER.indexOf("queued"),
      isFailed: false,
      isUnknown: false,
    };
  }

  if (["assigned"].includes(status)) {
    return {
      phase: "assigned",
      label: "Assigned",
      pill: "Running",
      activeIndex: PHASE_ORDER.indexOf("assigned"),
      isFailed: false,
      isUnknown: false,
    };
  }

  if (["uploading"].includes(status)) {
    return {
      phase: "uploading",
      label: "Uploading",
      pill: "Running",
      activeIndex: PHASE_ORDER.indexOf("uploading"),
      isFailed: false,
      isUnknown: false,
    };
  }

  if (["running", "processing", "in_progress"].includes(status)) {
    return {
      phase: "running",
      label: "Running",
      pill: "Running",
      activeIndex: PHASE_ORDER.indexOf("running"),
      isFailed: false,
      isUnknown: false,
    };
  }

  return {
    phase: "unknown",
    label: "Running (unknown)",
    pill: "Running",
    activeIndex: PHASE_ORDER.indexOf("running"),
    isFailed: false,
    isUnknown: true,
  };
}

export function getTimelineSteps(status: NormalizedStatus): { label: string; key: CanonicalPhase }[] {
  if (status.isFailed) {
    return [
      { label: "Queued", key: "queued" },
      { label: "Assigned", key: "assigned" },
      { label: "Running", key: "running" },
      { label: "Uploading", key: "uploading" },
      { label: "Failed", key: "failed" },
    ];
  }
  return [
    { label: "Queued", key: "queued" },
    { label: "Assigned", key: "assigned" },
    { label: "Running", key: "running" },
    { label: "Uploading", key: "uploading" },
    { label: "Ready", key: "ready" },
  ];
}

export function shortJobId(jobId?: string | null): string {
  if (!jobId) return "--";
  if (jobId.length <= 12) return jobId;
  return `${jobId.slice(0, 6)}...${jobId.slice(-4)}`;
}
