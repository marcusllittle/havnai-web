import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import {
  connectWallet,
  fetchCredits,
  fetchPaymentHistory,
  getConnectedWallet,
  CreditBalance,
  PaymentRecord,
} from "../lib/havnai";

interface RecentJob {
  job_id: string;
  model: string;
  status: string;
  task_type?: string;
  reward?: number;
  submitted_at?: string;
  completed_at?: string;
  image_url?: string;
}

interface JobSummary {
  queued_jobs: number;
  active_jobs: number;
  total_distributed: number;
  jobs_completed_today: number;
}

interface JobsResponse {
  jobs: RecentJob[];
  summary?: JobSummary;
}

async function fetchWalletJobs(wallet: string, limit = 20): Promise<JobsResponse> {
  const res = await fetch(`/api/jobs/recent?wallet=${encodeURIComponent(wallet)}&limit=${limit}`);
  if (!res.ok) throw new Error(`jobs/recent ${res.status}`);
  return res.json();
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "success" || s === "completed") return "#8ff0b6";
  if (s === "failed" || s === "error") return "#ffb3b3";
  if (s === "running") return "#ffd97d";
  return "var(--text-muted)";
}

function elapsed(submitted?: string, completed?: string): string {
  if (!submitted) return "--";
  const end = completed ? new Date(completed).getTime() : Date.now();
  const secs = Math.round((end - new Date(submitted).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}m`;
}

const DashboardPage: NextPage = () => {
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore wallet on mount
  useEffect(() => {
    getConnectedWallet().then((w) => { if (w) setWallet(w); }).catch(() => {});
  }, []);

  // Fetch data when wallet changes
  useEffect(() => {
    if (!wallet) return;
    loadData(wallet);

    // Poll every 30s
    pollRef.current = setInterval(() => loadData(wallet), 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  async function loadData(w: string) {
    setLoading(true);
    try {
      const [creditsData, jobsData, paymentsData] = await Promise.allSettled([
        fetchCredits(w),
        fetchWalletJobs(w, 20),
        fetchPaymentHistory(w),
      ]);
      if (creditsData.status === "fulfilled") setCredits(creditsData.value);
      if (jobsData.status === "fulfilled") {
        setJobs(jobsData.value.jobs ?? []);
        setSummary(jobsData.value.summary ?? null);
      }
      if (paymentsData.status === "fulfilled") setPayments(paymentsData.value.slice(0, 5));
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const w = await connectWallet();
      setWallet(w);
    } catch {
      // user rejected or no wallet
    } finally {
      setConnecting(false);
    }
  }

  const successJobs = jobs.filter((j) => j.status.toLowerCase() === "success" || j.status.toLowerCase() === "completed");
  const totalHai = jobs.reduce((acc, j) => acc + (j.reward ?? 0), 0);

  return (
    <>
      <SeoHead
        title="Creator Dashboard"
        description="Your personal HavnAI creator dashboard — credits, job history, and earnings."
        path="/dashboard"
        noindex
      />
      <SiteHeader />

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Dashboard</p>
            <h1 className="hero-title">Creator Dashboard</h1>
            <p className="hero-subtitle">
              Your credits, job history, and network earnings in one place.
            </p>
          </div>
        </section>

        <section className="page-container">
          {/* Wallet gate */}
          {!wallet ? (
            <div className="chart-section" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.7 }}>
                Connect your wallet to see your credits, job history, and earnings.
              </p>
              <button
                type="button"
                className="jh-btn jh-btn-primary"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          ) : (
            <>
              {/* Wallet + refresh row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontFamily: "monospace" }}>
                  {wallet.slice(0, 6)}&hellip;{wallet.slice(-4)}
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  {lastRefresh && (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      Updated {lastRefresh.toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    type="button"
                    className="jh-btn jh-btn-secondary"
                    onClick={() => loadData(wallet)}
                    disabled={loading}
                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                  >
                    {loading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>

              {/* Stats overview */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Credit Balance</div>
                  <div className="stat-value">{(credits?.balance ?? 0).toFixed(1)}</div>
                  <div className="stat-sub">credits available</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Spent</div>
                  <div className="stat-value">{(credits?.total_spent ?? 0).toFixed(1)}</div>
                  <div className="stat-sub">credits used</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Jobs Submitted</div>
                  <div className="stat-value">{jobs.length}</div>
                  <div className="stat-sub">last 20 shown</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Success Rate</div>
                  <div className="stat-value">
                    {jobs.length > 0 ? Math.round((successJobs.length / jobs.length) * 100) : 0}%
                  </div>
                  <div className="stat-sub">{successJobs.length} / {jobs.length} completed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">HAI Earned</div>
                  <div className="stat-value">{totalHai.toFixed(4)}</div>
                  <div className="stat-sub">tracked this session</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Network Active</div>
                  <div className="stat-value">{summary?.active_jobs ?? 0}</div>
                  <div className="stat-sub">{summary?.queued_jobs ?? 0} queued</div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="chart-section">
                <div className="chart-header">
                  <h2 className="chart-title">Quick Actions</h2>
                </div>
                <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
                  <Link href="/create" className="jh-btn jh-btn-primary">Generate Image</Link>
                  <Link href="/pricing" className="jh-btn jh-btn-secondary">Buy Credits</Link>
                  <Link href="/library" className="jh-btn jh-btn-secondary">My Library</Link>
                  <Link href="/analytics" className="jh-btn jh-btn-tertiary">Network Stats</Link>
                  <Link href="/run-a-node" className="jh-btn jh-btn-tertiary">Run a Node</Link>
                </div>
              </div>

              {/* Recent jobs */}
              <div className="chart-section">
                <div className="chart-header">
                  <h2 className="chart-title">Recent Jobs</h2>
                  <Link href="/library" style={{ color: "var(--accent)", fontSize: "0.85rem" }}>View all</Link>
                </div>
                {jobs.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
                    No jobs yet.{" "}
                    <Link href="/create" style={{ color: "var(--accent)" }}>Start generating</Link> to see your history here.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Model</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>HAI</th>
                          <th>Time</th>
                          <th>Output</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job) => (
                          <tr key={job.job_id}>
                            <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                              {job.job_id.slice(-8)}
                            </td>
                            <td style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {job.model}
                            </td>
                            <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {(job.task_type ?? "IMAGE").replace("_GEN", "")}
                            </td>
                            <td style={{ color: statusColor(job.status) }}>
                              {job.status}
                            </td>
                            <td>{job.reward != null ? job.reward.toFixed(4) : "--"}</td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                              {elapsed(job.submitted_at, job.completed_at ?? undefined)}
                            </td>
                            <td>
                              {job.image_url ? (
                                <a
                                  href={job.image_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "var(--accent)", fontSize: "0.82rem" }}
                                >
                                  View
                                </a>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>--</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment history */}
              {payments.length > 0 && (
                <div className="chart-section">
                  <div className="chart-header">
                    <h2 className="chart-title">Recent Payments</h2>
                    <Link href="/pricing" style={{ color: "var(--accent)", fontSize: "0.85rem" }}>Buy more</Link>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Credits</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.session_id}>
                          <td>{p.package_id}</td>
                          <td>{p.credits}</td>
                          <td style={{ color: p.status === "completed" ? "#8ff0b6" : "var(--text-muted)" }}>
                            {p.status}
                          </td>
                          <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                            {p.created_at
                              ? new Date(p.created_at * 1000).toLocaleDateString()
                              : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
};

export default DashboardPage;
