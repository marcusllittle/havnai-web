import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowUpRight, Network } from "lucide-react";
import { SeoHead } from "../components/SeoHead";
import {
  fetchNodes,
  fetchOperatorWorkers,
  fetchLeaderboard,
  fetchNetworkSummary,
  fetchNetworkControlPlane,
  HavnaiApiError,
  NodeInfo,
  LeaderboardEntry,
  NetworkSummary,
  NetworkControlPlane,
} from "../lib/havnai";
import { getJobSSE, getNodeSSE, SSEEvent } from "../lib/sse";
import { NetworkNavigation } from "../components/NetworkNavigation";
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

  const [refreshKey, setRefreshKey] = useState(0);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [controlError, setControlError] = useState(false);
  const [controlUnsupported, setControlUnsupported] = useState(false);
  const [nodesAvailable, setNodesAvailable] = useState(false);
  const [leaderboardAvailable, setLeaderboardAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true); setUnavailable([]);
    const workers = (async () => {
      const response = await fetchOperatorWorkers(300, undefined, controller.signal).catch(() => null);
      if (response?.workers.length) return response.workers;
      return fetchNodes(controller.signal).catch(() => response ? response.workers : null);
    })();
    Promise.all([
      workers,
      fetchLeaderboard(controller.signal).catch(() => null),
      fetchNetworkSummary(controller.signal).catch(() => null),
    ]).then(([workers, lb, summary]) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setNodes(workers ?? []); setLeaderboard(lb ?? []); setNetwork(summary);
      setNodesAvailable(workers !== null); setLeaderboardAvailable(lb !== null);
      setUnavailable([workers === null && "node directory", lb === null && "leaderboard", !summary && "capacity summary"].filter(Boolean) as string[]);
      setLoading(false);
    });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    let unsupported = false;
    setControlUnsupported(false);
    let timeout: number | undefined;
    const refresh = async () => {
      if (pending || unsupported) return;
      pending = new AbortController();
      timeout = window.setTimeout(() => pending?.abort(), 12000);
      try {
        const control = await fetchNetworkControlPlane(pending.signal);
        if (active) { setControlPlane(control); setControlError(false); }
      } catch (error) {
        if (active) {
          unsupported = error instanceof HavnaiApiError && error.status === 404;
          setControlUnsupported(unsupported);
          setControlError(!unsupported);
        }
      } finally {
        window.clearTimeout(timeout); pending = null;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    const sse = getJobSSE();
    sse.connect();
    const unsubscribe = sse.subscribe(() => void refresh());
    return () => { active = false; window.clearInterval(interval); window.clearTimeout(timeout); pending?.abort(); unsubscribe(); sse.disconnect(); };
  }, [refreshKey]);

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
              gpu: { ...updated[idx].gpu, ...event.gpu },
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
    const q = search.trim().toLowerCase();
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
    if (!Number.isFinite(diff)) return "--";
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, []);

  const formatPercent = useCallback((value: number | null | undefined) => {
    const numeric = Number(value ?? 0);
    if (value == null || !Number.isFinite(numeric)) return "--";
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

      <main className="network-page">
        <header className="network-heading"><div><span className="network-eyebrow"><Network size={15} aria-hidden="true" /> GPU network</span><h1>The machines behind the magic.</h1><p>Explore the operators and capacity powering creation on HavnAI.</p></div><Link href="/run-a-node" className="network-primary">Run a node <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
        <NetworkNavigation active="nodes" />
        <section className="network-content" aria-label="Network status and operators">
          {loading ? <p className="network-empty" role="status">Loading network data...</p> : <>
            {unavailable.length > 0 && <div className="network-notice" role="alert"><p>We could not load the {unavailable.join(", ")}. Available data is shown below.</p><button className="network-secondary" onClick={() => setRefreshKey(value => value + 1)}>Retry network data</button></div>}
            <div className="network-stats network-stats-primary">
              <div className="network-stat"><span>Online nodes</span><strong>{network || nodesAvailable ? onlineCount : "--"}</strong></div>
              <div className="network-stat"><span>GPU memory online</span><strong>{network ? (network.capacity.total_vram_mb / 1024).toFixed(0) : "--"}<small> GB</small></strong></div>
              <div className="network-stat"><span>Jobs running</span><strong>{network?.queue.running ?? "--"}</strong></div>
              <div className="network-stat"><span>Jobs queued</span><strong>{network?.queue.queued ?? "--"}</strong></div>
            </div>
          </>}
          <div className="network-health">
            <span className={controlPlane?.health.status === "healthy" && !controlError ? "network-health-indicator" : "network-health-indicator is-unavailable"} aria-hidden="true" />
            <span>{controlUnsupported ? "Advanced telemetry is not available on this coordinator." : controlError ? "Live health is unavailable. Retrying automatically." : controlPlane ? `Network health: ${controlPlane.health.status}` : "Checking network health..."}</span>
          </div>
          {!controlError && controlPlane?.health.alerts.map(alert => <p className="network-notice" key={alert.code}>{alert.severity}: {alert.message}</p>)}
          <div className="network-section-heading"><h2>Explore operators</h2><span>{!loading && nodesAvailable ? `${nodes.length} nodes reporting` : "Public Alpha"}</span></div>
          {/* Toolbar */}
          <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
            <div className="library-search-wrapper">
              <input
                type="text"
                className="library-search"
                aria-label={view === "grid" ? "Search nodes" : "Search leaderboard wallets"}
                placeholder={view === "grid" ? "Search name, GPU, or wallet" : "Search wallet address"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="library-filters">
              <div className="library-filter-group">
                <span className="library-filter-label">View</span>
                <button type="button" className={`library-chip ${view === "grid" ? "is-active" : ""}`} aria-pressed={view === "grid"} onClick={() => setView("grid")}>Nodes</button>
                <button type="button" className={`library-chip ${view === "leaderboard" ? "is-active" : ""}`} aria-pressed={view === "leaderboard"} onClick={() => setView("leaderboard")}>Leaderboard</button>
              </div>
            </div>
          </div>


          {/* Grid view */}
          {!loading && nodesAvailable && view === "grid" && (
            <div className="node-grid">
              {filteredNodes.map((node) => (
                <div key={node.node_id} className="node-card">
                  <div className="node-header">
                    <h3 className="node-name">{node.node_name || node.node_id}</h3>
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
                        <div className="gpu-bar-fill" style={{ width: `${Math.max(0, Math.min(100, node.gpu.utilization))}%` }} />
                      </div>
                    </>
                  )}
                  <div className="node-card-summary"><span>{node.performance?.completed_attempts ?? node.tasks_completed} jobs completed</span><span>Seen {formatUptime(node.last_seen)}</span></div>
                  <details className="network-disclosure"><summary>Operator details</summary><div className="node-extra-details">
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
                  </div></details>
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
          {!loading && leaderboardAvailable && view === "leaderboard" && (
            <div className="network-panel">
              <div className="chart-header">
                <h2 className="chart-title">Network leaderboard</h2>
              </div>
              <div className="network-table" tabIndex={0} role="region" aria-label="Leaderboard table"><table className="data-table">
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
                  {leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 })).filter(entry => entry.wallet.toLowerCase().includes(search.trim().toLowerCase())).map((entry) => (
                    <tr key={entry.wallet}>
                      <td>{entry.rank}</td>
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
              </table></div>
              {leaderboard.filter(entry => entry.wallet.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "1rem" }}>
                  {search.trim() ? "No wallets match your search." : "Leaderboard data will appear as tracked reward activity accumulates."}
                </p>
              )}
            </div>
          )}
          <details className="network-disclosure network-advanced"><summary>Capacity, execution, and routing details</summary><div className="network-advanced-content">
            {controlError && <p className="network-notice">Live telemetry could not be refreshed. Previously loaded execution and routing data below may be out of date.</p>}
          {controlPlane && (<>
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

              <div className="network-panel">
                <div className="chart-header">
                  <h3 className="chart-title">Active execution claims</h3>
                  <span style={{ color: "var(--text-muted)" }}>{controlPlane.claims.active.length} running</span>
                </div>
                {controlPlane.claims.active.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <div className="network-table" tabIndex={0} role="region" aria-label="Execution claims table"><table className="data-table">
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
                    </table></div>
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

          <h3 className="network-detail-heading">Capacity and recovery</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Nodes</div>
              <div className="stat-value">{nodesAvailable ? nodes.length : "--"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Online</div>
              <div className="stat-value" style={{ color: "#8ff0b6" }}>{network || nodesAvailable ? onlineCount : "--"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Offline</div>
              <div className="stat-value" style={{ color: "#ffb3b3" }}>{network?.nodes.offline ?? (nodesAvailable ? nodes.filter(node => !node.online).length : "--")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Image Capacity</div>
              <div className="stat-value">{network?.capacity.by_job_type.IMAGE_GEN ?? "--"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Video Capacity</div>
              <div className="stat-value">{network ? (network.capacity.by_job_type.VIDEO_GEN ?? 0) + (network.capacity.by_job_type.LTX_VIDEO_GEN ?? 0) : "--"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average GPU Load</div>
              <div className="stat-value">{network ? `${network.capacity.average_gpu_utilization.toFixed(0)}%` : "--"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Recovered Jobs</div>
              <div className="stat-value">{network?.recovery.jobs_retried ?? "--"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Expired Claims</div>
              <div
                className="stat-value"
                style={{ color: (network?.recovery.expired_claims ?? 0) > 0 ? "#ffcf70" : "#8ff0b6" }}
              >
                {network?.recovery.expired_claims ?? "--"}
              </div>
            </div>
          </div>


          </div></details>
        </section>
        <p className="network-footnote">Telemetry is reported by the coordinator. Tracked rewards may include Sepolia and testnet activity during Public Alpha. <Link href="/how-it-works">How HavnAI works</Link></p>
      </main>
    </>
  );
};
export default NodesPage;
