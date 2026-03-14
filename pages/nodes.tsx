import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchNodes, fetchOperatorWorkers, fetchLeaderboard, NodeInfo, LeaderboardEntry } from "../lib/havnai";
import { getNodeSSE, SSEEvent } from "../lib/sse";
import { SiteHeader } from "../components/SiteHeader";

type ViewMode = "grid" | "leaderboard";

const NodesPage: NextPage = () => {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      const lb = await fetchLeaderboard().catch(() => []);
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
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

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

  const onlineCount = useMemo(() => nodes.filter((n) => n.online).length, [nodes]);

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
      <Head><title>HavnAI Nodes</title></Head>
      <SiteHeader />

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Network</p>
            <h1 className="hero-title">GPU Nodes</h1>
            <p className="hero-subtitle">Live Public Alpha view of the GPU operators and machines currently powering the HavnAI network.</p>
          </div>
        </section>

        <section className="page-container">
          <div className="chart-section">
            <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Live node telemetry comes directly from the coordinator. Use this page to track current
              capacity, uptime, and operator visibility across the grid. Reward totals reflect Public
              Alpha tracking and may include Sepolia or testnet-era activity while settlement rails
              continue to evolve. Want to appear here? <a href="/join" style={{ color: "var(--accent)" }}>Open the install guide</a>.
            </p>
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
              <div className="stat-value" style={{ color: "#ffb3b3" }}>{nodes.length - onlineCount}</div>
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
