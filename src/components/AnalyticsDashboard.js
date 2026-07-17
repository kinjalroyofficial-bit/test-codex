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

function TaskTypeBreakdownCard({ counts }) {
  const safeCounts = {
    normal: Number(counts?.normal || 0),
    continuous: Number(counts?.continuous || 0),
    eventful: Number(counts?.eventful || 0),
  };
  const total = safeCounts.normal + safeCounts.continuous + safeCounts.eventful;
  const segments = [
    { key: "normal", label: "Normal", color: "#2563eb", count: safeCounts.normal },
    { key: "continuous", label: "Continuous", color: "#16a34a", count: safeCounts.continuous },
    { key: "eventful", label: "Eventful", color: "#f97316", count: safeCounts.eventful },
  ];

  return (
    <article className="analytics-metric-card task-type-breakdown-card">
      <p>Task Type Breakdown</p>
      <h3>{total}</h3>
      <div className="task-type-segment-bar" aria-hidden="true">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="task-type-segment"
            style={{
              background: segment.color,
              width: `${total ? (segment.count / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <div className="task-type-legend">
        {segments.map((segment) => (
          <span key={`legend-${segment.key}`} className="task-type-legend-item">
            <span
              className="task-type-legend-dot"
              style={{ background: segment.color }}
              aria-hidden="true"
            />
            {segment.label}: {segment.count}
          </span>
        ))}
      </div>
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

function minutesLabel(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function titleCase(value) {
  return `${value || "unknown"}`
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function InsightList({ items = [] }) {
  if (!items.length) return <p className="analytics-empty-note">Keep logging tasks to unlock stronger insights.</p>;
  return (
    <ul className="analytics-insights-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RankedBars({ items = [], labelKey, valueKey, valueFormatter = (value) => value }) {
  const maxValue = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  if (!items.length) return <p className="analytics-empty-note">No data yet.</p>;

  return (
    <div className="analytics-ranked-bars">
      {items.slice(0, 6).map((item) => {
        const value = Number(item[valueKey] || 0);
        return (
          <div className="analytics-ranked-row" key={`${item[labelKey]}-${value}`}>
            <span>{titleCase(item[labelKey])}</span>
            <div aria-hidden="true">
              <i style={{ width: `${(value / maxValue) * 100}%` }} />
            </div>
            <strong>{valueFormatter(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function StoredDataAudit() {
  const groups = [
    {
      title: "Task details",
      items: ["title", "description", "status", "created/updated/deleted time"],
    },
    {
      title: "Planning",
      items: ["scheduled time", "due date", "task type", "estimated duration"],
    },
    {
      title: "Reflection",
      items: ["actual time taken", "mood", "intent", "outcome"],
    },
    {
      title: "Context",
      items: ["categories", "custom categories", "user identity", "active session"],
    },
  ];

  return (
    <ChartCard title="Data used for these dashboards">
      <div className="analytics-data-audit">
        {groups.map((group) => (
          <article key={group.title}>
            <h4>{group.title}</h4>
            <p>{group.items.join(" / ")}</p>
          </article>
        ))}
      </div>
    </ChartCard>
  );
}

export default function AnalyticsDashboard({ onBack }) {
  const [range, setRange] = useState("30d");
  const [analyticsMode, setAnalyticsMode] = useState("trends");
  const [snapshotDate, setSnapshotDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [snapshotMetrics, setSnapshotMetrics] = useState(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setError("");

      try {
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        if (analyticsMode === "snapshot") {
          const response = await fetch(
            buildApiUrl(
              `/api/tasks?date=${snapshotDate}&tzOffsetMinutes=${timezoneOffsetMinutes}`
            ),
            { credentials: "include" }
          );
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || "Failed to load snapshot");
          }
          const tasks = payload?.tasks || [];
          const registered = tasks.length;
          const completed = tasks.filter((task) => task.status === "done").length;
          const backlog = Math.max(0, registered - completed);
          const taskTypeCounts = tasks.reduce(
            (acc, task) => {
              const taskType = `${task?.task_type || "normal"}`.toLowerCase();
              if (taskType === "continuous" || taskType === "eventful") {
                acc[taskType] += 1;
              } else {
                acc.normal += 1;
              }
              return acc;
            },
            { normal: 0, continuous: 0, eventful: 0 }
          );
          setSnapshotMetrics({
            registered,
            completed,
            backlog,
            completionRate: registered ? completed / registered : 0,
            dailyTaskVelocity: completed,
            taskTypeCounts,
            totalEstimatedMinutes: tasks.reduce(
              (sum, task) => sum + Number(task.estimated_duration_minutes || 0),
              0
            ),
            totalActualMinutes: tasks.reduce(
              (sum, task) => sum + Number(task.time_taken_minutes || 0),
              0
            ),
            intentDistribution: Object.entries(
              tasks.reduce((acc, task) => {
                const key = task.intent || "unknown";
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {})
            ).map(([intent, count]) => ({ intent, count })),
            moodDistribution: Object.entries(
              tasks.reduce((acc, task) => {
                const key = task.mood || "unknown";
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {})
            ).map(([mood, count]) => ({ mood, count })),
            outcomeDistribution: Object.entries(
              tasks.reduce((acc, task) => {
                const key = task.outcome || "unknown";
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {})
            ).map(([outcome, count]) => ({ outcome, count })),
            categoryDistribution: Object.values(
              tasks.reduce((acc, task) => {
                (task.categories || []).forEach((category) => {
                  if (!acc[category.name]) {
                    acc[category.name] = { category: category.name, count: 0 };
                  }
                  acc[category.name].count += 1;
                });
                return acc;
              }, {})
            ),
          });
          setData(null);
          return;
        }

        const response = await fetch(
          buildApiUrl(`/api/analytics?range=${range}&tzOffsetMinutes=${timezoneOffsetMinutes}`),
          {
            credentials: "include",
          }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load analytics");
        }

        setData(payload);
        setSnapshotMetrics(null);
      } catch (fetchError) {
        setError(fetchError.message || "Failed to load analytics");
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [range, analyticsMode, snapshotDate]);

  const snapshotBars = snapshotMetrics
    ? [
        {
          day: snapshotDate,
          registered: Number(snapshotMetrics.registered || 0),
          completed: Number(snapshotMetrics.completed || 0),
        },
      ]
    : [];
  const taskTypeCounts =
    analyticsMode === "snapshot"
      ? snapshotMetrics?.taskTypeCounts || { normal: 0, continuous: 0, eventful: 0 }
      : data?.taskType?.counts || { normal: 0, continuous: 0, eventful: 0 };

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
          {analyticsMode === "snapshot" ? (
            <div className="analytics-filter-group">
              <input
                type="date"
                value={snapshotDate}
                onChange={(event) => setSnapshotDate(event.target.value)}
                aria-label="Select snapshot date"
              />
            </div>
          ) : null}
          {analyticsMode === "trends" ? (
            <div className="analytics-filter-group">
              <button type="button" onClick={() => setRange("7d")} className={range === "7d" ? "is-active" : ""}>7 Days</button>
              <button type="button" onClick={() => setRange("30d")} className={range === "30d" ? "is-active" : ""}>30 Days</button>
              <button type="button" onClick={() => setRange("all")} className={range === "all" ? "is-active" : ""}>All Time</button>
            </div>
          ) : null}
          <button type="button" className="analytics-back-btn" onClick={onBack}>Back to board</button>
        </div>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {(analyticsMode === "snapshot" ? snapshotMetrics : data) ? (
        <>
          <div className="analytics-kpis">
            <MetricCard
              label="Task Completion Rate"
              value={pct(
                analyticsMode === "snapshot"
                  ? snapshotMetrics.completionRate
                  : data.summary.completionRate
              )}
              subtitle={
                analyticsMode === "snapshot"
                  ? `${snapshotMetrics.completed}/${snapshotMetrics.registered}`
                  : `${data.summary.completedTasks}/${data.summary.totalTasks}`
              }
              tone="positive"
            />
            <MetricCard
              label="Daily Task Velocity"
              value={
                analyticsMode === "snapshot"
                  ? Number(snapshotMetrics.dailyTaskVelocity || 0).toFixed(2)
                  : data.summary.dailyTaskVelocity.toFixed(2)
              }
              subtitle="completed tasks/day"
              tone="neutral"
            />
            <MetricCard
              label="Backlog"
              value={`${
                analyticsMode === "snapshot" ? snapshotMetrics.backlog : data.summary.backlog
              }`}
              subtitle="pending tasks"
              tone="negative"
            />
            <MetricCard
              label="No Registration Days"
              value={`${
                analyticsMode === "snapshot"
                  ? snapshotMetrics.registered === 0
                    ? 1
                    : 0
                  : data.summary.noRegistrationDays || 0
              }`}
              subtitle="days without any registered tasks"
              tone="warning"
            />
            <TaskTypeBreakdownCard counts={taskTypeCounts} />
          </div>

          {analyticsMode === "snapshot" ? (
            <>
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
              <div className="analytics-grid two-col">
                <ChartCard title="Today's Intent Mix">
                  <RankedBars items={snapshotMetrics.intentDistribution} labelKey="intent" valueKey="count" />
                </ChartCard>
                <ChartCard title="Today's Mood and Outcome Signals">
                  <div className="analytics-signal-grid">
                    <div>
                      <h4>Mood</h4>
                      <RankedBars items={snapshotMetrics.moodDistribution} labelKey="mood" valueKey="count" />
                    </div>
                    <div>
                      <h4>Outcome</h4>
                      <RankedBars items={snapshotMetrics.outcomeDistribution} labelKey="outcome" valueKey="count" />
                    </div>
                  </div>
                </ChartCard>
                <ChartCard title="Today's Category Coverage">
                  <RankedBars items={snapshotMetrics.categoryDistribution} labelKey="category" valueKey="count" />
                </ChartCard>
                <ChartCard title="Today's Planning Load">
                  <div className="analytics-metric-strip">
                    <MetricCard
                      label="Estimated"
                      value={minutesLabel(snapshotMetrics.totalEstimatedMinutes)}
                      subtitle="planned time"
                    />
                    <MetricCard
                      label="Actual"
                      value={minutesLabel(snapshotMetrics.totalActualMinutes)}
                      subtitle="logged time"
                    />
                  </div>
                </ChartCard>
              </div>
              <StoredDataAudit />
            </>
          ) : (
            <>
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
              <div className="analytics-kpis">
                <MetricCard
                  label="Productivity Score"
                  value={`${Math.round(Number(data.summary.productivityScore || 0))}`}
                  subtitle="completion + intent + outcome"
                  tone="positive"
                />
                <MetricCard
                  label="On-Time Completion"
                  value={pct(data.summary.onTimeCompletionRate)}
                  subtitle="done by due date"
                  tone="neutral"
                />
                <MetricCard
                  label="Time Logged"
                  value={minutesLabel(data.time.totalTimeSpentMinutes)}
                  subtitle={`${minutesLabel(data.time.productiveTimeSpentMinutes)} productive`}
                  tone="neutral"
                />
                <MetricCard
                  label="Planning Accuracy"
                  value={pct(data.time.estimationAccuracyRatio)}
                  subtitle="actual / estimated"
                  tone="warning"
                />
                <MetricCard
                  label="Positive Outcome Rate"
                  value={pct(data.outcome.positiveOutcomeRate)}
                  subtitle={`${pct(data.outcome.productivePositiveRate)} for productive tasks`}
                  tone="positive"
                />
                <MetricCard
                  label="Current Streak"
                  value={`${data.scheduling.streakDays || 0}`}
                  subtitle="registration days"
                  tone="neutral"
                />
              </div>
              <div className="analytics-grid two-col">
                <ChartCard title="Estimated vs Actual Time">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.time.estimatedVsActualPerDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => minutesLabel(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="estimated" name="Estimated Minutes" stroke={COLORS.warning} strokeWidth={2.5} />
                      <Line type="monotone" dataKey="actual" name="Actual Minutes" stroke={COLORS.accent} strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Category Time Investment">
                  <RankedBars
                    items={data.category.timeSpentPerCategory}
                    labelKey="category"
                    valueKey="minutes"
                    valueFormatter={minutesLabel}
                  />
                </ChartCard>
                <ChartCard title="Intent Mix">
                  <RankedBars items={data.intent.distribution} labelKey="intent" valueKey="count" />
                </ChartCard>
                <ChartCard title="Mood Completion Rate">
                  <RankedBars
                    items={data.mood.completionRateByMood}
                    labelKey="mood"
                    valueKey="completionRate"
                    valueFormatter={pct}
                  />
                </ChartCard>
                <ChartCard title="Outcome Distribution">
                  <RankedBars items={data.outcome.distribution} labelKey="outcome" valueKey="count" />
                </ChartCard>
                <ChartCard title="Best Time of Day">
                  <RankedBars
                    items={data.scheduling.productivityByTimeOfDay}
                    labelKey="timeOfDay"
                    valueKey="completed"
                  />
                  <p className="analytics-inline-insight">
                    Procrastination signal: {pct(data.scheduling.procrastinationScore)}
                  </p>
                </ChartCard>
              </div>
              <div className="analytics-grid two-col">
                <ChartCard title="Mood x Outcome Map">
                  <div className="analytics-heatmap">
                    {data.mood.heatmap.slice(0, 10).map((row) => (
                      <div className="analytics-heatmap-row" key={`${row.mood}-${row.outcome}`}>
                        <span>{titleCase(row.mood)}</span>
                        <span>{titleCase(row.outcome)}</span>
                        <strong>{row.count}</strong>
                      </div>
                    ))}
                  </div>
                </ChartCard>
                <ChartCard title="Useful Observations">
                  <InsightList items={data.insights} />
                </ChartCard>
              </div>
              <StoredDataAudit />
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
