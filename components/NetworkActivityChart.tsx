import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AnalyticsJobsResponse } from "../lib/havnai";

export function NetworkActivityChart({ days }: { days: AnalyticsJobsResponse["days"] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const latestDate = days.at(-1)?.date;
  useEffect(() => {
    if (chartRef.current) chartRef.current.scrollLeft = chartRef.current.scrollWidth;
  }, [latestDate]);
  const selected = days.find(day => day.date === selectedDate) ?? days.at(-1);
  const maximum = Math.max(0, ...days.map(day => day.count));
  if (!selected) return <p className="network-empty">No job activity was recorded in this period.</p>;

  return (
    <div className="network-activity">
      <div className="network-chart-reading" aria-live="polite">
        <span>{selected.date}</span><strong>{selected.count.toLocaleString()} jobs</strong>
        <span>{selected.success ?? 0} succeeded · {selected.failed ?? 0} failed</span>
      </div>
      <p className="network-chart-hint">Choose a day to explore its totals. Scroll to see more days.</p>
      <div className="network-chart-scroll" ref={chartRef} tabIndex={0} role="region" aria-label="Daily job chart. Choose a day for its totals.">
        <div style={{ minWidth: Math.max(260, days.length * 27) }}><div className="network-bars">
          {days.map(day => (
            <button key={day.date} className="network-bar" type="button"
              aria-label={`${day.date}: ${day.count} jobs, ${day.success ?? 0} succeeded, ${day.failed ?? 0} failed`}
              aria-pressed={selected.date === day.date} onClick={() => setSelectedDate(day.date)}
              style={{ "--bar-height": `${Math.max(0, day.count) / Math.max(1, maximum) * 100}%` } as CSSProperties}>
              <span aria-hidden="true" />
            </button>
          ))}
        </div><div className="network-chart-axis" aria-hidden="true"><span>{days[0].date}</span><span>Daily jobs · peak {maximum}</span><span>{days.at(-1)?.date}</span></div></div>
      </div>
      <details className="network-disclosure">
        <summary>View daily totals</summary>
        <div className="network-table" tabIndex={0} role="region" aria-label="Daily job totals">
          <table className="data-table"><thead><tr><th>Date</th><th>Total</th><th>Success</th><th>Failed</th><th>Rate</th></tr></thead>
            <tbody>{days.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.count}</td><td>{day.success ?? 0}</td><td>{day.failed ?? 0}</td><td>{day.count ? `${(((day.success ?? 0) / day.count) * 100).toFixed(0)}%` : "--"}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
