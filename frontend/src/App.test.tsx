import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the GridPulse title", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "GridPulse" })).toBeInTheDocument();
});
