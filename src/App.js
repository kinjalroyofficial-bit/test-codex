import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const buildApiUrl = (path) => `${API_BASE_URL}${path}`;

const MOOD_OPTIONS = [
  { value: "energetic", label: "Energetic" },
  { value: "happy", label: "Happy" },
  { value: "neutral", label: "Neutral" },
  { value: "tired", label: "Tired" },
  { value: "stressed", label: "Stressed" },
  { value: "depressed", label: "Depressed" },
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
  const [sortBy, setSortBy] = useState("created");
  const [boardError, setBoardError] = useState("");
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("create");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskTitleInput, setTaskTitleInput] = useState("");
  const [taskDescriptionInput, setTaskDescriptionInput] = useState("");
  const [taskScheduledInput, setTaskScheduledInput] = useState("");
  const [taskMoodInput, setTaskMoodInput] = useState("neutral");
  const [taskIntentInput, setTaskIntentInput] = useState("productive");
  const [taskOutcomeInput, setTaskOutcomeInput] = useState("neutral");
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    const loadTasks = async () => {
      setBoardError("");
      setIsLoadingTasks(true);

      try {
        const response = await fetch(buildApiUrl("/api/tasks"), {
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
          outcome: task.outcome || "neutral",
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
  }, [user?.id]);

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
                outcome: updatedTask?.outcome || card.outcome || "neutral",
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
    setTaskOutcomeInput("neutral");
    setSelectedCategoryIds([]);
    setCustomCategoryInput("");
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
    setTaskOutcomeInput(card.outcome || "neutral");
    setSelectedCategoryIds((card.categories || []).map((category) => category.id));
    setCustomCategoryInput("");
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
    setTaskOutcomeInput("neutral");
    setSelectedCategoryIds([]);
    setCustomCategoryInput("");
  };

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategoryIds((currentIds) =>
      currentIds.includes(categoryId)
        ? currentIds.filter((id) => id !== categoryId)
        : [...currentIds, categoryId]
    );
  };

  const handleTaskModalSubmit = async (event) => {
    event.preventDefault();
    const trimmedTitle = taskTitleInput.trim();
    const trimmedDescription = taskDescriptionInput.trim();
    const scheduledForValue = taskScheduledInput
      ? new Date(taskScheduledInput).toISOString()
      : null;

    if (!trimmedTitle) return;

    setBoardError("");

    try {
      let mergedCategoryIds = [...selectedCategoryIds];
      const customNames = customCategoryInput
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

      for (const customName of customNames) {
        const categoryResponse = await fetch(buildApiUrl("/api/categories"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: customName }),
        });
        const categoryData = await parseApiResponse(categoryResponse);

        if (!categoryResponse.ok) {
          throw new Error(categoryData?.error || "Failed to create custom category");
        }

        const category = categoryData?.category;
        if (category?.id) {
          mergedCategoryIds = [...new Set([...mergedCategoryIds, category.id])];
          setAvailableCategories((currentCategories) => {
            if (currentCategories.some((item) => item.id === category.id)) {
              return currentCategories;
            }
            return [...currentCategories, category].sort((a, b) =>
              a.name.localeCompare(b.name)
            );
          });
        }
      }

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
            outcome: taskOutcomeInput,
            categoryIds: mergedCategoryIds,
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
          }),
        });
        const data = await parseApiResponse(response);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to create task");
        }

        const createdTask = data?.task;
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
          outcome: createdTask?.outcome || taskOutcomeInput,
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
            outcome: taskOutcomeInput,
            categoryIds: mergedCategoryIds,
            scheduledFor: scheduledForValue,
            scheduled_for: scheduledForValue,
          }),
        });
        const data = await parseApiResponse(response);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to save task");
        }

        const updatedTask = data?.task;
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
                  outcome: updatedTask?.outcome || taskOutcomeInput,
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

    const sortedCards = [...filteredCards];

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
  }, [cards, sortBy, statusFilter]);

  const firstName = (user?.full_name || "").trim().split(/\s+/)[0] || "there";

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__topbar">
          <div>
            <h1>Welcome {firstName}.</h1>
            <p>Track the latest updates with quick Done/Not Done toggles.</p>
          </div>
          <div className="user-panel">
            <div className="auth-user-box">
              <span>{user?.email || "Signed in"}</span>
              <button type="button" onClick={onLogout}>
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

        <div className="task-toolbar">
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
                <option value="priority">Priority (later)</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>
        {boardError ? <p className="auth-error">{boardError}</p> : null}
      </header>

      <section className="cards-grid" aria-label="Task cards">
        {isLoadingTasks ? <p>Loading tasks...</p> : null}
        {visibleCards.map((card) => {
          return (
            <article className={`task-card ${card.done ? "is-done-card" : ""}`} key={card.id}>
              <div className="card-header">
                <div className="card-title-group">
                  <h2>{card.title}</h2>
                  <div className="card-meta-row">
                    <span className={`status-text ${card.done ? "is-done" : "not-done"}`}>
                      {card.done ? "Done" : "Not Done"}
                    </span>
                    <span className="task-age">{formatTimeAgo(card.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="delete-cross"
                  aria-label={`Delete ${card.title}`}
                  onClick={() => handleDelete(card.id)}
                >
                  ×
                </button>
              </div>

              <p className="task-description">{card.description}</p>
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
                Mood: <strong>{card.mood || "neutral"}</strong> · Intent:{" "}
                <strong>{card.intent || "productive"}</strong> · Outcome:{" "}
                <strong>{card.outcome || "neutral"}</strong>
              </p>
              {card.scheduledFor ? (
                <p className="task-schedule">
                  Scheduled: <strong>{formatScheduledDate(card.scheduledFor)}</strong>
                </p>
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
            </article>
          );
        })}
      </section>

      {isTaskModalOpen ? (
        <div className="task-modal-overlay" role="dialog" aria-modal="true">
          <div className="task-modal">
            <h3>{taskModalMode === "create" ? "Create task" : "Edit task"}</h3>
            <form onSubmit={handleTaskModalSubmit} className="task-modal-form">
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
                  rows={3}
                />
              </label>
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
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(event) => setCustomCategoryInput(event.target.value)}
                  placeholder="Add custom category (comma separated)"
                />
              </label>
              <label>
                Mood
                <select
                  value={taskMoodInput}
                  onChange={(event) => setTaskMoodInput(event.target.value)}
                >
                  {MOOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
              <label>
                Scheduled
                <input
                  type="datetime-local"
                  value={taskScheduledInput}
                  onChange={(event) => setTaskScheduledInput(event.target.value)}
                />
              </label>
              <div className="task-modal-actions">
                <button type="button" onClick={closeTaskModal}>
                  Cancel
                </button>
                <button type="submit">Submit</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("taskTheme") || "dark");

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("taskTheme", theme);
  }, [theme]);

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
