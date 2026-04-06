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

  const toggleStatus = (cardId) => {
    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, done: !card.done } : card
      )
    );
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
            <h2>{card.title}</h2>
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
              <span className={`status-text ${card.done ? "is-done" : "not-done"}`}>
                {card.done ? "Done" : "Not Done"}
              </span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
