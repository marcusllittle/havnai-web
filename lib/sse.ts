// SSE (Server-Sent Events) client for real-time job and node updates.

import { getApiBase } from "./apiBase";

export type JobLifecycleStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface SSEJobEvent {
  event: "job_lifecycle";
  event_type: "job_lifecycle";
  job_id: string;
  job_type?: string;
  lifecycle_status: JobLifecycleStatus | string;
  status: JobLifecycleStatus | string;
  settlement_status?: string;
  quality_status?: string;
  message?: string;
  reason?: string;
  model?: string;
  node_id?: string;
  wallet?: string;
  timestamp?: number;
}

export interface SSENodeEvent {
  event: "node_update" | "node_heartbeat" | "node_disconnected";
  node_id: string;
  status?: "online" | "offline";
  gpu?: { gpu_name?: string; utilization?: number; memory_used_mb?: number; memory_total_mb?: number };
}

export type SSEEvent = SSEJobEvent | SSENodeEvent;

type SSECallback = (event: SSEEvent) => void;

function normalizeLifecycleStatus(raw: unknown): JobLifecycleStatus | null {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "QUEUED") return "QUEUED";
  if (value === "RUNNING") return "RUNNING";
  if (value === "SUCCEEDED" || value === "SUCCESS" || value === "COMPLETED") return "SUCCEEDED";
  if (value === "CANCELLED" || value === "CANCELED") return "CANCELLED";
  if (value === "FAILED") return "FAILED";
  return null;
}

export function normalizeJobLifecycleEvent(eventName: string, rawData: any): SSEJobEvent | null {
  const name = String(eventName || "").trim().toLowerCase();
  const data = rawData && typeof rawData === "object" ? rawData : {};
  const jobId = String(data.job_id || "").trim();
  if (!jobId) return null;

  const canonicalStatus =
    normalizeLifecycleStatus(data.lifecycle_status) ??
    normalizeLifecycleStatus(data.status) ??
    (name === "job_queued"
      ? "QUEUED"
      : name === "job_running"
      ? "RUNNING"
      : name === "job_success"
      ? "SUCCEEDED"
      : name === "job_failed"
      ? normalizeLifecycleStatus(data.status) ?? "FAILED"
      : null);
  if (!canonicalStatus) return null;

  return {
    event: "job_lifecycle",
    event_type: "job_lifecycle",
    job_id: jobId,
    job_type: data.job_type || data.task_type,
    lifecycle_status: canonicalStatus,
    status: canonicalStatus,
    settlement_status: data.settlement_status,
    quality_status: data.quality_status,
    message: data.message,
    reason: data.reason,
    model: data.model,
    node_id: data.node_id,
    wallet: data.wallet,
    timestamp: data.timestamp,
  };
}

export class HavnSSE {
  private source: EventSource | null = null;
  private url: string;
  private callbacks: Set<SSECallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;

  constructor(endpoint: string) {
    this.url = `${getApiBase()}${endpoint}`;
  }

  connect(): void {
    if (this.source) return;

    try {
      this.source = new EventSource(this.url);

      this.source.onopen = () => {
        this.reconnectDelay = 2000;
      };

      const onJobEvent = (eventName: string, e: Event) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          const normalized = normalizeJobLifecycleEvent(eventName, data);
          if (normalized) {
            this.notify(normalized);
          }
        } catch {
          // ignore parse errors
        }
      };

      // Canonical contract
      this.source.addEventListener("job_lifecycle", (e) => onJobEvent("job_lifecycle", e));
      // Backward compatibility for older coordinators.
      this.source.addEventListener("job_update", (e) => onJobEvent("job_update", e));

      this.source.addEventListener("node_update", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          this.notify({ event: "node_update", ...data });
        } catch {
          // ignore
        }
      });
      this.source.addEventListener("node_heartbeat", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          this.notify({ event: "node_heartbeat", ...data, status: "online" });
        } catch {
          // ignore
        }
      });
      this.source.addEventListener("node_disconnected", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          this.notify({ event: "node_disconnected", ...data, status: "offline" });
        } catch {
          // ignore
        }
      });

      this.source.onerror = () => {
        this.disconnect();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  subscribe(cb: SSECallback): () => void {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  private notify(event: SSEEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch {
        // don't let one bad callback kill the stream
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}

// Singleton instances
let jobSSE: HavnSSE | null = null;
let nodeSSE: HavnSSE | null = null;

export function getJobSSE(wallet?: string): HavnSSE {
  const endpoint = wallet ? `/events/jobs?wallet=${encodeURIComponent(wallet)}` : "/events/jobs";
  if (!jobSSE) {
    jobSSE = new HavnSSE(endpoint);
  }
  return jobSSE;
}

export function getNodeSSE(): HavnSSE {
  if (!nodeSSE) {
    nodeSSE = new HavnSSE("/events/nodes");
  }
  return nodeSSE;
}
