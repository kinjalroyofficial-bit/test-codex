import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

test("capitalizes submitted text", () => {
  render(<App />);

  const input = screen.getByLabelText(/text input/i);
  const submitButton = screen.getByRole("button", { name: /submit/i });

  fireEvent.change(input, { target: { value: "hello world" } });
  fireEvent.click(submitButton);

  expect(screen.getByText(/capitalized text: HELLO WORLD/i)).toBeInTheDocument();
});
