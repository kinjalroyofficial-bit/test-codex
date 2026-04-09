import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  if (!Number.isFinite(hour)) return "morning";
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
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

const getOutcomeCue = (outcome) => {
  if (outcome === "positive") return "🙂";
  if (outcome === "negative") return "🙁";
  if (outcome === "neutral") return "😐";
  return null;
};

const formatTaskTypeLabel = (taskType) => {
  if (taskType === "eventful") return "Eventful";
  if (taskType === "continuous") return "Continuous";
  return "Normal";
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

const TASK_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "eventful", label: "Eventful" },
  { value: "continuous", label: "Continuous" },
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
const getCategoryIdentityKey = (category) => {
  if (category?.id !== undefined && category?.id !== null) return `id:${category.id}`;
  const normalizedName = normalizeCategoryName(category?.name);
  return normalizedName ? `name:${normalizedName}` : "";
};
const dedupeCategories = (categories = []) => {
  const seenKeys = new Set();
  const deduped = [];
  categories.forEach((category) => {
    const key = getCategoryIdentityKey(category);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    deduped.push(category);
  });
  return deduped;
};

const hslToHex = (h, s, l) => {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (huePrime >= 0 && huePrime < 1) {
    r = chroma;
    g = x;
  } else if (huePrime < 2) {
    r = x;
    g = chroma;
  } else if (huePrime < 3) {
    g = chroma;
    b = x;
  } else if (huePrime < 4) {
    g = x;
    b = chroma;
  } else if (huePrime < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const match = lightness - chroma / 2;
  const toHex = (channel) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getGeneratedCategoryColor = (name) => {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) return DEFAULT_CATEGORY_COLOR;

  let hash = 0;
  for (let index = 0; index < normalizedName.length; index += 1) {
    hash = (hash << 5) - hash + normalizedName.charCodeAt(index);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 70, 52);
};

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

const getCategoryColor = (name) => {
  const normalizedName = normalizeCategoryName(name);
  return CATEGORY_COLORS[normalizedName] || getGeneratedCategoryColor(normalizedName);
};

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
  const [sortBy, setSortBy] = useState("scheduled");
  const [boardError, setBoardError] = useState("");
  const [boardNotice, setBoardNotice] = useState("");
  const [activeView, setActiveView] = useState("board");
  const [boardLayoutMode, setBoardLayoutMode] = useState("board");
  const [previousDayCards, setPreviousDayCards] = useState([]);
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
  const [isTaskMoodTouched, setIsTaskMoodTouched] = useState(false);
  const [taskTypeInput, setTaskTypeInput] = useState("normal");
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
  const [replicateRepeatDaysInput, setReplicateRepeatDaysInput] = useState("");
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionTask, setCompletionTask] = useState(null);
  const [completionMoodInput, setCompletionMoodInput] = useState("neutral");
  const [completionTimeInput, setCompletionTimeInput] = useState("");
  const [completionOutcomeInput, setCompletionOutcomeInput] = useState("");
  const [isDescriptionVoiceActive, setIsDescriptionVoiceActive] = useState(false);
  const [isTitleVoiceActive, setIsTitleVoiceActive] = useState(false);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const dateInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const descriptionTextareaRef = useRef(null);
  const categoryFilterScrollRef = useRef(null);
  const touchDropTargetIdRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechBaseDescriptionRef = useRef("");
  const speechCommittedTranscriptRef = useRef("");
  const shouldKeepListeningRef = useRef(false);
  const titleSpeechRecognitionRef = useRef(null);
  const titleSpeechBaseRef = useRef("");
  const titleSpeechCommittedRef = useRef("");
  const titleShouldKeepListeningRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateViewportMode = () => setIsMobileViewport(window.innerWidth <= 768);
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (!isTaskModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isTaskModalOpen]);

  useEffect(
    () => () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (titleSpeechRecognitionRef.current) {
        titleSpeechRecognitionRef.current.stop();
      }
    },
    []
  );

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

  const formatMinutesLabel = (minutesValue) => {
    const minutes = Math.max(0, Number(minutesValue) || 0);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} hr ${mins} mins`;
  };

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

  const shiftDateString = (dateString, dayOffset) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + dayOffset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  };

  const openInlineDatePicker = () => {
    const dateInput = dateInputRef.current;
    if (!dateInput) return;

    if (typeof dateInput.showPicker === "function") {
      dateInput.showPicker();
      return;
    }

    dateInput.focus();
    dateInput.click();
  };

  useEffect(() => {
    const loadTasks = async () => {
      setBoardError("");
      setIsLoadingTasks(true);

      try {
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        const response = await fetch(
          buildApiUrl(
            `/api/tasks?date=${selectedDate}&tzOffsetMinutes=${timezoneOffsetMinutes}`
          ),
          {
          credentials: "include",
          }
        );
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
          taskType: task.task_type || "normal",
          mood: task.mood || null,
          intent: task.intent || "productive",
          outcome: task.outcome || null,
          estimatedDurationMinutes: task.estimated_duration_minutes || null,
          timeTakenMinutes: task.time_taken_minutes || null,
          categories: dedupeCategories(task.categories || []),
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
    const loadPreviousDayTasks = async () => {
      if (boardLayoutMode !== "timeline") return;

      try {
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        const previousDate = shiftDateString(selectedDate, -1);
        const response = await fetch(
          buildApiUrl(
            `/api/tasks?date=${previousDate}&tzOffsetMinutes=${timezoneOffsetMinutes}`
          ),
          { credentials: "include" }
        );
        const data = await parseApiResponse(response);
        if (!response.ok) return;

        const mappedCards = (data?.tasks || []).map((task) => ({
          id: task.id,
          createdAt: task.created_at ? new Date(task.created_at).getTime() : Date.now(),
          title: task.title,
          description: task.description || "",
          scheduledFor: task.scheduled_for || null,
          taskType: task.task_type || "normal",
          mood: task.mood || null,
          intent: task.intent || "productive",
          outcome: task.outcome || null,
          estimatedDurationMinutes: task.estimated_duration_minutes || null,
          timeTakenMinutes: task.time_taken_minutes || null,
          categories: dedupeCategories(task.categories || []),
          done: task.status === "done",
        }));
        setPreviousDayCards(mappedCards);
      } catch (error) {
        setPreviousDayCards([]);
      }
    };

    loadPreviousDayTasks();
  }, [boardLayoutMode, selectedDate, user?.id]);

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
    setBoardNotice("");

    if (nextDone) {
      setCompletionTask(currentCard);
      setCompletionMoodInput(currentCard.mood || "neutral");
      setCompletionTimeInput(
        currentCard.timeTakenMinutes ? String(currentCard.timeTakenMinutes) : ""
      );
      setCompletionOutcomeInput(currentCard.outcome || "");
      setIsCompletionModalOpen(true);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/api/tasks/${cardId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: "todo",
          mood: null,
          outcome: null,
          timeTakenMinutes: null,
          time_taken_minutes: null,
        }),
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
                taskType: updatedTask?.task_type || card.taskType || "normal",
                mood: updatedTask?.mood || null,
                intent: updatedTask?.intent || card.intent || "productive",
                outcome: updatedTask?.outcome || null,
                estimatedDurationMinutes:
                  updatedTask?.estimated_duration_minutes || card.estimatedDurationMinutes || null,
                timeTakenMinutes: updatedTask?.time_taken_minutes || null,
                categories: dedupeCategories(updatedTask?.categories || card.categories || []),
                done: (updatedTask?.status || "todo") === "done",
              }
            : card
        )
      );
    } catch (error) {
      setBoardError(error.message || "Failed to update task");
    }
  };

  const closeCompletionModal = () => {
    setIsCompletionModalOpen(false);
    setCompletionTask(null);
    setCompletionMoodInput("neutral");
    setCompletionTimeInput("");
    setCompletionOutcomeInput("");
  };

  const submitCompletionUpdate = async (event) => {
    event.preventDefault();
    if (!completionTask?.id) return;
    if (!completionMoodInput || !completionTimeInput || !completionOutcomeInput) {
      setBoardError("Mood, time taken, and outcome are required to mark a task done.");
      return;
    }

    setBoardError("");
    setBoardNotice("");

    try {
      const response = await fetch(buildApiUrl(`/api/tasks/${completionTask.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: "done",
          mood: completionMoodInput,
          outcome: completionOutcomeInput,
          timeTakenMinutes: Number(completionTimeInput),
          time_taken_minutes: Number(completionTimeInput),
        }),
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to complete task");
      }

      const updatedTask = data?.task;
      setCards((currentCards) =>
        currentCards.map((card) =>
          card.id === completionTask.id
            ? {
                ...card,
                title: updatedTask?.title || card.title,
                description: updatedTask?.description || "",
                scheduledFor: updatedTask?.scheduled_for || card.scheduledFor || null,
                taskType: updatedTask?.task_type || card.taskType || "normal",
                mood: updatedTask?.mood || completionMoodInput,
                intent: updatedTask?.intent || card.intent || "productive",
                outcome: updatedTask?.outcome || completionOutcomeInput,
                estimatedDurationMinutes:
                  updatedTask?.estimated_duration_minutes || card.estimatedDurationMinutes || null,
                timeTakenMinutes:
                  updatedTask?.time_taken_minutes || Number(completionTimeInput) || null,
                categories: dedupeCategories(updatedTask?.categories || card.categories || []),
                done: true,
              }
            : card
        )
      );
      closeCompletionModal();
    } catch (error) {
      setBoardError(error.message || "Failed to complete task");
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

  const stopDescriptionVoiceInput = () => {
    shouldKeepListeningRef.current = false;
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    setIsDescriptionVoiceActive(false);
  };

  const stopTitleVoiceInput = () => {
    titleShouldKeepListeningRef.current = false;
    if (titleSpeechRecognitionRef.current) {
      titleSpeechRecognitionRef.current.stop();
      titleSpeechRecognitionRef.current = null;
    }
    setIsTitleVoiceActive(false);
  };

  const handleDescriptionVoiceInput = () => {
    if (isMobileViewport) return;
    if (isDescriptionVoiceActive) {
      stopDescriptionVoiceInput();
      return;
    }
    stopTitleVoiceInput();

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setBoardError("Voice input is not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    shouldKeepListeningRef.current = true;
    speechBaseDescriptionRef.current = taskDescriptionInput.trim();
    speechCommittedTranscriptRef.current = "";
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let committedTranscript = "";
      let interimTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const segment = event.results[index]?.[0]?.transcript || "";
        if (event.results[index].isFinal) {
          committedTranscript += `${segment} `;
        } else {
          interimTranscript += segment;
        }
      }
      speechCommittedTranscriptRef.current = committedTranscript;
      const baseText = speechBaseDescriptionRef.current;
      const fullTranscript = `${committedTranscript}${interimTranscript}`.trim();
      const spacer = baseText && fullTranscript ? " " : "";
      setTaskDescriptionInput(`${baseText}${spacer}${fullTranscript}`.trim());
    };

    recognition.onerror = (event) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setBoardError("Microphone permission is blocked. Please allow microphone access.");
      } else if (event?.error === "no-speech") {
        setBoardError("No speech detected. Please try again.");
      } else {
        setBoardError("Unable to capture voice input. Please try again.");
      }
      stopDescriptionVoiceInput();
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch (error) {
          setBoardError("Voice input stopped. Please tap the speaker to start again.");
        }
      }
      shouldKeepListeningRef.current = false;
      setIsDescriptionVoiceActive(false);
      speechRecognitionRef.current = null;
    };

    speechRecognitionRef.current = recognition;
    setBoardError("");
    setIsDescriptionVoiceActive(true);
    descriptionTextareaRef.current?.focus();
    try {
      recognition.start();
    } catch (error) {
      setBoardError("Unable to start voice input. Please tap the speaker and try again.");
      stopDescriptionVoiceInput();
    }
  };

  const handleTitleVoiceInput = () => {
    if (isMobileViewport) return;
    if (isTitleVoiceActive) {
      stopTitleVoiceInput();
      return;
    }
    stopDescriptionVoiceInput();

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setBoardError("Voice input is not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    titleShouldKeepListeningRef.current = true;
    titleSpeechBaseRef.current = taskTitleInput.trim();
    titleSpeechCommittedRef.current = "";
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let committedTranscript = "";
      let interimTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const segment = event.results[index]?.[0]?.transcript || "";
        if (event.results[index].isFinal) {
          committedTranscript += `${segment} `;
        } else {
          interimTranscript += segment;
        }
      }
      titleSpeechCommittedRef.current = committedTranscript;
      const baseText = titleSpeechBaseRef.current;
      const fullTranscript = `${committedTranscript}${interimTranscript}`.trim();
      const spacer = baseText && fullTranscript ? " " : "";
      setTaskTitleInput(`${baseText}${spacer}${fullTranscript}`.trim());
    };

    recognition.onerror = (event) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setBoardError("Microphone permission is blocked. Please allow microphone access.");
      } else if (event?.error === "no-speech") {
        setBoardError("No speech detected. Please try again.");
      } else {
        setBoardError("Unable to capture voice input. Please try again.");
      }
      stopTitleVoiceInput();
    };

    recognition.onend = () => {
      if (titleShouldKeepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch (error) {
          setBoardError("Voice input stopped. Please tap the speaker to start again.");
        }
      }
      titleShouldKeepListeningRef.current = false;
      setIsTitleVoiceActive(false);
      titleSpeechRecognitionRef.current = null;
    };

    titleSpeechRecognitionRef.current = recognition;
    setBoardError("");
    setIsTitleVoiceActive(true);
    titleInputRef.current?.focus();
    try {
      recognition.start();
    } catch (error) {
      setBoardError("Unable to start voice input. Please tap the speaker and try again.");
      stopTitleVoiceInput();
    }
  };

  useEffect(() => {
    if (isMobileViewport) {
      stopDescriptionVoiceInput();
      stopTitleVoiceInput();
    }
  }, [isMobileViewport]);

  const openCreateTaskModal = () => {
    setTaskModalMode("create");
    setActiveTaskId(null);
    setTaskTitleInput("");
    setTaskDescriptionInput("");
    setTaskScheduledInput("");
    setTaskMoodInput("neutral");
    setIsTaskMoodTouched(false);
    setTaskTypeInput("normal");
    setTaskIntentInput("productive");
    setTaskOutcomeInput("");
    setTaskEstimatedDurationInput("");
    setTaskTimeTakenInput("");
    setSelectedCategoryIds([]);
    setCustomCategoryNames([]);
    setIsCustomCategoryModalOpen(false);
    setCustomCategoryNameInput("");
    stopTitleVoiceInput();
    stopDescriptionVoiceInput();
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
    setIsTaskMoodTouched(Boolean(card.mood));
    setTaskTypeInput(card.taskType || "normal");
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
    stopTitleVoiceInput();
    stopDescriptionVoiceInput();
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
    setIsTaskMoodTouched(false);
    setTaskTypeInput("normal");
    setTaskIntentInput("productive");
    setTaskOutcomeInput("");
    setTaskEstimatedDurationInput("");
    setTaskTimeTakenInput("");
    setSelectedCategoryIds([]);
    setCustomCategoryNames([]);
    setIsCustomCategoryModalOpen(false);
    setCustomCategoryNameInput("");
    stopTitleVoiceInput();
    stopDescriptionVoiceInput();
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
    setReplicateRepeatDaysInput("");
    setBoardError("");
    setBoardNotice("");
    setIsReplicateModalOpen(true);
  };

  const closeReplicateModal = () => {
    setIsReplicateModalOpen(false);
    setReplicateSourceTask(null);
    setReplicateDateInput("");
    setReplicateTimeInput("");
    setReplicateRepeatDaysInput("");
  };

  const handleReplicateSubmit = async (event) => {
    event.preventDefault();
    if (!replicateSourceTask) return;
    if (!replicateDateInput || !replicateTimeInput) {
      setBoardError("Target date and time are required for replication.");
      return;
    }
    const repeatDaysValue = replicateRepeatDaysInput.trim();
    const repeatCount = repeatDaysValue ? Number.parseInt(repeatDaysValue, 10) : 1;
    if (!Number.isInteger(repeatCount) || repeatCount <= 0) {
      setBoardError("Repeat days must be a positive integer.");
      return;
    }
    if (repeatCount > 30) {
      setBoardError("Repeat days cannot exceed 30.");
      return;
    }

    setBoardError("");
    setBoardNotice("");

    try {
      const [year, month, day] = replicateDateInput.split("-").map(Number);
      const nextCards = [];

      for (let index = 0; index < repeatCount; index += 1) {
        const scheduledDate = new Date(year, month - 1, day + index);
        const nextYear = scheduledDate.getFullYear();
        const nextMonth = String(scheduledDate.getMonth() + 1).padStart(2, "0");
        const nextDay = String(scheduledDate.getDate()).padStart(2, "0");
        const replicatedDate = `${nextYear}-${nextMonth}-${nextDay}`;
        const scheduledForValue = new Date(
          `${replicatedDate}T${replicateTimeInput}:00`
        ).toISOString();

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
            taskType: replicateSourceTask.taskType || "normal",
            task_type: replicateSourceTask.taskType || "normal",
            outcome: null,
            categoryIds: (replicateSourceTask.categories || []).map((category) => category.id),
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
            estimatedDurationMinutes:
              (replicateSourceTask.taskType || "normal") === "normal"
                ? replicateSourceTask.estimatedDurationMinutes || null
                : null,
            estimated_duration_minutes:
              (replicateSourceTask.taskType || "normal") === "normal"
                ? replicateSourceTask.estimatedDurationMinutes || null
                : null,
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
        if (replicatedDate === selectedDate) {
          nextCards.push({
            id: replicatedTask?.id || `${Date.now()}-${index}`,
            createdAt: replicatedTask?.created_at
              ? new Date(replicatedTask.created_at).getTime()
              : Date.now(),
            title: replicatedTask?.title || replicateSourceTask.title,
            description: replicatedTask?.description || "",
            scheduledFor: replicatedTask?.scheduled_for || scheduledForValue,
            taskType: replicatedTask?.task_type || replicateSourceTask.taskType || "normal",
            mood: null,
            intent: replicatedTask?.intent || replicateSourceTask.intent || "productive",
            outcome: null,
            estimatedDurationMinutes:
              replicatedTask?.estimated_duration_minutes ||
              ((replicateSourceTask.taskType || "normal") === "normal"
                ? replicateSourceTask.estimatedDurationMinutes || null
                : null),
            timeTakenMinutes: null,
            categories: dedupeCategories(
              replicatedTask?.categories || replicateSourceTask.categories || []
            ),
            done: false,
          });
        }
      }

      if (nextCards.length) {
        setCards((currentCards) => [...nextCards.reverse(), ...currentCards]);
      }
      setBoardNotice(
        `${repeatCount} task${repeatCount === 1 ? "" : "s"} replicated successfully.`
      );
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

  const handleTaskTypeChange = (nextTaskType) => {
    setTaskTypeInput(nextTaskType);
    if (nextTaskType !== "normal") {
      setTaskEstimatedDurationInput("");
      setTaskTimeTakenInput("");
      setTaskMoodInput("neutral");
      setIsTaskMoodTouched(false);
    }
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
    const isActivityMetaLocked = taskTypeInput !== "normal";
    const moodValue = isActivityMetaLocked ? null : isTaskMoodTouched ? taskMoodInput : null;
    const normalizedEstimatedDuration = isActivityMetaLocked ? null : estimatedDurationValue;
    const normalizedTimeTaken = isActivityMetaLocked ? null : timeTakenValue;

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
            mood: moodValue,
            intent: taskIntentInput,
            taskType: taskTypeInput,
            task_type: taskTypeInput,
            outcome: taskOutcomeInput || null,
            categoryIds: selectedCategoryIds,
            customCategories: customNames,
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
            estimatedDurationMinutes: normalizedEstimatedDuration,
            estimated_duration_minutes: normalizedEstimatedDuration,
            timeTakenMinutes: normalizedTimeTaken,
            time_taken_minutes: normalizedTimeTaken,
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
          taskType: createdTask?.task_type || taskTypeInput,
          mood: createdTask?.mood || moodValue,
          intent: createdTask?.intent || taskIntentInput,
          outcome: createdTask?.outcome || taskOutcomeInput || null,
          estimatedDurationMinutes:
            createdTask?.estimated_duration_minutes || normalizedEstimatedDuration || null,
          timeTakenMinutes: createdTask?.time_taken_minutes || normalizedTimeTaken || null,
          categories: dedupeCategories(createdTask?.categories || []),
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
            mood: moodValue,
            intent: taskIntentInput,
            taskType: taskTypeInput,
            task_type: taskTypeInput,
            outcome: taskOutcomeInput || null,
            categoryIds: selectedCategoryIds,
            customCategories: customNames,
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
            estimatedDurationMinutes: normalizedEstimatedDuration,
            estimated_duration_minutes: normalizedEstimatedDuration,
            timeTakenMinutes: normalizedTimeTaken,
            time_taken_minutes: normalizedTimeTaken,
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
                  taskType: updatedTask?.task_type || taskTypeInput,
                  mood: updatedTask?.mood || moodValue,
                  intent: updatedTask?.intent || taskIntentInput,
                  outcome: updatedTask?.outcome || taskOutcomeInput || null,
                  estimatedDurationMinutes:
                    updatedTask?.estimated_duration_minutes || normalizedEstimatedDuration || null,
                  timeTakenMinutes: updatedTask?.time_taken_minutes || normalizedTimeTaken || null,
                  categories: dedupeCategories(updatedTask?.categories || card.categories || []),
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

  const isActivityMetaLocked = taskTypeInput !== "normal";

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

    if (sortBy === "scheduled") {
      sortedCards.sort((a, b) => {
        const aScheduled = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Number.POSITIVE_INFINITY;
        const bScheduled = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Number.POSITIVE_INFINITY;
        if (aScheduled !== bScheduled) {
          return aScheduled - bScheduled;
        }
        return (b.createdAt || b.id || 0) - (a.createdAt || a.id || 0);
      });
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
            totalActualMinutes: 0,
          };
        }
        stats[category.id].cardCount += 1;
        stats[category.id].totalActualMinutes += Number(card.timeTakenMinutes || 0);
      });
    });
    return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);
  const totalCategoryActualMinutes = useMemo(
    () => categoryStats.reduce((sum, category) => sum + Number(category.totalActualMinutes || 0), 0),
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

  const isInteractiveDragTarget = (target) =>
    Boolean(target?.closest("button, input, select, textarea, label, a"));

  const handleCardTouchStart = (event, cardId) => {
    if (isInteractiveDragTarget(event.target)) return;
    event.preventDefault();
    touchDropTargetIdRef.current = cardId;
    handleCardDragStart(cardId);
  };

  const handleCardTouchMove = (event) => {
    if (!draggedCardId) return;
    event.preventDefault();
    const touch = event.touches?.[0];
    if (!touch) return;
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropCard = element?.closest("[data-card-id]");
    if (!dropCard?.dataset?.cardId) return;
    touchDropTargetIdRef.current = dropCard.dataset.cardId;
  };

  const handleCardTouchEnd = () => {
    if (!draggedCardId) return;
    const targetCardId = touchDropTargetIdRef.current || draggedCardId;
    handleCardDrop(targetCardId);
    touchDropTargetIdRef.current = null;
  };

  const timelineTasks = useMemo(() => {
    const matchesFilters = (card) => {
      if (statusFilter === "completed" && !card.done) return false;
      if (statusFilter === "pending" && card.done) return false;
      if (categoryFilter !== "all") {
        return (card.categories || []).some((category) => category.id === categoryFilter);
      }
      return true;
    };

    const currentDaySegments = [...visibleCards]
      .filter((card) => card.scheduledFor)
      .map((card) => {
        const scheduledDate = new Date(card.scheduledFor);
        const startMinutes = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
        const totalDurationMinutes = Math.max(
          15,
          Number(card.estimatedDurationMinutes || card.timeTakenMinutes || 30)
        );
        const durationMinutes = Math.max(15, Math.min(totalDurationMinutes, 1440 - startMinutes));
        return {
          ...card,
          sourceTaskId: card.id,
          startMinutes,
          durationMinutes,
          startTimeLabel: `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(
            scheduledDate.getMinutes()
          ).padStart(2, "0")}`,
        };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const carryOverSegments = previousDayCards
      .filter((card) => card.scheduledFor && matchesFilters(card))
      .map((card) => {
        const scheduledDate = new Date(card.scheduledFor);
        const startMinutes = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
        const totalDurationMinutes = Math.max(
          15,
          Number(card.estimatedDurationMinutes || card.timeTakenMinutes || 30)
        );
        const overflowMinutes = startMinutes + totalDurationMinutes - 1440;
        if (overflowMinutes <= 0) return null;
        return {
          ...card,
          id: `${card.id}-carryover`,
          sourceTaskId: card.id,
          startMinutes: 0,
          durationMinutes: Math.min(overflowMinutes, 1440),
          startTimeLabel: "00:00",
          carriesOver: true,
        };
      })
      .filter(Boolean);

    const sortedSegments = [...currentDaySegments, ...carryOverSegments].sort(
      (a, b) => a.startMinutes - b.startMinutes
    );

    const activeSegments = [];
    const groupColumnCounts = new Map();
    let nextGroupId = 0;

    const positionedSegments = sortedSegments.map((task) => {
      const taskStart = task.startMinutes;
      const taskEnd = task.startMinutes + task.durationMinutes;

      for (let index = activeSegments.length - 1; index >= 0; index -= 1) {
        if (activeSegments[index].endMinutes <= taskStart) {
          activeSegments.splice(index, 1);
        }
      }

      const occupiedColumns = new Set(activeSegments.map((segment) => segment.columnIndex));
      let columnIndex = 0;
      while (occupiedColumns.has(columnIndex)) {
        columnIndex += 1;
      }

      const groupId = activeSegments.length ? activeSegments[0].groupId : nextGroupId++;
      activeSegments.push({ endMinutes: taskEnd, columnIndex, groupId });

      const maxColumns = groupColumnCounts.get(groupId) || 0;
      groupColumnCounts.set(groupId, Math.max(maxColumns, columnIndex + 1));

      return {
        ...task,
        endMinutes: taskEnd,
        columnIndex,
        groupId,
      };
    });

    return positionedSegments.map((task) => {
      const columns = groupColumnCounts.get(task.groupId) || 1;
      const widthPercent = 100 / columns;
      return {
        ...task,
        widthPercent,
        leftPercent: task.columnIndex * widthPercent,
      };
    });
  }, [visibleCards, previousDayCards, statusFilter, categoryFilter]);

  const firstName = (user?.full_name || "").trim().split(/\s+/)[0] || "there";
  const selectedMoodIndex = Math.max(
    0,
    MOOD_OPTIONS.findIndex((option) => option.value === taskMoodInput)
  );
  const localHour = new Date(now).getHours();
  const localMinute = new Date(now).getMinutes();
  const greeting = getDayPartGreeting(getDayPart(localHour));
  const todayDate = new Date(now);
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(todayDate.getDate()).padStart(2, "0")}`;
  const isSelectedDateToday = selectedDate === todayKey;
  const currentMinuteMarker = localHour * 60 + localMinute;
  const scrollCategoryFilters = (direction) => {
    const scrollContainer = categoryFilterScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollBy({ left: direction * 240, behavior: "smooth" });
  };

  const updateCategoryScrollButtons = useCallback(() => {
    const scrollContainer = categoryFilterScrollRef.current;
    if (!scrollContainer) {
      setCanScrollCategoriesLeft(false);
      setCanScrollCategoriesRight(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    setCanScrollCategoriesLeft(scrollLeft > 1);
    setCanScrollCategoriesRight(scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    updateCategoryScrollButtons();
  }, [categoryStats, updateCategoryScrollButtons]);

  useEffect(() => {
    const scrollContainer = categoryFilterScrollRef.current;
    if (!scrollContainer) return undefined;

    const onScroll = () => updateCategoryScrollButtons();
    const onResize = () => updateCategoryScrollButtons();

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateCategoryScrollButtons]);

  const renderCategoryChips = () => (
    <>
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
          <small>
            <span className="category-chip-line">
              {category.cardCount} {category.name} Tasks
            </span>
            <span className="category-chip-line">
              Time Spent: {formatMinutesLabel(category.totalActualMinutes)}
            </span>
          </small>
        </button>
      ))}
    </>
  );

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
              <div className="task-toolbar-main">
                <button type="button" className="create-task-btn" onClick={openCreateTaskModal}>
                  Create new task
                </button>
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
                      <option value="scheduled">Scheduled time</option>
                      <option value="alphabetical">Alphabetical</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="board-date-and-view-row">
                <div className="board-date-controls" aria-label="Task date controls">
                  <button
                    type="button"
                    className="date-nav-btn"
                    onClick={() => moveSelectedDateByDays(-1)}
                  >
                    Previous day
                  </button>
                  <div className="board-date-display">
                    <button
                      type="button"
                      className="board-date-display-trigger"
                      onClick={openInlineDatePicker}
                      aria-label="Select task date"
                    >
                      {formatSelectedDate(selectedDate)}
                    </button>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="board-date-input-hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                  <button
                    type="button"
                    className="date-nav-btn"
                    onClick={() => moveSelectedDateByDays(1)}
                  >
                    Next day
                  </button>
                </div>
                <div className="board-view-toggle" role="tablist" aria-label="Board layout">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={boardLayoutMode === "board"}
                    className={boardLayoutMode === "board" ? "is-active" : ""}
                    onClick={() => setBoardLayoutMode("board")}
                  >
                    Board
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={boardLayoutMode === "timeline"}
                    className={boardLayoutMode === "timeline" ? "is-active" : ""}
                    onClick={() => setBoardLayoutMode("timeline")}
                  >
                    Timeline
                  </button>
                </div>
              </div>
            </div>
            <div className="category-filter-row" aria-label="Category filters">
              <button
                type="button"
                className={categoryFilter === "all" ? "category-filter-chip is-active" : "category-filter-chip"}
                onClick={() => setCategoryFilter("all")}
              >
                <small>
                  <span className="category-chip-line">{cards.length} All Tasks</span>
                  <span className="category-chip-line">
                    Time Spent: {formatMinutesLabel(totalCategoryActualMinutes)}
                  </span>
                </small>
              </button>
              {categoryStats.length ? <span className="category-filter-divider" aria-hidden="true" /> : null}
              {categoryStats.length ? (
                <div className="category-filter-nav">
                  <button
                    type="button"
                    className="category-filter-arrow"
                    aria-label="Scroll categories left"
                    onClick={() => scrollCategoryFilters(-1)}
                    disabled={!canScrollCategoriesLeft}
                  >
                    ←
                  </button>
                  <div className="category-filter-scroll" ref={categoryFilterScrollRef}>
                    {renderCategoryChips()}
                  </div>
                  <button
                    type="button"
                    className="category-filter-arrow"
                    aria-label="Scroll categories right"
                    onClick={() => scrollCategoryFilters(1)}
                    disabled={!canScrollCategoriesRight}
                  >
                    →
                  </button>
                </div>
              ) : null}
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
          {boardLayoutMode === "board" ? (
            <section className="cards-grid" aria-label="Task cards">
              {isLoadingTasks ? <p>Loading tasks...</p> : null}
              {visibleCards.map((card) => {
                return (
            <article
              className={`task-card ${card.done ? "is-done-card" : ""} ${
                draggedCardId === card.id ? "is-dragging" : ""
              }`}
              key={card.id}
              data-card-id={card.id}
              style={getCardStyle(card)}
              draggable
              onDragStart={() => handleCardDragStart(card.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleCardDrop(card.id)}
              onDragEnd={() => setDraggedCardId(null)}
              onTouchStart={(event) => handleCardTouchStart(event, card.id)}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              onTouchCancel={handleCardTouchEnd}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="card-header">
                <div className="card-title-group">
                  <h2>{card.title}</h2>
                  <div className="card-meta-row">
                    <span className="task-type-label">
                      Type: {formatTaskTypeLabel(card.taskType)}
                    </span>
                    {card.done ? <span className="task-done-indicator" aria-hidden="true">✓</span> : null}
                    <span className={`status-text ${card.done ? "is-done" : "not-done"}`}>
                      {card.done ? "Done" : "Not Done"}
                    </span>
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
              {card.mood || card.intent ? (
                <p className="task-attributes">
                  {card.mood ? (
                    <span className="task-attribute-item">Mood: {card.mood}</span>
                  ) : null}
                  {card.mood && card.intent ? <span className="task-attributes-separator">•</span> : null}
                  {card.intent ? (
                    <span className="task-attribute-item">Intent: {card.intent}</span>
                  ) : null}
                </p>
              ) : null}
              {card.scheduledFor ? <div className="task-detail-divider" /> : null}
              {card.scheduledFor ? (
                <p className="task-schedule">
                  Scheduled: {formatScheduledDate(card.scheduledFor)}
                </p>
              ) : null}
              {(card.taskType === "normal"
                ? card.estimatedDurationMinutes || card.timeTakenMinutes
                : card.estimatedDurationMinutes) ? (
                <div
                  className={`task-metrics-row ${
                    card.taskType === "normal" ? "" : "task-metrics-row-single"
                  }`}
                >
                  <div className="task-metric-box">
                    <span>Est. duration</span>
                    <strong>
                      {card.estimatedDurationMinutes
                        ? formatMinutesLabel(card.estimatedDurationMinutes)
                        : "—"}
                    </strong>
                  </div>
                  {card.taskType === "normal" ? (
                    <div className="task-metric-box">
                      <span>Completion</span>
                      <strong>
                        {card.timeTakenMinutes ? formatMinutesLabel(card.timeTakenMinutes) : "—"}
                      </strong>
                    </div>
                  ) : null}
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
                <div className="status-row-actions">
                  <button
                    type="button"
                    className="card-action-btn card-action-btn-replicate"
                    onClick={() => openReplicateModal(card)}
                  >
                    Replicate
                  </button>
                  <button
                    type="button"
                    className="card-action-btn card-action-btn-edit"
                    onClick={() => openEditTaskModal(card)}
                  >
                    Edit
                  </button>
                </div>
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
          ) : (
            <section className="timeline-board" aria-label="Timeline view">
              <div className="timeline-hours">
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div className="timeline-hour-row" key={`hour-${hour}`}>
                    <span>{String(hour).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              <div className="timeline-canvas">
                {isSelectedDateToday ? (
                  <div
                    className="timeline-now-line"
                    style={{ top: `${currentMinuteMarker}px` }}
                    aria-hidden="true"
                  />
                ) : null}
                {timelineTasks.map((task) => (
                  <article
                    key={`timeline-${task.id}`}
                    className="timeline-task-block"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const editableTask =
                        cards.find((item) => item.id === task.sourceTaskId) ||
                        previousDayCards.find((item) => item.id === task.sourceTaskId);
                      if (editableTask) {
                        openEditTaskModal(editableTask);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        const editableTask =
                          cards.find((item) => item.id === task.sourceTaskId) ||
                          previousDayCards.find((item) => item.id === task.sourceTaskId);
                        if (editableTask) {
                          openEditTaskModal(editableTask);
                        }
                      }
                    }}
                    style={{
                      top: `${task.startMinutes}px`,
                      minHeight: `${task.durationMinutes}px`,
                      left: `calc(8px + ${task.leftPercent}%)`,
                      width: `calc(${task.widthPercent}% - 10px)`,
                      borderColor: getCardStyle(task).borderColor,
                      background: getCardStyle(task).background,
                      opacity: task.done ? 1 : 0.58,
                    }}
                  >
                    {task.done ? <span className="timeline-done-indicator" aria-hidden="true">✓</span> : null}
                    <strong>{task.title}</strong>
                    <small>
                      {task.startTimeLabel} · {formatMinutesLabel(task.durationMinutes)}
                      {task.carriesOver ? " · continues" : ""}
                    </small>
                    {task.mood || task.outcome || task.intent ? (
                      <small className="timeline-task-meta">
                        {task.mood ? `Mood: ${task.mood}` : ""}
                        {task.mood && (task.outcome || task.intent) ? " · " : ""}
                        {task.outcome ? `Outcome: ${task.outcome}` : ""}
                        {task.outcome && task.intent ? " · " : ""}
                        {task.intent ? `Intent: ${task.intent}` : ""}
                      </small>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )}

          {isTaskModalOpen ? (
            <div className="task-modal-overlay" role="dialog" aria-modal="true">
          <div className="task-modal">
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
                  <div className="task-voice-input-wrap">
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={taskTitleInput}
                      onChange={(event) => setTaskTitleInput(event.target.value)}
                      placeholder="Enter task title"
                      required
                    />
                    {!isMobileViewport ? (
                      <button
                        type="button"
                        className={`description-voice-btn description-voice-btn--title ${
                          isTitleVoiceActive ? "is-active" : ""
                        }`}
                        onClick={handleTitleVoiceInput}
                        aria-label={
                          isTitleVoiceActive
                            ? "Stop voice input for title"
                            : "Start voice input for title"
                        }
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M14.5 3.75a.75.75 0 0 1 .75.75v15a.75.75 0 0 1-1.28.53l-4.72-4.78H5.5a1.75 1.75 0 0 1-1.75-1.75v-3.5A1.75 1.75 0 0 1 5.5 8.25h3.75l4.72-4.78a.75.75 0 0 1 .53-.22ZM17.78 8.45a.75.75 0 0 1 1.05.11 5.5 5.5 0 0 1 0 6.88.75.75 0 0 1-1.16-.95 4 4 0 0 0 0-4.98.75.75 0 0 1 .11-1.06Zm2.77-2.93a.75.75 0 0 1 1.05.11 10 10 0 0 1 0 12.74.75.75 0 1 1-1.16-.95 8.5 8.5 0 0 0 0-10.84.75.75 0 0 1 .11-1.06Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </label>
                <label>
                  Task description
                  <div className="task-description-input-wrap task-voice-input-wrap">
                    <textarea
                      ref={descriptionTextareaRef}
                      value={taskDescriptionInput}
                      onChange={(event) => setTaskDescriptionInput(event.target.value)}
                      placeholder="Optional description"
                      rows={3}
                    />
                    {!isMobileViewport ? (
                      <button
                        type="button"
                        className={`description-voice-btn description-voice-btn--description ${
                          isDescriptionVoiceActive ? "is-active" : ""
                        }`}
                        onClick={handleDescriptionVoiceInput}
                        aria-label={
                          isDescriptionVoiceActive
                            ? "Stop voice input for description"
                            : "Start voice input for description"
                        }
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M14.5 3.75a.75.75 0 0 1 .75.75v15a.75.75 0 0 1-1.28.53l-4.72-4.78H5.5a1.75 1.75 0 0 1-1.75-1.75v-3.5A1.75 1.75 0 0 1 5.5 8.25h3.75l4.72-4.78a.75.75 0 0 1 .53-.22ZM17.78 8.45a.75.75 0 0 1 1.05.11 5.5 5.5 0 0 1 0 6.88.75.75 0 0 1-1.16-.95 4 4 0 0 0 0-4.98.75.75 0 0 1 .11-1.06Zm2.77-2.93a.75.75 0 0 1 1.05.11 10 10 0 0 1 0 12.74.75.75 0 1 1-1.16-.95 8.5 8.5 0 0 0 0-10.84.75.75 0 0 1 .11-1.06Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
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
                <label>
                  Task type
                  <div className="outcome-options" role="radiogroup" aria-label="Task type">
                    {TASK_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={taskTypeInput === option.value}
                        className={
                          taskTypeInput === option.value
                            ? "outcome-option is-selected"
                            : "outcome-option"
                        }
                        onClick={() => handleTaskTypeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </label>
              </section>
              <section className="task-form-section">
                <h4>Timelines</h4>
                <div className="task-attributes-row task-attributes-row-timelines">
                  <label>
                    Scheduled
                    <input
                      className="calendar-utility-input"
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
                      disabled={isActivityMetaLocked}
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
                      disabled={isActivityMetaLocked}
                      onChange={(event) => {
                        const moodIndex = Number(event.target.value);
                        setTaskMoodInput(MOOD_OPTIONS[moodIndex]?.value || "neutral");
                        setIsTaskMoodTouched(true);
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
                      disabled={isActivityMetaLocked}
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
                          onClick={() =>
                            setTaskOutcomeInput((currentValue) =>
                              currentValue === option.value ? "" : option.value
                            )
                          }
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
                  <label>
                    Repeat for next N days (optional)
                    <input
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      value={replicateRepeatDaysInput}
                      onChange={(event) => setReplicateRepeatDaysInput(event.target.value)}
                      placeholder="1"
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

          {isCompletionModalOpen ? (
            <div className="task-modal-overlay" role="dialog" aria-modal="true">
              <div className="task-modal replicate-modal">
                <button
                  type="button"
                  className="task-modal-close"
                  aria-label="Close completion form"
                  onClick={closeCompletionModal}
                >
                  ×
                </button>
                <h3>Mark task as done</h3>
                <form onSubmit={submitCompletionUpdate} className="replicate-form">
                  <p className="replicate-source-title">{completionTask?.title}</p>
                  <label>
                    Mood during activity
                    <select
                      value={completionMoodInput}
                      onChange={(event) => setCompletionMoodInput(event.target.value)}
                      required
                    >
                      {MOOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Time taken to complete (minutes)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={completionTimeInput}
                      onChange={(event) => setCompletionTimeInput(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Outcome
                    <select
                      value={completionOutcomeInput}
                      onChange={(event) => setCompletionOutcomeInput(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select outcome
                      </option>
                      {OUTCOME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="task-modal-actions">
                    <button type="button" onClick={closeCompletionModal}>
                      Cancel
                    </button>
                    <button type="submit">Save and mark done</button>
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
