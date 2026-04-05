import React, { useState } from "react";

function App() {
  const [inputText, setInputText] = useState("");
  const [submittedText, setSubmittedText] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmittedText(inputText.toUpperCase());
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "0.01em",
          }}
        >
          PulsePoint: Daily Tracking for Personal Usage
        </h1>
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="Type text here"
              aria-label="Left input text"
              style={{
                width: "100%",
                minHeight: "320px",
                fontSize: "1.2rem",
                padding: "16px",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "12px 16px",
                fontSize: "1rem",
                cursor: "pointer",
                width: "180px",
              }}
            >
              Submit
            </button>
          </div>

          <textarea
            value={submittedText}
            readOnly
            placeholder="Capitalized text will appear here"
            aria-label="Right output text"
            style={{
              width: "100%",
              minHeight: "320px",
              fontSize: "1.2rem",
              padding: "16px",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </form>
      </div>
    </div>
  );
}

export default App;
