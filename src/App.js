import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const buildApiUrl = (path) => `${API_BASE_URL}${path}`;

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

const mockCards = [
  {
    id: 1,
    createdAt: 1712500000000,
    title: "Landing Page",
    description: "Finalize hero section and supporting content blocks.",
    done: false,
  },
  {
    id: 2,
    createdAt: 1712503600000,
    title: "Authentication",
    description: "Add sign-in and sign-up flow with validation.",
    done: true,
  },
  {
    id: 3,
    createdAt: 1712507200000,
    title: "User Dashboard",
    description: "Design analytics cards and activity timeline widgets.",
    done: false,
  },
  {
    id: 4,
    createdAt: 1712510800000,
    title: "Notifications",
    description: "Connect push and in-app notifications with preferences.",
    done: false,
  },
  {
    id: 5,
    createdAt: 1712514400000,
    title: "Deployment",
    description: "Prepare CI/CD pipeline and production environment checks.",
    done: true,
  },
];

function LoginScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
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
          body: JSON.stringify({ email, password }),
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

function BoardScreen({ user, onLogout }) {
  const [cards, setCards] = useState(mockCards);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [editDescriptionInput, setEditDescriptionInput] = useState("");

  const toggleStatus = (cardId) => {
    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, done: !card.done } : card
      )
    );
  };

  const handleDelete = (cardId) => {
    setCards((currentCards) => currentCards.filter((card) => card.id !== cardId));

    if (editingCardId === cardId) {
      setEditingCardId(null);
      setEditTitleInput("");
      setEditDescriptionInput("");
    }
  };

  const startCardEdit = (card) => {
    setEditingCardId(card.id);
    setEditTitleInput(card.title);
    setEditDescriptionInput(card.description || "");
  };

  const cancelCardEdit = () => {
    setEditingCardId(null);
    setEditTitleInput("");
    setEditDescriptionInput("");
  };

  const saveCardEdit = (cardId) => {
    const trimmedTitle = editTitleInput.trim();

    if (!trimmedTitle) return;

    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              title: trimmedTitle,
              description: editDescriptionInput.trim(),
            }
          : card
      )
    );

    cancelCardEdit();
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedTitle = titleInput.trim();
    const trimmedDescription = descriptionInput.trim();

    if (!trimmedTitle) return;

    setCards((currentCards) => [
      {
        id: Date.now(),
        createdAt: Date.now(),
        title: trimmedTitle,
        description: trimmedDescription,
        done: false,
      },
      ...currentCards,
    ]);

    setTitleInput("");
    setDescriptionInput("");
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

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__topbar">
          <div>
            <h1>Personal Task Tracker</h1>
            <p>Track the latest updates with quick Done/Not Done toggles.</p>
          </div>
          <div className="auth-user-box">
            <span>{user?.email || "Signed in"}</span>
            <button type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Task name
            <input
              type="text"
              value={titleInput}
              onChange={(event) => setTitleInput(event.target.value)}
              placeholder="Enter task title"
              required
            />
          </label>
          <label>
            Task details
            <input
              type="text"
              value={descriptionInput}
              onChange={(event) => setDescriptionInput(event.target.value)}
              placeholder="Optional description"
            />
          </label>
          <button type="submit">Add task</button>
        </form>

        <div className="controls-row">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </label>

          <label>
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="created">Created time</option>
              <option value="priority">Priority (later)</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </label>
        </div>
      </header>

      <section className="cards-grid" aria-label="Task cards">
        {visibleCards.map((card) => {
          const isEditingCard = editingCardId === card.id;

          return (
            <article className="task-card" key={card.id}>
              <div className="card-header">
                <h2>{card.title}</h2>
                <button
                  type="button"
                  className="delete-cross"
                  aria-label={`Delete ${card.title}`}
                  onClick={() => handleDelete(card.id)}
                >
                  ×
                </button>
              </div>

              <span className={`status-text ${card.done ? "is-done" : "not-done"}`}>
                {card.done ? "Done" : "Not Done"}
              </span>

              {isEditingCard ? (
                <div className="inline-edit-form" aria-label={`Edit ${card.title}`}>
                  <label>
                    Title
                    <input
                      type="text"
                      value={editTitleInput}
                      onChange={(event) => setEditTitleInput(event.target.value)}
                    />
                  </label>
                  <label>
                    Details
                    <input
                      type="text"
                      value={editDescriptionInput}
                      onChange={(event) => setEditDescriptionInput(event.target.value)}
                    />
                  </label>
                  <div className="inline-edit-actions">
                    <button type="button" onClick={() => saveCardEdit(card.id)}>
                      Save
                    </button>
                    <button type="button" onClick={cancelCardEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p>{card.description}</p>
              )}

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
              </div>

              <button
                type="button"
                className="edit-btn card-edit-btn"
                onClick={() => startCardEdit(card)}
              >
                Edit task
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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

  return <BoardScreen user={user} onLogout={handleLogout} />;
}

export default App;
