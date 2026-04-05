import React, { useState } from "react";

function App() {
  const [inputText, setInputText] = useState("");
  const [submittedText, setSubmittedText] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmittedText(inputText.toUpperCase());
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome Jeet</h1>
      <p>Welcome to the app.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
        <input
          type="text"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Enter text"
          aria-label="Text input"
        />
        <div style={{ marginTop: "10px" }}>
          <button type="submit">Submit</button>
        </div>
      </form>

      {submittedText && (
        <p style={{ marginTop: "20px" }}>Capitalized Text: {submittedText}</p>
      )}
    </div>
  );
}

export default App;
