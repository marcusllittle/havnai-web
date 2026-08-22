import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { CinematicPageHero } from "../components/CinematicPageHero";
import { SeoHead } from "../components/SeoHead";
import {
  fetchNodes,
  fetchOperatorWorkers,
  fetchLeaderboard,
  fetchNetworkSummary,
  fetchNetworkControlPlane,
  NodeInfo,
  LeaderboardEntry,
  NetworkSummary,
  NetworkControlPlane,
} from "../lib/havnai";
import { getJobSSE, getNodeSSE, SSEEvent } from "../lib/sse";
import { SiteHeader } from "../components/SiteHeader";

type ViewMode = "grid" | "leaderboard";

const NodesPage: NextPage = () => {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [network, setNetwork] = useState<NetworkSummary | null>(null);
  const [controlPlane, setControlPlane] = useState<NetworkControlPlane | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      const [lb, networkSummary, control] = await Promise.all([
        fetchLeaderboard().catch(() => []),
        fetchNetworkSummary().catch(() => null),
        fetchNetworkControlPlane().catch(() => null),
      ]);
      let workers: NodeInfo[] = [];
      const operatorPayload = await fetchOperatorWorkers(300).catch(() => null);
      if (operatorPayload && Array.isArray(operatorPayload.workers) && operatorPayload.workers.length > 0) {
        workers = operatorPayload.workers;
      } else {
        workers = await fetchNodes().catch(() => []);
      }
      if (!active) return;
      setNodes(workers);
      setLeaderboard(lb);
      setNetwork(networkSummary);
      setControlPlane(control);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const refreshControlPlane = useCallback(() => {
    void fetchNetworkControlPlane().then(setControlPlane).catch(() => undefined);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(refreshControlPlane, 15000);
    return () => window.clearInterval(interval);
  }, [refreshControlPlane]);

  useEffect(() => {
    const sse = getJobSSE();
    sse.connect();
    const unsubscribe = sse.subscribe(() => refreshControlPlane());
    return () => {
      unsubscribe();
      sse.disconnect();
    };
  }, [refreshControlPlane]);

  // SSE for live node updates
  useEffect(() => {
    const sse = getNodeSSE();
    sse.connect();
    const unsub = sse.subscribe((event: SSEEvent) => {
      if (
        event.event === "node_update" ||
        event.event === "node_heartbeat" ||
        event.event === "node_disconnected"
      ) {
        setNodes((prev) => {
          const idx = prev.findIndex((n) => n.node_id === event.node_id);
          const status =
            event.status ??
            (event.event === "node_disconnected" ? "offline" : "online");
          const isOnline = status === "online";
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              online: isOnline,
              status,
              gpu: event.gpu || updated[idx].gpu,
              last_seen: new Date().toISOString(),
            };
            return updated;
          }
          return prev;
        });
      }
    });
    return () => {
      unsub();
      sse.disconnect();
    };
  }, []);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase();
    return nodes.filter((n) =>
      (n.node_id || "").toLowerCase().includes(q) ||
      (n.node_name || "").toLowerCase().includes(q) ||
      (n.gpu?.gpu_name || "").toLowerCase().includes(q) ||
      (n.wallet || "").toLowerCase().includes(q) ||
      (n.operator?.display_name || "").toLowerCase().includes(q) ||
      (n.supported_job_types || []).join(" ").toLowerCase().includes(q)
    );
  }, [nodes, search]);

  const onlineCount = network?.nodes.online ?? nodes.filter((n) => n.online).length;
  const formatUptime = useCallback((lastSeen: string) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, []);

  const formatPercent = useCallback((value: number | null | undefined) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return "--";
    return `${(numeric * 100).toFixed(1)}%`;
  }, []);

  const shortWallet = useCallback((wallet?: string | null) => {
    if (!wallet) return "--";
    if (wallet.length < 12) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  }, []);

  return (
    <>
      <SeoHead
        title="GPU node network"
        description="Track live operators, node uptime, and capacity across the JoinHavn GPU network."
        path="/nodes"
        image="/astra/scenes/spaceport_hub.png"
      />
      <SiteHeader />

      <main className="library-page jh-page-shell">
        <CinematicPageHero
          eyebrow="Network"
          title="Watch the grid in real time."
          description="Live operator telemetry from the coordinator shows which machines are online, what capacity they expose, and how Public Alpha activity is flowing through the network."
          mediaVariant="network"
          panelEyebrow="Node Telemetry"
          panelTitle="Capacity, uptime, trust, rewards"
          panelDescription="Use this view to monitor the machines powering image, face swap, and video jobs, then jump into onboarding when you are ready to add your own hardware."
          stats={[
            {
              label: "Live Capacity",
              value: `${((network?.capacity.total_vram_mb ?? 0) / 1024).toFixed(0)} GB`,
              detail: "GPU VRAM reporting online",
            },
            {
              label: "Online",
              value: onlineCount.toLocaleString(),
              detail: "Reporting live heartbeats",
            },
            {
              label: "Queue",
              value: (network?.queue.queued ?? 0).toLocaleString(),
              detail: `${network?.queue.running ?? 0} jobs currently running`,
            },
          ]}
          actions={
            <>
              <Link href="/run-a-node" className="jh-btn jh-btn-primary">
                Run a Node
              </Link>
              <Link href="/analytics" className="jh-btn jh-btn-secondary">
                Open Analytics
              </Link>
              <Link href="/receipt-anchors" className="jh-btn jh-btn-secondary">
                Receipt Anchors
              </Link>
            </>
          }
        />

        <section className="page-container">
          {controlPlane && (
            <>
              <div className="chart-section">
                <div className="chart-header">
                  <div>
                    <p className="job-drawer-kicker" style={{ margin: 0 }}>Alpha Command Center</p>
                    <h3 className="chart-title">Network control plane</h3>
                  </div>
                  <span className={`node-status ${controlPlane.health.status === "healthy" ? "online" : "offline"}`}>
                    {controlPlane.health.status}
                  </span>
                </div>
                {controlPlane.health.alerts.length === 0 ? (
                  <p style={{ color: "#8ff0b6", marginBottom: 0 }}>All monitored network signals are within operating thresholds.</p>
                ) : (
                  <div className="job-details-stack" style={{ marginTop: "1rem" }}>
                    {controlPlane.health.alerts.map((alert) => (
                      <div key={alert.code} className="node-detail-row">
                        <span style={{ color: alert.severity === "critical" ? "#ff8f8f" : "#ffcf70" }}>
                          {alert.severity.toUpperCase()} · {alert.code.replaceAll("_", " ")}
                        </span>
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Ready Operators</div>
                  <div className="stat-value">{controlPlane.nodes.ready}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Busy Operators</div>
                  <div className="stat-value">{controlPlane.nodes.busy}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Oldest Queue Wait</div>
                  <div className="stat-value">{controlPlane.queue.oldest_wait_seconds.toFixed(0)}s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Queue P95 (24h)</div>
                  <div className="stat-value">{controlPlane.latency_24h.queue_p95_seconds.toFixed(1)}s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Runtime P95 (24h)</div>
                  <div className="stat-value">{controlPlane.latency_24h.run_p95_seconds.toFixed(1)}s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Claims at Risk</div>
                  <div className="stat-value" style={{ color: controlPlane.claims.at_risk ? "#ffcf70" : "#8ff0b6" }}>
                    {controlPlane.claims.at_risk}
                  </div>
                </div>
              </div>

              <div className="chart-section">
                <div className="chart-header">
                  <h3 className="chart-title">Active execution claims</h3>
                  <span style={{ color: "var(--text-muted)" }}>{controlPlane.claims.active.length} running</span>
                </div>
                {controlPlane.claims.active.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Job</th><th>Workload</th><th>Node</th><th>Lease</th><th>Score</th><th>Route</th></tr>
                      </thead>
                      <tbody>
                        {controlPlane.claims.active.map((claim) => (
                          <tr key={claim.job_id}>
                            <td style={{ fontFamily: "monospace" }}>{claim.job_id.slice(0, 16)}</td>
                            <td>{claim.task_type} · {claim.model}</td>
                            <td>{claim.node_id}</td>
                            <td style={{ color: claim.at_risk ? "#ffcf70" : undefined }}>{claim.lease_remaining_seconds.toFixed(0)}s</td>
                            <td>{claim.dispatch_score?.toFixed(1) ?? "--"}</td>
                            <td>{claim.dispatch_reason || "untracked"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>No jobs are currently executing.</p>
                )}
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Preferred Routes (24h)</div>
                  <div className="stat-value">{controlPlane.scheduler_24h.preferred}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Fallback Routes (24h)</div>
                  <div className="stat-value">{controlPlane.scheduler_24h.fallback}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Receipts Awaiting Batch</div>
                  <div className="stat-value">{controlPlane.receipts.unbatched}</div>
                </div>
              </div>
            </>
          )}

          <div className="chart-section">
            <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Live node telemetry comes directly from the coordinator. Use this page to track current
              capacity, uptime, and operator visibility across the grid. Reward totals reflect Public
              Alpha tracking and may include Sepolia or testnet-era activity while settlement rails
              continue to evolve. Want to appear here? <a href="/run-a-node" style={{ color: "var(--accent)" }}>Open the install guide</a>.
            </p>
            <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <Link href="/how-it-works" className="jh-btn jh-btn-secondary">How It Works</Link>
              <Link href="/pricing" className="jh-btn jh-btn-secondary">Credits & Pricing</Link>
              <Link href="/ai-image-generator" className="jh-btn jh-btn-tertiary">AI Image Generator</Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Nodes</div>
              <div className="stat-value">{nodes.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Online</div>
              <div className="stat-value" style={{ color: "#8ff0b6" }}>{onlineCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Offline</div>
              <div className="stat-value" style={{ color: "#ffb3b3" }}>{network?.nodes.offline ?? nodes.length - onlineCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Image Capacity</div>
              <div className="stat-value">{network?.capacity.by_job_type.IMAGE_GEN ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Video Capacity</div>
              <div className="stat-value">{(network?.capacity.by_job_type.VIDEO_GEN ?? 0) + (network?.capacity.by_job_type.LTX_VIDEO_GEN ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average GPU Load</div>
              <div className="stat-value">{(network?.capacity.average_gpu_utilization ?? 0).toFixed(0)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Recovered Jobs</div>
              <div className="stat-value">{network?.recovery.jobs_retried ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Expired Claims</div>
              <div
                className="stat-value"
                style={{ color: (network?.recovery.expired_claims ?? 0) > 0 ? "#ffcf70" : "#8ff0b6" }}
              >
                {network?.recovery.expired_claims ?? 0}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
            <div className="library-search-wrapper">
              <input
                type="text"
                className="library-search"
                placeholder="Search nodes by name, GPU, or wallet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="library-filters">
              <div className="library-filter-group">
                <span className="library-filter-label">View</span>
                <button type="button" className={`library-chip ${view === "grid" ? "is-active" : ""}`} onClick={() => setView("grid")}>Nodes</button>
                <button type="button" className={`library-chip ${view === "leaderboard" ? "is-active" : ""}`} onClick={() => setView("leaderboard")}>Leaderboard</button>
              </div>
            </div>
          </div>

          {loading && <p className="library-loading">Loading nodes...</p>}

          {/* Grid view */}
          {!loading && view === "grid" && (
            <div className="node-grid">
              {filteredNodes.map((node) => (
                <div key={node.node_id} className="node-card">
                  <div className="node-header">
                    <span className="node-name">{node.node_name || node.node_id}</span>
                    <span className={`node-status ${node.online ? "online" : "offline"}`}>
                      {node.online ? "Online" : "Offline"}
                    </span>
                  </div>
                  {node.gpu?.gpu_name && (
                    <div className="node-detail-row">
                      <span>GPU</span>
                      <span>{node.gpu.gpu_name}</span>
                    </div>
                  )}
                  {node.gpu?.memory_total_mb && (
                    <div className="node-detail-row">
                      <span>VRAM</span>
                      <span>
                        {node.gpu.memory_used_mb ? `${(node.gpu.memory_used_mb / 1024).toFixed(1)} / ` : ""}
                        {(node.gpu.memory_total_mb / 1024).toFixed(1)} GB
                      </span>
                    </div>
                  )}
                  {typeof node.gpu?.utilization === "number" && (
                    <>
                      <div className="node-detail-row">
                        <span>GPU Load</span>
                        <span>{node.gpu.utilization.toFixed(0)}%</span>
                      </div>
                      <div className="gpu-bar">
                        <div className="gpu-bar-fill" style={{ width: `${Math.min(100, node.gpu.utilization)}%` }} />
                      </div>
                    </>
                  )}
                  <div className="node-detail-row">
                    <span>Role</span>
                    <span>{node.role}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Operator</span>
                    <span>{shortWallet(node.operator?.wallet || node.wallet || null)}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Display</span>
                    <span>{node.operator?.display_name || node.node_name || node.node_id}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Job Types</span>
                    <span>
                      {(node.supported_job_types && node.supported_job_types.length > 0
                        ? node.supported_job_types.join(", ")
                        : node.supports && node.supports.length > 0
                        ? node.supports.join(", ")
                        : node.role)}
                    </span>
                  </div>
                  <div className="node-detail-row">
                    <span>Jobs Done</span>
                    <span>{node.performance?.completed_attempts ?? node.tasks_completed}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Failures</span>
                    <span>{node.performance?.failed_attempts ?? "--"}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Success Rate</span>
                    <span>{formatPercent(node.performance?.success_rate)}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Malformed Rate</span>
                    <span>{formatPercent(node.performance?.malformed_rate)}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Tracked HAI</span>
                    <span>{(node.payouts?.total ?? node.rewards).toFixed(4)}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Reward Activity (30d)</span>
                    <span>{node.payouts?.window_count ?? 0} tx / {(node.payouts?.window_total ?? 0).toFixed(4)} HAI</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Trust</span>
                    <span>
                      {node.trust?.score == null
                        ? `${node.trust?.level || "new"}`
                        : `${node.trust.score.toFixed(1)} (${node.trust.level || "monitoring"})`}
                    </span>
                  </div>
                  <div className="node-detail-row">
                    <span>Routing Score</span>
                    <span>{node.scheduler?.score?.toFixed(1) ?? "--"}</span>
                  </div>
                  <div className="node-detail-row">
                    <span>Last Seen</span>
                    <span>{formatUptime(node.last_seen)}</span>
                  </div>
                  {node.models.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "0.3rem" }}>
                      {node.models.slice(0, 4).map((m) => (
                        <span key={m} className="workflow-tag">{m.length > 20 ? m.slice(0, 20) + "..." : m}</span>
                      ))}
                      {node.models.length > 4 && (
                        <span className="workflow-tag">+{node.models.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredNodes.length === 0 && !loading && (
                <div className="library-empty">
                  <p>No nodes match this view right now. Clear your search or check back as more Public Alpha operators come online.</p>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard view */}
          {!loading && view === "leaderboard" && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Network Leaderboard</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Wallet</th>
                    <th>Nodes</th>
                    <th>Total Jobs</th>
                    <th>Last 24h HAI</th>
                    <th>All-Time HAI</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.wallet}>
                      <td>{i + 1}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                        {entry.wallet.slice(0, 6)}...{entry.wallet.slice(-4)}
                      </td>
                      <td>{entry.nodes.length}</td>
                      <td>{entry.jobs}</td>
                      <td>{entry.last_24h.toFixed(4)}</td>
                      <td style={{ color: "#8ff0b6" }}>{entry.total_rewards.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboard.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "1rem" }}>
                  Leaderboard data will appear here as tracked Public Alpha reward activity accumulates.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default NodesPage;
