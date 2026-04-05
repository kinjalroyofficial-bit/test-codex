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
      }}
    >
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
  );
}

export default App;
