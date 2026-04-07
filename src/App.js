import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import AnalyticsDashboard from "./components/AnalyticsDashboard";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const buildApiUrl = (path) => `${API_BASE_URL}${path}`;
const DAY_PART_BACKGROUND_IMAGE_NAMES = {
  morning: "morning-background.webp",
  afternoon: "afternoon-background.webp",
  evening: "evening-background.webp",
  night: "night-background.webp",
};

const getDayPart = (hour) => {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
};

const getDayPartGreeting = (dayPart) => {
  if (dayPart === "morning") return "Good morning";
  if (dayPart === "afternoon") return "Good afternoon";
  if (dayPart === "evening") return "Good evening";
  return "Good night";
};

const getDayPartBackgroundUrl = (dayPart) =>
  `${process.env.PUBLIC_URL || ""}/${DAY_PART_BACKGROUND_IMAGE_NAMES[dayPart]}`;
const CREATE_TASK_MODAL_BACKGROUND_URL = `${
  process.env.PUBLIC_URL || ""
}/create-task-bg.webp`;

const getOutcomeCue = (outcome) => {
  if (outcome === "positive") return "🙂";
  if (outcome === "negative") return "🙁";
  if (outcome === "neutral") return "😐";
  return null;
};

const getSeededUnit = (seed) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
};

const MOOD_OPTIONS = [
  { value: "energetic", label: "Energetic", icon: "🤩" },
  { value: "happy", label: "Happy", icon: "😊" },
  { value: "neutral", label: "Neutral", icon: "😐" },
  { value: "tired", label: "Tired", icon: "🥱" },
  { value: "stressed", label: "Stressed", icon: "😣" },
  { value: "depressed", label: "Depressed", icon: "😞" },
];

const INTENT_OPTIONS = [
  { value: "productive", label: "Productive" },
  { value: "maintenance", label: "Maintenance" },
  { value: "leisure", label: "Leisure" },
  { value: "escapism", label: "Escapism" },
  { value: "compulsive", label: "Compulsive" },
  { value: "harmful", label: "Harmful" },
];

const OUTCOME_OPTIONS = [
  { value: "positive", label: "👍" },
  { value: "neutral", label: "😐" },
  { value: "negative", label: "👎" },
];

const CATEGORY_COLORS = {
  entertainment: "#2563eb",
  "financial enrichment": "#16a34a",
  "mental enrichment": "#dc2626",
  operational: "#5b21b6",
  "self developement": "#166534",
  "social enrichment": "#db2777",
  wellness: "#06b6d4",
  custom: "#64748b",
};

const DEFAULT_CATEGORY_COLOR = "#64748b";
const DEFAULT_CATEGORY_VECTOR = "M12 7v10m5-5H7";

const CATEGORY_VECTORS = {
  entertainment:
    "M8 6v12l10-6-10-6Z",
  "financial enrichment":
    "M5 18h14M8 14v-4m4 4V6m4 8v-6",
  "mental enrichment":
    "M12 4a5 5 0 0 0-5 5c0 1.8.9 3.3 2.2 4.2.5.4.8 1 .8 1.6V16h4v-1.2c0-.6.3-1.2.8-1.6A5 5 0 0 0 17 9a5 5 0 0 0-5-5Zm-2 14h4",
  operational:
    "M19.4 13a7.9 7.9 0 0 0 .1-2l2-1.6-2-3.4-2.4 1a8.2 8.2 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a8.2 8.2 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 .1 2l-2 1.6 2 3.4 2.4-1a8.2 8.2 0 0 0 1.7 1l.3 2.6h4l.3-2.6a8.2 8.2 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6ZM12 14.5A2.5 2.5 0 1 1 12 9a2.5 2.5 0 0 1 0 5.5Z",
  "self developement":
    "M12 19V5m0 0 5 5m-5-5-5 5",
  "social enrichment":
    "M16 17v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1m13-7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  wellness:
    "M12 20s-6.5-4.2-8.5-8.3C1.9 8.5 4.1 5 7.5 5c1.9 0 3.2 1 4.5 2.6C13.3 6 14.6 5 16.5 5 19.9 5 22 8.5 20.5 11.7 18.5 15.8 12 20 12 20Z",
};

const normalizeCategoryName = (name) => `${name || ""}`.trim().toLowerCase();

const hexToRgb = (hex) => {
  const normalized = `${hex}`.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  const parsed = Number.parseInt(fullHex, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
    )
    .join("")}`;

const getCategoryColor = (name) =>
  CATEGORY_COLORS[normalizeCategoryName(name)] || DEFAULT_CATEGORY_COLOR;

const blendCategoryColors = (colors) => {
  if (!colors.length) return DEFAULT_CATEGORY_COLOR;
  const sum = colors.reduce(
    (accumulator, color) => {
      const rgb = hexToRgb(color);
      return {
        r: accumulator.r + rgb.r,
        g: accumulator.g + rgb.g,
        b: accumulator.b + rgb.b,
      };
    },
    { r: 0, g: 0, b: 0 }
  );
  return rgbToHex({
    r: sum.r / colors.length,
    g: sum.g / colors.length,
    b: sum.b / colors.length,
  });
};

const getReadableTextColor = (backgroundHex) => {
  const { r, g, b } = hexToRgb(backgroundHex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#111827" : "#ffffff";
};

const softenColor = (hex, factor = 0.45) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r + (255 - r) * factor,
    g: g + (255 - g) * factor,
    b: b + (255 - b) * factor,
  });
};

async function parseApiResponse(response) {
  const rawBody = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!rawBody) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody);
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    if (!response.ok) {
      throw new Error(
        `Request failed with status ${response.status}. API returned non-JSON content.`
      );
    }

    throw new Error("API returned non-JSON content");
  }
}

function LoginScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitLabel = mode === "login" ? "Sign in" : "Create account";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        buildApiUrl(mode === "login" ? "/api/auth/login" : "/api/auth/register"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: mode === "register" ? name : undefined,
            email,
            password,
          }),
        }
      );

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Authentication failed");
      }

      onAuthSuccess(data.user);
    } catch (submitError) {
      setError(submitError.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Login form">
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>Sign in to access the Personal task manager.</p>

        <div className="auth-toggle" role="tablist" aria-label="Login switch">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "is-active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "is-active" : ""}
            onClick={() => setMode("register")}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                required
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              minLength={6}
              required
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : submitLabel}
          </button>
        </form>
      </section>
    </main>
  );
}

function BoardScreen({ user, onLogout, theme, onToggleTheme }) {
  const [cards, setCards] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [boardError, setBoardError] = useState("");
  const [boardNotice, setBoardNotice] = useState("");
  const [activeView, setActiveView] = useState("board");
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("create");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskTitleInput, setTaskTitleInput] = useState("");
  const [taskDescriptionInput, setTaskDescriptionInput] = useState("");
  const [taskScheduledInput, setTaskScheduledInput] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const nowDate = new Date();
    const year = nowDate.getFullYear();
    const month = String(nowDate.getMonth() + 1).padStart(2, "0");
    const day = String(nowDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [taskMoodInput, setTaskMoodInput] = useState("neutral");
  const [taskIntentInput, setTaskIntentInput] = useState("productive");
  const [taskOutcomeInput, setTaskOutcomeInput] = useState("");
  const [taskEstimatedDurationInput, setTaskEstimatedDurationInput] = useState("");
  const [taskTimeTakenInput, setTaskTimeTakenInput] = useState("");
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [customCategoryNames, setCustomCategoryNames] = useState([]);
  const [isCustomCategoryModalOpen, setIsCustomCategoryModalOpen] = useState(false);
  const [customCategoryNameInput, setCustomCategoryNameInput] = useState("");
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [isReplicateModalOpen, setIsReplicateModalOpen] = useState(false);
  const [replicateSourceTask, setReplicateSourceTask] = useState(null);
  const [replicateDateInput, setReplicateDateInput] = useState("");
  const [replicateTimeInput, setReplicateTimeInput] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isTaskModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isTaskModalOpen]);

  const formatTimeAgo = (timestamp) => {
    const diffMs = now - (timestamp || now);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return "just now";
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
    return `${Math.floor(diffMs / day)}d ago`;
  };

  const toDateTimeInputValue = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
  };

  const formatScheduledDate = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleString();
  };

  const formatSelectedDate = (dateString) =>
    new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const moveSelectedDateByDays = (dayOffset) => {
    setSelectedDate((currentDate) => {
      const [year, month, day] = currentDate.split("-").map(Number);
      const baseDate = new Date(year, month - 1, day);
      baseDate.setDate(baseDate.getDate() + dayOffset);
      const nextYear = baseDate.getFullYear();
      const nextMonth = String(baseDate.getMonth() + 1).padStart(2, "0");
      const nextDay = String(baseDate.getDate()).padStart(2, "0");
      return `${nextYear}-${nextMonth}-${nextDay}`;
    });
  };

  useEffect(() => {
    const loadTasks = async () => {
      setBoardError("");
      setIsLoadingTasks(true);

      try {
        const response = await fetch(buildApiUrl(`/api/tasks?date=${selectedDate}`), {
          credentials: "include",
        });
        const data = await parseApiResponse(response);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load tasks");
        }

        const nextCards = (data?.tasks || []).map((task) => ({
          id: task.id,
          createdAt: task.created_at ? new Date(task.created_at).getTime() : Date.now(),
          title: task.title,
          description: task.description || "",
          scheduledFor: task.scheduled_for || null,
          mood: task.mood || "neutral",
          intent: task.intent || "productive",
          outcome: task.outcome || null,
          estimatedDurationMinutes: task.estimated_duration_minutes || null,
          timeTakenMinutes: task.time_taken_minutes || null,
          categories: task.categories || [],
          done: task.status === "done",
        }));

        setCards(nextCards);
      } catch (error) {
        setBoardError(error.message || "Failed to load tasks");
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
  }, [selectedDate, user?.id]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/categories"), {
          credentials: "include",
        });
        const data = await parseApiResponse(response);
        if (!response.ok) return;
        setAvailableCategories(data?.categories || []);
      } catch (error) {
        setAvailableCategories([]);
      }
    };

    loadCategories();
  }, [user?.id]);

  const toggleStatus = async (cardId) => {
    const currentCard = cards.find((card) => card.id === cardId);
    if (!currentCard) return;

    const nextDone = !currentCard.done;
    setBoardError("");

    try {
      const response = await fetch(buildApiUrl(`/api/tasks/${cardId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextDone ? "done" : "todo" }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update task");
      }

      const updatedTask = data?.task;
      setCards((currentCards) =>
        currentCards.map((card) =>
          card.id === cardId
            ? {
                ...card,
                title: updatedTask?.title || card.title,
                description: updatedTask?.description || "",
                scheduledFor: updatedTask?.scheduled_for || card.scheduledFor || null,
                mood: updatedTask?.mood || card.mood || "neutral",
                intent: updatedTask?.intent || card.intent || "productive",
                outcome: updatedTask?.outcome || card.outcome || null,
                estimatedDurationMinutes:
                  updatedTask?.estimated_duration_minutes || card.estimatedDurationMinutes || null,
                timeTakenMinutes:
                  updatedTask?.time_taken_minutes || card.timeTakenMinutes || null,
                categories: updatedTask?.categories || card.categories || [],
                done: (updatedTask?.status || "todo") === "done",
              }
            : card
        )
      );
    } catch (error) {
      setBoardError(error.message || "Failed to update task");
    }
  };

  const handleDelete = async (cardId) => {
    setBoardError("");

    try {
      const response = await fetch(buildApiUrl(`/api/tasks/${cardId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete task");
      }

      setCards((currentCards) => currentCards.filter((card) => card.id !== cardId));
    } catch (error) {
      setBoardError(error.message || "Failed to delete task");
    }

  };

  const openCreateTaskModal = () => {
    setTaskModalMode("create");
    setActiveTaskId(null);
    setTaskTitleInput("");
    setTaskDescriptionInput("");
    setTaskScheduledInput("");
    setTaskMoodInput("neutral");
    setTaskIntentInput("productive");
    setTaskOutcomeInput("");
    setTaskEstimatedDurationInput("");
    setTaskTimeTakenInput("");
    setSelectedCategoryIds([]);
    setCustomCategoryNames([]);
    setIsCustomCategoryModalOpen(false);
    setCustomCategoryNameInput("");
    setBoardError("");
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (card) => {
    setTaskModalMode("edit");
    setActiveTaskId(card.id);
    setTaskTitleInput(card.title);
    setTaskDescriptionInput(card.description || "");
    setTaskScheduledInput(toDateTimeInputValue(card.scheduledFor));
    setTaskMoodInput(card.mood || "neutral");
    setTaskIntentInput(card.intent || "productive");
    setTaskOutcomeInput(card.outcome || "");
    setTaskEstimatedDurationInput(
      card.estimatedDurationMinutes ? String(card.estimatedDurationMinutes) : ""
    );
    setTaskTimeTakenInput(card.timeTakenMinutes ? String(card.timeTakenMinutes) : "");
    setSelectedCategoryIds((card.categories || []).map((category) => category.id));
    setCustomCategoryNames([]);
    setIsCustomCategoryModalOpen(false);
    setCustomCategoryNameInput("");
    setBoardError("");
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setActiveTaskId(null);
    setTaskTitleInput("");
    setTaskDescriptionInput("");
    setTaskScheduledInput("");
    setTaskMoodInput("neutral");
    setTaskIntentInput("productive");
    setTaskOutcomeInput("");
    setTaskEstimatedDurationInput("");
    setTaskTimeTakenInput("");
    setSelectedCategoryIds([]);
    setCustomCategoryNames([]);
    setIsCustomCategoryModalOpen(false);
    setCustomCategoryNameInput("");
  };

  const toDateInputValue = (timestamp) => {
    if (!timestamp) return selectedDate;
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toTimeInputValue = (timestamp) => {
    if (!timestamp) return "09:00";
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const openReplicateModal = (card) => {
    setReplicateSourceTask(card);
    setReplicateDateInput(toDateInputValue(card.scheduledFor));
    setReplicateTimeInput(toTimeInputValue(card.scheduledFor));
    setBoardError("");
    setBoardNotice("");
    setIsReplicateModalOpen(true);
  };

  const closeReplicateModal = () => {
    setIsReplicateModalOpen(false);
    setReplicateSourceTask(null);
    setReplicateDateInput("");
    setReplicateTimeInput("");
  };

  const handleReplicateSubmit = async (event) => {
    event.preventDefault();
    if (!replicateSourceTask) return;
    if (!replicateDateInput || !replicateTimeInput) {
      setBoardError("Target date and time are required for replication.");
      return;
    }

    const scheduledForValue = new Date(
      `${replicateDateInput}T${replicateTimeInput}:00`
    ).toISOString();

    setBoardError("");
    setBoardNotice("");

    try {
      const response = await fetch(buildApiUrl("/api/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: replicateSourceTask.title,
          description: replicateSourceTask.description || null,
          status: "todo",
          mood: null,
          intent: replicateSourceTask.intent || "productive",
          outcome: null,
          categoryIds: (replicateSourceTask.categories || []).map((category) => category.id),
          scheduledFor: scheduledForValue,
          scheduled_for: scheduledForValue,
          estimatedDurationMinutes: replicateSourceTask.estimatedDurationMinutes || null,
          estimated_duration_minutes: replicateSourceTask.estimatedDurationMinutes || null,
          timeTakenMinutes: null,
          time_taken_minutes: null,
        }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to replicate task");
      }

      const replicatedTask = data?.task;
      mergeAvailableCategories(replicatedTask?.categories || []);
      const replicatedDate = replicateDateInput;
      if (replicatedDate === selectedDate) {
        const nextCard = {
          id: replicatedTask?.id || Date.now(),
          createdAt: replicatedTask?.created_at
            ? new Date(replicatedTask.created_at).getTime()
            : Date.now(),
          title: replicatedTask?.title || replicateSourceTask.title,
          description: replicatedTask?.description || "",
          scheduledFor: replicatedTask?.scheduled_for || scheduledForValue,
          mood: replicatedTask?.mood || null,
          intent: replicatedTask?.intent || replicateSourceTask.intent || "productive",
          outcome: replicatedTask?.outcome || null,
          estimatedDurationMinutes:
            replicatedTask?.estimated_duration_minutes ||
            replicateSourceTask.estimatedDurationMinutes ||
            null,
          timeTakenMinutes: null,
          categories: replicatedTask?.categories || replicateSourceTask.categories || [],
          done: false,
        };
        setCards((currentCards) => [nextCard, ...currentCards]);
      }

      setBoardNotice("Task replicated successfully.");
      closeReplicateModal();
    } catch (error) {
      setBoardError(error.message || "Failed to replicate task");
    }
  };

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategoryIds((currentIds) =>
      currentIds.includes(categoryId)
        ? currentIds.filter((id) => id !== categoryId)
        : [...currentIds, categoryId]
    );
  };

  const openCustomCategoryModal = () => {
    setCustomCategoryNameInput("");
    setIsCustomCategoryModalOpen(true);
  };

  const submitCustomCategory = () => {
    const normalizedName = customCategoryNameInput.trim();
    if (!normalizedName) return;
    setCustomCategoryNames((current) =>
      current.includes(normalizedName) ? current : [...current, normalizedName]
    );
    setCustomCategoryNameInput("");
    setIsCustomCategoryModalOpen(false);
  };

  const removeCustomCategory = (name) => {
    setCustomCategoryNames((current) => current.filter((item) => item !== name));
  };

  const mergeAvailableCategories = (categories) => {
    setAvailableCategories((currentCategories) => {
      const nextMap = new Map(currentCategories.map((item) => [item.id, item]));
      (categories || []).forEach((category) => {
        if (category?.id) {
          nextMap.set(category.id, category);
        }
      });
      return [...nextMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleTaskModalSubmit = async (event) => {
    event.preventDefault();
    const trimmedTitle = taskTitleInput.trim();
    const trimmedDescription = taskDescriptionInput.trim();
    const scheduledForValue = taskScheduledInput
      ? new Date(taskScheduledInput).toISOString()
      : null;
    const estimatedDurationValue = taskEstimatedDurationInput
      ? Number(taskEstimatedDurationInput)
      : null;
    const timeTakenValue = taskTimeTakenInput ? Number(taskTimeTakenInput) : null;

    if (!trimmedTitle) return;

    setBoardError("");

    try {
      const customNames = customCategoryNames.map((name) => name.trim()).filter(Boolean);

      if (taskModalMode === "create") {
        const response = await fetch(buildApiUrl("/api/tasks"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: trimmedTitle,
            description: trimmedDescription || null,
            status: "todo",
            mood: taskMoodInput,
            intent: taskIntentInput,
            outcome: taskOutcomeInput || null,
            categoryIds: selectedCategoryIds,
            customCategories: customNames,
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
            estimatedDurationMinutes: estimatedDurationValue,
            estimated_duration_minutes: estimatedDurationValue,
            timeTakenMinutes: timeTakenValue,
            time_taken_minutes: timeTakenValue,
          }),
        });
        const data = await parseApiResponse(response);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to create task");
        }

        const createdTask = data?.task;
        mergeAvailableCategories(createdTask?.categories || []);
        const nextCard = {
          id: createdTask?.id || Date.now(),
          createdAt: createdTask?.created_at
            ? new Date(createdTask.created_at).getTime()
            : Date.now(),
          title: createdTask?.title || trimmedTitle,
          description: createdTask?.description || "",
          scheduledFor: createdTask?.scheduled_for || scheduledForValue,
          mood: createdTask?.mood || taskMoodInput,
          intent: createdTask?.intent || taskIntentInput,
          outcome: createdTask?.outcome || taskOutcomeInput || null,
          estimatedDurationMinutes:
            createdTask?.estimated_duration_minutes || estimatedDurationValue || null,
          timeTakenMinutes: createdTask?.time_taken_minutes || timeTakenValue || null,
          categories: createdTask?.categories || [],
          done: (createdTask?.status || "todo") === "done",
        };

        setCards((currentCards) => [nextCard, ...currentCards]);
      } else {
        const response = await fetch(buildApiUrl(`/api/tasks/${activeTaskId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: trimmedTitle,
            description: trimmedDescription,
            mood: taskMoodInput,
            intent: taskIntentInput,
            outcome: taskOutcomeInput || null,
            categoryIds: selectedCategoryIds,
            customCategories: customNames,
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
            estimatedDurationMinutes: estimatedDurationValue,
            estimated_duration_minutes: estimatedDurationValue,
            timeTakenMinutes: timeTakenValue,
            time_taken_minutes: timeTakenValue,
          }),
        });
        const data = await parseApiResponse(response);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to save task");
        }

        const updatedTask = data?.task;
        mergeAvailableCategories(updatedTask?.categories || []);
        setCards((currentCards) =>
          currentCards.map((card) =>
            card.id === activeTaskId
              ? {
                  ...card,
                  title: updatedTask?.title || trimmedTitle,
                  description: updatedTask?.description || "",
                  scheduledFor: updatedTask?.scheduled_for || scheduledForValue,
                  mood: updatedTask?.mood || taskMoodInput,
                  intent: updatedTask?.intent || taskIntentInput,
                  outcome: updatedTask?.outcome || taskOutcomeInput || null,
                  estimatedDurationMinutes:
                    updatedTask?.estimated_duration_minutes || estimatedDurationValue || null,
                  timeTakenMinutes: updatedTask?.time_taken_minutes || timeTakenValue || null,
                  categories: updatedTask?.categories || card.categories || [],
                  done: (updatedTask?.status || "todo") === "done",
                }
              : card
          )
        );
      }

      closeTaskModal();
    } catch (error) {
      setBoardError(error.message || "Failed to save task");
    }
  };

  const visibleCards = useMemo(() => {
    const filteredCards = cards.filter((card) => {
      if (statusFilter === "completed") return card.done;
      if (statusFilter === "pending") return !card.done;
      return true;
    });
    const categoryFilteredCards =
      categoryFilter === "all"
        ? filteredCards
        : filteredCards.filter((card) =>
            (card.categories || []).some((category) => category.id === categoryFilter)
          );

    const sortedCards = [...categoryFilteredCards];

    if (sortBy === "alphabetical") {
      sortedCards.sort((a, b) => a.title.localeCompare(b.title));
      return sortedCards;
    }

    if (sortBy === "priority") {
      return sortedCards;
    }

    sortedCards.sort(
      (a, b) => (b.createdAt || b.id || 0) - (a.createdAt || a.id || 0)
    );
    return sortedCards;
  }, [cards, sortBy, statusFilter, categoryFilter]);

  const categoryStats = useMemo(() => {
    const stats = {};
    cards.forEach((card) => {
      (card.categories || []).forEach((category) => {
        if (!stats[category.id]) {
          stats[category.id] = {
            id: category.id,
            name: category.name,
            color: getCategoryColor(category.name),
            cardCount: 0,
            totalTimeMinutes: 0,
          };
        }
        stats[category.id].cardCount += 1;
        stats[category.id].totalTimeMinutes += Number(card.timeTakenMinutes || 0);
      });
    });
    return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);
  const totalCategoryMinutes = useMemo(
    () => categoryStats.reduce((sum, category) => sum + Number(category.totalTimeMinutes || 0), 0),
    [categoryStats]
  );

  const buildCardBackground = (card) => {
    const categoryColors = (card.categories || []).map((category) =>
      getCategoryColor(category.name)
    );
    if (!categoryColors.length) {
      return card.done ? "#ecfdf5" : "#ffffff";
    }
    if (categoryColors.length === 1) return categoryColors[0];

    const stop = 100 / categoryColors.length;
    const segments = categoryColors
      .map((color, index) => {
        const start = Math.round(index * stop);
        const end = Math.round((index + 1) * stop);
        return `${color} ${start}% ${end}%`;
      })
      .join(", ");
    return `linear-gradient(135deg, ${segments})`;
  };

  const getCardStyle = (card) => {
    const mixedColor = blendCategoryColors(
      (card.categories || []).map((category) => getCategoryColor(category.name))
    );
    return {
      background: buildCardBackground(card),
      borderColor: mixedColor,
    };
  };

  const handleCardDragStart = (cardId) => {
    setDraggedCardId(cardId);
    if (sortBy !== "priority") {
      setSortBy("priority");
    }
  };

  const handleCardDrop = (targetCardId) => {
    if (!draggedCardId || draggedCardId === targetCardId) {
      setDraggedCardId(null);
      return;
    }

    setCards((currentCards) => {
      const currentIndex = currentCards.findIndex((card) => card.id === draggedCardId);
      const targetIndex = currentCards.findIndex((card) => card.id === targetCardId);
      if (currentIndex < 0 || targetIndex < 0) return currentCards;
      const reorderedCards = [...currentCards];
      const [draggedCard] = reorderedCards.splice(currentIndex, 1);
      reorderedCards.splice(targetIndex, 0, draggedCard);
      return reorderedCards;
    });
    setDraggedCardId(null);
  };

  const firstName = (user?.full_name || "").trim().split(/\s+/)[0] || "there";
  const selectedMoodIndex = Math.max(
    0,
    MOOD_OPTIONS.findIndex((option) => option.value === taskMoodInput)
  );
  const localHour = new Date(now).getHours();
  const greeting = getDayPartGreeting(getDayPart(localHour));

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__topbar">
          <div>
            <h1>
              {greeting}, {firstName}.
            </h1>
            <p>Track the latest updates with quick Done/Not Done toggles.</p>
          </div>
          <div className="user-panel">
            <div className="header-menu" role="navigation" aria-label="Header actions">
              <button
                type="button"
                className="analytics-link"
                onClick={() =>
                  setActiveView((currentView) =>
                    currentView === "board" ? "analytics" : "board"
                  )
                }
              >
                {activeView === "board" ? "Analytics" : "Board"}
              </button>
              <button type="button" className="logout-btn" onClick={onLogout}>
                Logout
              </button>
            </div>

            <label className="theme-switch" aria-label="Toggle theme">
              <input
                type="checkbox"
                checked={theme === "light"}
                onChange={onToggleTheme}
              />
              <span className="theme-slider">
                <div className="moons-hole">
                  <div className="moon-hole" />
                  <div className="moon-hole" />
                  <div className="moon-hole" />
                </div>
                <div className="black-clouds">
                  <div className="black-cloud" />
                  <div className="black-cloud" />
                  <div className="black-cloud" />
                </div>
                <div className="clouds">
                  <div className="cloud" />
                  <div className="cloud" />
                  <div className="cloud" />
                  <div className="cloud" />
                  <div className="cloud" />
                  <div className="cloud" />
                  <div className="cloud" />
                </div>
                <div className="stars">
                  <svg className="star" viewBox="0 0 20 20">
                    <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
                  </svg>
                  <svg className="star" viewBox="0 0 20 20">
                    <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
                  </svg>
                  <svg className="star" viewBox="0 0 20 20">
                    <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
                  </svg>
                  <svg className="star" viewBox="0 0 20 20">
                    <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
                  </svg>
                  <svg className="star" viewBox="0 0 20 20">
                    <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
                  </svg>
                </div>
              </span>
            </label>
          </div>
        </div>

        {activeView === "board" ? (
          <>
            <div className="task-toolbar">
          <button type="button" className="create-task-btn" onClick={openCreateTaskModal}>
            Create new task
          </button>
          <div className="board-date-controls" aria-label="Task date controls">
            <button
              type="button"
              className="date-nav-btn"
              onClick={() => moveSelectedDateByDays(-1)}
            >
              Previous day
            </button>
            <div className="board-date-display">
              <p>Showing tasks for</p>
              <strong>{formatSelectedDate(selectedDate)}</strong>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="board-date-input"
              aria-label="Select task date"
            />
            <button
              type="button"
              className="date-nav-btn"
              onClick={() => moveSelectedDateByDays(1)}
            >
              Next day
            </button>
          </div>

          <div className="controls-row">
            <div className="filter-pill">
              <span className="filter-pill-label">Status:</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Status"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="filter-pill">
              <span className="filter-pill-label">Sort By:</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                aria-label="Sort by"
              >
                <option value="created">Created time</option>
                <option value="priority">Priority (later)</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>
        <div className="category-filter-row" aria-label="Category filters">
          <button
            type="button"
            className={categoryFilter === "all" ? "category-filter-chip is-active" : "category-filter-chip"}
            onClick={() => setCategoryFilter("all")}
          >
            <span>All</span>
            <small>
              {cards.length} tasks · {totalCategoryMinutes} min
            </small>
          </button>
          {categoryStats.map((category) => (
            <button
              key={category.id}
              type="button"
              className={
                categoryFilter === category.id
                  ? "category-filter-chip is-active"
                  : "category-filter-chip"
              }
              style={{
                borderColor: category.color,
                backgroundColor: category.color,
                color: getReadableTextColor(category.color),
              }}
              onClick={() => setCategoryFilter(category.id)}
            >
              <span>{category.name}</span>
              <small>
                {category.cardCount} tasks · {category.totalTimeMinutes} min
              </small>
            </button>
          ))}
        </div>
        {boardError ? <p className="auth-error">{boardError}</p> : null}
        {boardNotice ? <p className="board-success">{boardNotice}</p> : null}
          </>
        ) : null}
      </header>

      {activeView === "analytics" ? (
        <AnalyticsDashboard onBack={() => setActiveView("board")} />
      ) : (
        <>
          <section className="cards-grid" aria-label="Task cards">
        {isLoadingTasks ? <p>Loading tasks...</p> : null}
        {visibleCards.map((card) => {
          return (
            <article
              className={`task-card ${card.done ? "is-done-card" : ""} ${
                draggedCardId === card.id ? "is-dragging" : ""
              }`}
              key={card.id}
              style={getCardStyle(card)}
              draggable
              onDragStart={() => handleCardDragStart(card.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleCardDrop(card.id)}
              onDragEnd={() => setDraggedCardId(null)}
            >
              <div className="card-header">
                <div className="card-title-group">
                  <h2>{card.title}</h2>
                  <div className="card-meta-row">
                    <span className={`status-text ${card.done ? "is-done" : "not-done"}`}>
                      {card.done ? "Done" : "Not Done"}
                    </span>
                    <button
                      type="button"
                      className="replicate-btn"
                      onClick={() => openReplicateModal(card)}
                    >
                      Replicate
                    </button>
                  </div>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="delete-cross"
                    aria-label={`Delete ${card.title}`}
                    onClick={() => handleDelete(card.id)}
                  >
                    ×
                  </button>
                  <span className="task-age task-age-top">{formatTimeAgo(card.createdAt)}</span>
                </div>
              </div>

              <p className="task-description">{card.description}</p>
              {card.categories?.length ? (
                <div className="task-card-band-vectors" aria-hidden="true">
                  {card.categories.map((category, index) => {
                    const color = getCategoryColor(category.name);
                    const baseSeed = `${card.id}-${category.id}-${index}`;
                    const randomTop = 14 + getSeededUnit(`${baseSeed}-top`) * 64;
                    const randomLeft = 10 + getSeededUnit(`${baseSeed}-left`) * 74;
                    const randomRotate = -20 + getSeededUnit(`${baseSeed}-rot`) * 40;
                    return (
                      <span
                        key={`vector-${card.id}-${category.id}`}
                        className="task-card-band-vector"
                        style={{
                          top: `${randomTop}%`,
                          left: `${randomLeft}%`,
                          color: softenColor(color, 0.72),
                          transform: `translate(-50%, -50%) rotate(${randomRotate}deg)`,
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <path
                            d={CATEGORY_VECTORS[normalizeCategoryName(category.name)] || DEFAULT_CATEGORY_VECTOR}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {card.categories?.length ? (
                <div className="task-category-tags">
                  {card.categories.map((category) => (
                    <span className="task-category-tag" key={`${card.id}-${category.id}`}>
                      {category.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="task-attributes">
                <span className="task-attribute-item">
                  <strong>Mood:</strong> {card.mood || "neutral"}
                </span>
                <span className="task-attributes-separator">•</span>
                <span className="task-attribute-item">
                  <strong>Intent:</strong> {card.intent || "productive"}
                </span>
              </p>
              {card.scheduledFor ? <div className="task-detail-divider" /> : null}
              {card.scheduledFor ? (
                <p className="task-schedule">
                  Scheduled: <strong>{formatScheduledDate(card.scheduledFor)}</strong>
                </p>
              ) : null}
              {card.estimatedDurationMinutes || card.timeTakenMinutes ? (
                <div className="task-metrics-row">
                  <div className="task-metric-box">
                    <span>Est. duration</span>
                    <strong>{card.estimatedDurationMinutes ? `${card.estimatedDurationMinutes} min` : "—"}</strong>
                  </div>
                  <div className="task-metric-box">
                    <span>Completion</span>
                    <strong>{card.timeTakenMinutes ? `${card.timeTakenMinutes} min` : "—"}</strong>
                  </div>
                </div>
              ) : null}

              <div className="status-row">
                <div className="container">
                  <label className="switch" aria-label={`Toggle ${card.title} status`}>
                    <input
                      className="togglesw"
                      type="checkbox"
                      checked={card.done}
                      onChange={() => toggleStatus(card.id)}
                    />
                    <div className="indicator left" />
                    <div className="indicator right" />
                    <div className="button" />
                  </label>
                </div>

                <button
                  type="button"
                  className="edit-btn card-edit-btn"
                  onClick={() => openEditTaskModal(card)}
                >
                  Edit task
                </button>
              </div>
              {getOutcomeCue(card.outcome) ? (
                <span className="task-outcome-emoji" aria-hidden="true">
                  {getOutcomeCue(card.outcome)}
                </span>
              ) : null}
            </article>
          );
        })}
          </section>

          {isTaskModalOpen ? (
            <div className="task-modal-overlay" role="dialog" aria-modal="true">
          <div
            className="task-modal"
            style={{
              "--task-modal-background-image": `url("${CREATE_TASK_MODAL_BACKGROUND_URL}")`,
            }}
          >
            <button
              type="button"
              className="task-modal-close"
              aria-label="Close task form"
              onClick={closeTaskModal}
            >
              ×
            </button>
            <h3>{taskModalMode === "create" ? "Create task" : "Edit task"}</h3>
            <form onSubmit={handleTaskModalSubmit} className="task-modal-form">
              <section className="task-form-section section-basic">
                <h4>Basic Details</h4>
                <label>
                  Task title
                  <input
                    type="text"
                    value={taskTitleInput}
                    onChange={(event) => setTaskTitleInput(event.target.value)}
                    placeholder="Enter task title"
                    required
                  />
                </label>
                <label>
                  Task description
                  <textarea
                    value={taskDescriptionInput}
                    onChange={(event) => setTaskDescriptionInput(event.target.value)}
                    placeholder="Optional description"
                    rows={2}
                  />
                </label>
              </section>
              <section className="task-form-section">
                <h4>Value Addition</h4>
                <label>
                  Categories
                  <div className="category-chip-picker">
                    {availableCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={
                          selectedCategoryIds.includes(category.id)
                            ? "category-chip is-selected"
                            : "category-chip"
                        }
                        onClick={() => toggleCategorySelection(category.id)}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                  <div className="category-chip-picker">
                    {customCategoryNames.map((name) => (
                      <button
                        key={`custom-${name}`}
                        type="button"
                        className="category-chip is-selected"
                        onClick={() => removeCustomCategory(name)}
                        title="Tap to remove custom category"
                      >
                        {name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="category-chip category-chip-custom"
                      onClick={openCustomCategoryModal}
                    >
                      + Custom
                    </button>
                  </div>
                </label>
                <label>
                  Intent
                  <select
                    value={taskIntentInput}
                    onChange={(event) => setTaskIntentInput(event.target.value)}
                  >
                    {INTENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              <section className="task-form-section">
                <h4>Timelines</h4>
                <div className="task-attributes-row task-attributes-row-timelines">
                  <label>
                    Scheduled
                    <input
                      type="datetime-local"
                      value={taskScheduledInput}
                      onChange={(event) => setTaskScheduledInput(event.target.value)}
                    />
                  </label>
                  <label>
                    Estimated duration (minutes)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={taskEstimatedDurationInput}
                      onChange={(event) => setTaskEstimatedDurationInput(event.target.value)}
                      placeholder="e.g. 90"
                    />
                  </label>
                </div>
              </section>
              <section className="task-form-section section-mood">
                <h4>Mood During Activity</h4>
                <fieldset className="task-mood-fieldset">
                  <legend>Mood</legend>
                  <div className="mood-simple-slider">
                    <input
                      type="range"
                      min="0"
                      max={MOOD_OPTIONS.length - 1}
                      step="1"
                      value={selectedMoodIndex}
                      onChange={(event) => {
                        const moodIndex = Number(event.target.value);
                        setTaskMoodInput(MOOD_OPTIONS[moodIndex]?.value || "neutral");
                      }}
                      aria-label="Mood"
                    />
                    <div className="mood-simple-labels" aria-hidden="true">
                      {MOOD_OPTIONS.map((option) => (
                        <span
                          key={option.value}
                          className={
                            taskMoodInput === option.value
                              ? "mood-simple-label is-selected"
                              : "mood-simple-label"
                          }
                        >
                          <span className="mood-icon">{option.icon}</span>
                          <span>{option.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </fieldset>
              </section>
              <section className="task-form-section">
                <h4>Completion</h4>
                <div className="task-attributes-row task-attributes-row-completion">
                  <label>
                    Time taken to complete (minutes)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={taskTimeTakenInput}
                      onChange={(event) => setTaskTimeTakenInput(event.target.value)}
                      placeholder="e.g. 120"
                    />
                  </label>
                  <label>
                    Outcome
                    <div className="outcome-options">
                      {OUTCOME_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={
                            taskOutcomeInput === option.value
                              ? "outcome-option is-selected"
                              : "outcome-option"
                          }
                          onClick={() => setTaskOutcomeInput(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              </section>
              <div className="task-modal-actions">
                <button type="button" onClick={closeTaskModal}>
                  Cancel
                </button>
                <button type="submit">Submit</button>
              </div>
            </form>
            {isCustomCategoryModalOpen ? (
              <div className="inline-modal-backdrop" role="dialog" aria-modal="true">
                <div className="inline-modal">
                  <h5>Add custom category</h5>
                  <input
                    type="text"
                    value={customCategoryNameInput}
                    onChange={(event) => setCustomCategoryNameInput(event.target.value)}
                    placeholder="Category name"
                  />
                  <div className="inline-modal-actions">
                    <button type="button" onClick={() => setIsCustomCategoryModalOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" onClick={submitCustomCategory}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
            </div>
          ) : null}

          {isReplicateModalOpen ? (
            <div className="task-modal-overlay" role="dialog" aria-modal="true">
              <div className="task-modal replicate-modal">
                <button
                  type="button"
                  className="task-modal-close"
                  aria-label="Close replicate form"
                  onClick={closeReplicateModal}
                >
                  ×
                </button>
                <h3>Replicate task</h3>
                <form onSubmit={handleReplicateSubmit} className="replicate-form">
                  <p className="replicate-source-title">{replicateSourceTask?.title}</p>
                  <label>
                    Target Date
                    <input
                      type="date"
                      value={replicateDateInput}
                      onChange={(event) => setReplicateDateInput(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Target Time
                    <input
                      type="time"
                      value={replicateTimeInput}
                      onChange={(event) => setReplicateTimeInput(event.target.value)}
                      required
                    />
                  </label>
                  <div className="task-modal-actions">
                    <button type="button" onClick={closeReplicateModal}>
                      Cancel
                    </button>
                    <button type="submit">Replicate task</button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("taskTheme") || "dark");
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const timer = setInterval(() => setCurrentHour(new Date().getHours()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("taskTheme", theme);
  }, [theme]);

  useEffect(() => {
    const dayPart = getDayPart(currentHour);
    document.body.style.setProperty(
      "--morning-background-image",
      `url("${getDayPartBackgroundUrl(dayPart)}")`
    );
    document.body.classList.add("morning-background");
    return () => {
      document.body.style.removeProperty("--morning-background-image");
      document.body.classList.remove("morning-background");
    };
  }, [currentHour]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), {
          credentials: "include",
        });

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = await parseApiResponse(response);
        setUser(data.user || null);
      } catch (error) {
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    loadSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Checking session...</h1>
          <p>Please wait.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen onAuthSuccess={setUser} />;
  }

  return (
    <BoardScreen
      user={user}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={() =>
        setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))
      }
    />
  );
}

export default App;
