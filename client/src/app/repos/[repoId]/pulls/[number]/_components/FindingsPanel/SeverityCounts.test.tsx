import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SeverityCounts } from "./SeverityCounts";

afterEach(cleanup);

const counts = { CRITICAL: 3, WARNING: 5, SUGGESTION: 0 };

describe("SeverityCounts", () => {
  it("renders a chip per severity with its tally", () => {
    render(<SeverityCounts counts={counts} active={null} onToggle={() => {}} label="Findings by severity" />);
    expect(screen.getByRole("button", { name: /CRITICAL/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /WARNING/ })).toHaveTextContent("5");
    expect(screen.getByRole("button", { name: /SUGGESTION/ })).toHaveTextContent("0");
  });

  it("disables a zero-count level", () => {
    render(<SeverityCounts counts={counts} active={null} onToggle={() => {}} label="Findings by severity" />);
    expect(screen.getByRole("button", { name: /SUGGESTION/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /CRITICAL/ })).toBeEnabled();
  });

  it("marks the active level pressed and emits the clicked severity", () => {
    const onToggle = vi.fn();
    render(<SeverityCounts counts={counts} active="CRITICAL" onToggle={onToggle} label="Findings by severity" />);
    expect(screen.getByRole("button", { name: /CRITICAL/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /WARNING/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /WARNING/ }));
    expect(onToggle).toHaveBeenCalledWith("WARNING");
  });
});
