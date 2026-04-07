import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#06b6d4"];

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

function formatMinutesLabel(minutesValue) {
  const minutes = Math.max(0, Number(minutesValue) || 0);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} hr ${mins} mins`;
}

export default function AnalyticsDashboard({ onBack }) {
  const [range, setRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setError("");

      try {
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        const response = await fetch(
          buildApiUrl(
            `/api/analytics?range=${range}&tzOffsetMinutes=${timezoneOffsetMinutes}`
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
  }, [range]);

  const intentInsight = useMemo(() => {
    if (!data?.intent?.highlights) return "";
    return `You spend ${pct(data.intent.highlights.productive)} time in productive work.`;
  }, [data]);

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
            <button type="button" onClick={() => setRange("7d")} className={range === "7d" ? "is-active" : ""}>7 Days</button>
            <button type="button" onClick={() => setRange("30d")} className={range === "30d" ? "is-active" : ""}>30 Days</button>
            <button type="button" onClick={() => setRange("all")} className={range === "all" ? "is-active" : ""}>All Time</button>
          </div>
          <button type="button" className="analytics-back-btn" onClick={onBack}>Back to board</button>
        </div>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {data ? (
        <>
          <div className="analytics-kpis">
            <MetricCard label="Task Completion Rate" value={pct(data.summary.completionRate)} subtitle={`${data.summary.completedTasks}/${data.summary.totalTasks}`} tone="positive" />
            <MetricCard label="On-Time Completion" value={pct(data.summary.onTimeCompletionRate)} tone="neutral" />
            <MetricCard label="Productivity Score" value={`${Math.round(data.summary.productivityScore)} / 100`} tone="positive" />
            <MetricCard label="Time Efficiency" value={pct(data.summary.timeEfficiency)} subtitle="actual / estimated" tone="neutral" />
            <MetricCard label="Daily Task Velocity" value={data.summary.dailyTaskVelocity.toFixed(2)} subtitle="completed tasks/day" tone="neutral" />
            <MetricCard label="Backlog" value={`${data.summary.backlog}`} subtitle="pending tasks" tone="negative" />
          </div>

          <div className="analytics-grid two-col">
            <ChartCard title="Tasks Completed Over Time">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.time.completedOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="completed" stroke={COLORS.positive} strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Estimated vs Actual Time (avg/day)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.time.estimatedVsActualPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="estimated" fill={COLORS.neutral} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="actual" fill={COLORS.warning} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="analytics-metric-strip">
            <MetricCard label="Estimation Accuracy Ratio" value={pct(data.time.estimationAccuracyRatio)} tone="neutral" />
            <MetricCard label="Total Time Spent" value={formatMinutesLabel(data.time.totalTimeSpentMinutes)} tone="neutral" />
            <MetricCard label="Productive Time" value={formatMinutesLabel(data.time.productiveTimeSpentMinutes)} tone="positive" />
          </div>

          <div className="analytics-grid two-col">
            <ChartCard title="Intent Distribution">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.intent.distribution} dataKey="count" nameKey="intent" outerRadius={95}>
                    {data.intent.distribution.map((entry, index) => (
                      <Cell key={entry.intent} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Intent Highlights" rightNode={<span className="analytics-insight-tag">Insight</span>}>
              <div className="analytics-highlight-list">
                <p>Productive: {pct(data.intent.highlights.productive)}</p>
                <p>Leisure: {pct(data.intent.highlights.leisure)}</p>
                <p>Escapism: {pct(data.intent.highlights.escapism)}</p>
                <p>Harmful: {pct(data.intent.highlights.harmful)}</p>
              </div>
              <p className="analytics-inline-insight">{intentInsight}</p>
            </ChartCard>
          </div>

          <div className="analytics-grid two-col">
            <ChartCard title="Mood Distribution">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.mood.distribution} dataKey="count" nameKey="mood" outerRadius={95}>
                    {data.mood.distribution.map((entry, index) => (
                      <Cell key={entry.mood} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Completion Rate by Mood">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.mood.completionRateByMood}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mood" />
                  <YAxis />
                  <Tooltip formatter={(value) => pct(value)} />
                  <Bar dataKey="completionRate" fill={COLORS.accent} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Mood vs Outcome Heatmap">
            <div className="analytics-heatmap">
              {data.mood.heatmap.map((row) => (
                <div className="analytics-heatmap-row" key={`${row.mood}-${row.outcome}`}>
                  <span>{row.mood}</span>
                  <span>{row.outcome}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          </ChartCard>

          <div className="analytics-grid two-col">
            <ChartCard title="Outcome Distribution">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.outcome.distribution} dataKey="count" nameKey="outcome" outerRadius={95}>
                    {data.outcome.distribution.map((entry, index) => (
                      <Cell key={entry.outcome} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Outcome Metrics" rightNode={<span className="analytics-insight-tag">Insight</span>}>
              <div className="analytics-highlight-list">
                <p>Positive Outcome Rate: {pct(data.outcome.positiveOutcomeRate)}</p>
                <p>Negative Outcome Rate: {pct(data.outcome.negativeOutcomeRate)}</p>
                <p>{pct(data.outcome.productivePositiveRate)} of productive tasks ended positive</p>
              </div>
            </ChartCard>
          </div>

          <div className="analytics-grid two-col">
            <ChartCard title="Time Spent Per Category">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.category.timeSpentPerCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="minutes" fill={COLORS.neutral} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Task Distribution by Category">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.category.taskDistribution} dataKey="count" nameKey="category" outerRadius={95}>
                    {data.category.taskDistribution.map((entry, index) => (
                      <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="analytics-grid two-col">
            <ChartCard title="Productivity by Time of Day">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.scheduling.productivityByTimeOfDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeOfDay" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="completed" fill={COLORS.positive} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Consistency">
              <div className="analytics-highlight-list">
                <p>Procrastination Score: {pct(data.scheduling.procrastinationScore)}</p>
                <p>Current Streak: {data.scheduling.streakDays} days</p>
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Advanced Insights">
            <ul className="analytics-insights-list">
              {data.insights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </ChartCard>
        </>
      ) : null}
    </section>
  );
}
