import type { NextPage } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { SeoHead } from "../components/SeoHead";
import { NetworkNavigation } from "../components/NetworkNavigation";
import { SiteHeader } from "../components/SiteHeader";
import { NetworkActivityChart } from "../components/NetworkActivityChart";
import {
  fetchAnalyticsOverview, fetchAnalyticsJobs, fetchAnalyticsCosts, fetchAnalyticsRewards,
  type AnalyticsOverview, type AnalyticsJobsResponse, type AnalyticsCostsResponse, type AnalyticsRewardsResponse,
} from "../lib/havnai";

const AnalyticsPage: NextPage = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [jobs, setJobs] = useState<AnalyticsJobsResponse | null>(null);
  const [costs, setCosts] = useState<AnalyticsCostsResponse | null>(null);
  const [rewards, setRewards] = useState<AnalyticsRewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true); setUnavailable([]);
    Promise.all([
      fetchAnalyticsOverview(controller.signal).catch(() => null),
      fetchAnalyticsJobs(days, controller.signal).catch(() => null),
      fetchAnalyticsCosts(days, controller.signal).catch(() => null),
      fetchAnalyticsRewards(controller.signal).catch(() => null),
    ]).then(([ov, jb, cs, rw]) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setOverview(ov); setJobs(jb); setCosts(cs); setRewards(rw);
      setUnavailable([!ov && "network overview", !jb && "job activity", !cs && "credit usage", !rw && "tracked rewards"].filter(Boolean) as string[]);
      setLoading(false);
    });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [days, refreshKey]);

  const jobDays = [...(jobs?.days ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const jobModels = [...(jobs?.by_model ?? [])].sort((a, b) => b.count - a.count);
  const modelMaximum = Math.max(1, ...jobModels.map(model => model.count));
  const stats = overview ? [
    ["Total jobs", overview.total_jobs?.toLocaleString() ?? "--"],
    ["Jobs today", overview.jobs_today?.toLocaleString() ?? "--"],
    ["Success rate", overview.success_rate == null ? "--" : `${overview.success_rate.toFixed(1)}%`],
    ["Active nodes", overview.active_nodes ?? overview.online_nodes ?? "--"],
    ["Tracked HAI", overview.total_rewards?.toFixed(2) ?? "--"],
    ["Credits spent", overview.total_credits_spent?.toFixed(1) ?? "--"],
  ] : [];

  return <>
    <SeoHead title="Network analytics" description="Inspect Public Alpha job volume, credit activity, and reward tracking across the HavnAI network." path="/analytics" noindex />
    <SiteHeader />
    <main className="network-page">
      <header className="network-heading">
        <div><span className="network-eyebrow"><Activity size={15} aria-hidden="true" /> Network analytics</span><h1>Creation, in numbers.</h1><p>Follow the jobs, capacity, and credit activity behind HavnAI.</p></div>
        <Link className="network-primary" href="/nodes">Explore the network <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      <NetworkNavigation active="analytics" />
      {loading ? <div className="network-empty" role="status">Loading network analytics...</div> : <>
        {unavailable.length > 0 && <div className="network-notice" role="alert"><p>We could not load {unavailable.join(", ")}. Available reports are shown below.</p><button className="network-secondary" onClick={() => setRefreshKey(value => value + 1)}>Retry analytics</button></div>}
        {overview && <section aria-labelledby="network-overview"><div className="network-section-heading"><h2 id="network-overview">Network overview</h2><span>All-time totals, except jobs today and active nodes</span></div><div className="network-stats">{stats.map(([label, value]) => <div className="network-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>}
      </>}
      <div className="network-section-heading network-period"><div><h2>Activity reports</h2><p>The selected period applies to jobs and credit usage.</p></div><div className="network-tabs" aria-label="Report period">{[7, 14, 30, 90].map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{value} days</button>)}</div></div>
      {!loading && <>
        {jobs && <section className="network-panel" aria-labelledby="job-activity"><div className="network-section-heading"><h2 id="job-activity">Jobs over time</h2><span>Last {days} days</span></div><NetworkActivityChart days={jobDays} /></section>}
        <div className="network-report-grid">
          {jobs && <section className="network-panel" aria-labelledby="jobs-model"><div className="network-section-heading"><h2 id="jobs-model">Jobs by model</h2><span>Last {days} days</span></div>{jobModels.length ? <ul className="network-models">{jobModels.map(model => <li key={model.model}><div><span>{model.model}</span><strong>{model.count.toLocaleString()}</strong></div><div className="network-meter" aria-hidden="true"><span style={{width: `${model.count / modelMaximum * 100}%`}} /></div></li>)}</ul> : <p className="network-empty">No model activity recorded in this period.</p>}</section>}
          {costs && <section className="network-panel" aria-labelledby="credit-usage"><div className="network-section-heading"><h2 id="credit-usage">Credit usage</h2><span>{(costs.total_spent ?? 0).toFixed(1)} credits / {days} days</span></div><p className="network-caption">Usage reported for the configured site wallet.</p>{costs.by_model?.length ? <div className="network-table" tabIndex={0} role="region" aria-label="Credit usage by model"><table className="data-table"><thead><tr><th>Model</th><th>Jobs</th><th>Credits</th></tr></thead><tbody>{costs.by_model.map(model => <tr key={model.model}><td>{model.model}</td><td>{model.job_count}</td><td>{(model.total_cost ?? 0).toFixed(1)}</td></tr>)}</tbody></table></div> : <p className="network-empty">No credit usage recorded in this period.</p>}</section>}
        </div>
        {rewards && <section className="network-panel" aria-labelledby="network-rewards"><div className="network-section-heading"><h2 id="network-rewards">Tracked rewards by node</h2><span>Last 30 days / {(rewards.total ?? 0).toFixed(4)} HAI</span></div>{rewards.by_node?.length ? <div className="network-table" tabIndex={0} role="region" aria-label="Reward details table"><table className="data-table"><thead><tr><th>Node</th><th>Jobs</th><th>HAI earned</th></tr></thead><tbody>{rewards.by_node.map(node => <tr key={node.node_id}><td>{node.node_name || node.node_id}</td><td>{node.count}</td><td>{(node.total ?? 0).toFixed(4)}</td></tr>)}</tbody></table></div> : <p className="network-empty">No tracked rewards recorded yet.</p>}</section>}
      </>}
      <p className="network-footnote">Public Alpha metrics are reported by the coordinator. HAI totals may include Sepolia and testnet activity.</p>
    </main>
  </>;
};
export default AnalyticsPage;
