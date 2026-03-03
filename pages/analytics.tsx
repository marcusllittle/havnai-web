import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { WalletButton } from "../components/WalletButton";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsJobs,
  fetchAnalyticsCosts,
  fetchAnalyticsRewards,
  AnalyticsOverview,
  AnalyticsJobsResponse,
  AnalyticsCostsResponse,
  AnalyticsRewardsResponse,
} from "../lib/havnai";

const AnalyticsPage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [jobs, setJobs] = useState<AnalyticsJobsResponse | null>(null);
  const [costs, setCosts] = useState<AnalyticsCostsResponse | null>(null);
  const [rewards, setRewards] = useState<AnalyticsRewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchAnalyticsOverview().catch(() => null),
      fetchAnalyticsJobs(days).catch(() => null),
      fetchAnalyticsCosts(days).catch(() => null),
      fetchAnalyticsRewards().catch(() => null),
    ]).then(([ov, jb, cs, rw]) => {
      if (!active) return;
      setOverview(ov);
      setJobs(jb);
      setCosts(cs);
      setRewards(rw);
      setLoading(false);
    });
    return () => { active = false; };
  }, [days]);

  return (
    <>
      <Head><title>HavnAI Analytics</title></Head>
      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Public Beta</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button type="button" className={`nav-toggle ${navOpen ? "nav-open" : ""}`} aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
            <span /><span />
          </button>
          <nav className={`nav-links ${navOpen ? "nav-open" : ""}`} onClick={() => setNavOpen(false)}>
            <a href="/#home">Home</a>
            <a href="/generator">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics" className="nav-active">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="/join" className="nav-primary">Join</a>
            <WalletButton />
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Analytics</p>
            <h1 className="hero-title">Network Dashboard</h1>
            <p className="hero-subtitle">Job statistics, costs, and reward breakdowns across the HavnAI network.</p>
          </div>
        </section>

        <section className="page-container">
          {/* Time range selector */}
          <div className="library-filters" style={{ marginBottom: "1.5rem" }}>
            <div className="library-filter-group">
              <span className="library-filter-label">Period</span>
              {([7, 14, 30, 90] as number[]).map((d) => (
                <button key={d} type="button" className={`library-chip ${days === d ? "is-active" : ""}`} onClick={() => setDays(d)}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="library-loading">Loading analytics...</p>}

          {!loading && overview && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Jobs</div>
                <div className="stat-value">{(overview.total_jobs ?? 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Jobs Today</div>
                <div className="stat-value">{(overview.jobs_today ?? 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Success Rate</div>
                <div className="stat-value">{(overview.success_rate ?? 0).toFixed(1)}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Nodes</div>
                <div className="stat-value">{overview.active_nodes ?? overview.online_nodes ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total HAI Distributed</div>
                <div className="stat-value">{(overview.total_rewards ?? 0).toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Credits Spent</div>
                <div className="stat-value">{(overview.total_credits_spent ?? 0).toFixed(1)}</div>
              </div>
            </div>
          )}

          {/* Jobs over time */}
          {!loading && jobs && Array.isArray(jobs.days) && jobs.days.length > 0 && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Jobs Over Time</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.days.slice(-14).map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.count}</td>
                      <td style={{ color: "#8ff0b6" }}>{d.success ?? 0}</td>
                      <td style={{ color: "#ffb3b3" }}>{d.failed ?? 0}</td>
                      <td>{d.count ? (((d.success ?? 0) / d.count) * 100).toFixed(0) + "%" : "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Jobs by model */}
          {!loading && jobs && jobs.by_model.length > 0 && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Jobs by Model</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Model</th><th>Jobs</th></tr>
                </thead>
                <tbody>
                  {jobs.by_model.map((m) => (
                    <tr key={m.model}><td>{m.model}</td><td>{m.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cost breakdown */}
          {!loading && costs && Array.isArray(costs.by_model) && costs.by_model.length > 0 && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Cost Breakdown by Model</h3>
                <span className="stat-sub">Total: {(costs.total_spent ?? 0).toFixed(1)} credits</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Model</th><th>Jobs</th><th>Credits Spent</th></tr>
                </thead>
                <tbody>
                  {costs.by_model.map((m) => (
                    <tr key={m.model}>
                      <td>{m.model}</td>
                      <td>{m.job_count}</td>
                      <td>{(m.total_cost ?? 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rewards by node */}
          {!loading && rewards && Array.isArray(rewards.by_node) && rewards.by_node.length > 0 && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Rewards by Node</h3>
                <span className="stat-sub">Total: {(rewards.total ?? 0).toFixed(4)} HAI</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Node</th><th>Jobs</th><th>HAI Earned</th></tr>
                </thead>
                <tbody>
                  {rewards.by_node.map((n) => (
                    <tr key={n.node_id}>
                      <td>{n.node_name || n.node_id}</td>
                      <td>{n.count}</td>
                      <td>{(n.total ?? 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default AnalyticsPage;
