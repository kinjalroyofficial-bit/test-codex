import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const buildApiUrl = (path) => `${API_BASE_URL}${path}`;

const COLORS = {
  positive: "#16a34a",
  negative: "#dc2626",
  neutral: "#2563eb",
  accent: "#7c3aed",
  warning: "#f59e0b",
  surface: "rgba(15, 23, 42, 0.62)",
};

function SkeletonCard() {
  return <div className="analytics-skeleton" aria-hidden="true" />;
}

function MetricCard({ label, value, subtitle, tone = "neutral" }) {
  return (
    <article className={`analytics-metric-card tone-${tone}`}>
      <p>{label}</p>
      <h3>{value}</h3>
      {subtitle ? <small>{subtitle}</small> : null}
    </article>
  );
}

function ChartCard({ title, children, rightNode }) {
  return (
    <section className="analytics-card">
      <header>
        <h3>{title}</h3>
        {rightNode}
      </header>
      {children}
    </section>
  );
}

function pct(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export default function AnalyticsDashboard({ onBack }) {
  const [range, setRange] = useState("30d");
  const [analyticsMode, setAnalyticsMode] = useState("trends");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setError("");

      try {
        const effectiveRange = analyticsMode === "snapshot" ? "today" : range;
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        const response = await fetch(
          buildApiUrl(
            `/api/analytics?range=${effectiveRange}&tzOffsetMinutes=${timezoneOffsetMinutes}`
          ),
          {
            credentials: "include",
          }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load analytics");
        }

        setData(payload);
      } catch (fetchError) {
        setError(fetchError.message || "Failed to load analytics");
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [range, analyticsMode]);

  const snapshotBars = data
    ? [
        {
          day: "Today",
          registered: Number(data.summary.totalTasks || 0),
          completed: Number(data.summary.completedTasks || 0),
        },
      ]
    : [];

  if (isLoading) {
    return (
      <section className="analytics-page" aria-label="Analytics loading">
        <div className="analytics-head">
          <h2>Analytics Dashboard</h2>
        </div>
        <div className="analytics-kpis">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="analytics-page" aria-label="Analytics dashboard">
      <div className="analytics-head">
        <div>
          <h2>Analytics Dashboard</h2>
          <p>Deep insights into your execution, intent, mood, and outcomes.</p>
        </div>
        <div className="analytics-head-actions">
          <div className="analytics-filter-group">
            <button type="button" onClick={() => setAnalyticsMode("snapshot")} className={analyticsMode === "snapshot" ? "is-active" : ""}>Snapshot</button>
            <button type="button" onClick={() => setAnalyticsMode("trends")} className={analyticsMode === "trends" ? "is-active" : ""}>Trends</button>
          </div>
          {analyticsMode === "trends" ? (
            <div className="analytics-filter-group">
              <button type="button" onClick={() => setRange("today")} className={range === "today" ? "is-active" : ""}>Today</button>
              <button type="button" onClick={() => setRange("7d")} className={range === "7d" ? "is-active" : ""}>7 Days</button>
              <button type="button" onClick={() => setRange("30d")} className={range === "30d" ? "is-active" : ""}>30 Days</button>
              <button type="button" onClick={() => setRange("all")} className={range === "all" ? "is-active" : ""}>All Time</button>
            </div>
          ) : null}
          <button type="button" className="analytics-back-btn" onClick={onBack}>Back to board</button>
        </div>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {data ? (
        <>
          <div className="analytics-kpis">
            <MetricCard label="Task Completion Rate" value={pct(data.summary.completionRate)} subtitle={`${data.summary.completedTasks}/${data.summary.totalTasks}`} tone="positive" />
            <MetricCard label="Daily Task Velocity" value={data.summary.dailyTaskVelocity.toFixed(2)} subtitle="completed tasks/day" tone="neutral" />
            <MetricCard label="Backlog" value={`${data.summary.backlog}`} subtitle="pending tasks" tone="negative" />
          </div>

          {analyticsMode === "snapshot" ? (
            <ChartCard title="Today's Registered vs Completed">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={snapshotBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="registered" name="Registered Tasks" fill={COLORS.neutral} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="completed" name="Completed Tasks" fill={COLORS.positive} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="Tasks Completed Over Time">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.time.completedOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" name="Completed Tasks" stroke={COLORS.positive} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="registered" name="Registered Tasks" stroke={COLORS.neutral} strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      ) : null}
    </section>
  );
}
