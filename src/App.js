import React, { useMemo, useState } from "react";
import "./App.css";

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

function App() {
  const [cards, setCards] = useState(mockCards);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [editingId, setEditingId] = useState(null);

  const toggleStatus = (cardId) => {
    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, done: !card.done } : card
      )
    );
  };

  const handleDelete = (cardId) => {
    setCards((currentCards) => currentCards.filter((card) => card.id !== cardId));

    if (editingId === cardId) {
      setEditingId(null);
      setTitleInput("");
      setDescriptionInput("");
    }
  };

  const handleEdit = (card) => {
    setEditingId(card.id);
    setTitleInput(card.title);
    setDescriptionInput(card.description || "");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedTitle = titleInput.trim();
    const trimmedDescription = descriptionInput.trim();

    if (!trimmedTitle) return;

    if (editingId) {
      setCards((currentCards) =>
        currentCards.map((card) =>
          card.id === editingId
            ? { ...card, title: trimmedTitle, description: trimmedDescription }
            : card
        )
      );
    } else {
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
    }

    setEditingId(null);
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
        <h1>Project Progress Board</h1>
        <p>Track the latest updates with quick Done/Not Done toggles.</p>

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
          <button type="submit">{editingId ? "Update task" : "Add task"}</button>
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
        {visibleCards.map((card) => (
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

            <p>{card.description}</p>

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
                className="edit-btn"
                onClick={() => handleEdit(card)}
              >
                Edit
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
