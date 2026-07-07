import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const CANDIDATE: ConventionCandidate = {
  id: "c1",
  category: "resilience",
  rule: "Wrap fetch calls in withTimeout",
  evidence_path: "src/platform/resilience.ts",
  evidence_snippet: "export function withTimeout()",
  evidence_line: 5,
  confidence: 0.9,
  accepted: false,
  rejected: false,
};

const noop = () => {};

describe("ConventionCard", () => {
  it("renders the rule, evidence and confidence (A2.P0.2)", () => {
    renderWithIntl(<ConventionCard c={CANDIDATE} onAccept={noop} onReject={noop} onEdit={noop} />);
    expect(screen.getByText("Wrap fetch calls in withTimeout")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("resilience")).toBeInTheDocument();
  });

  it("accept and reject call their handlers (A3.P0.2)", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    renderWithIntl(<ConventionCard c={CANDIDATE} onAccept={onAccept} onReject={onReject} onEdit={noop} />);
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onAccept).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
  });

  it("evidence links to the GitHub blob at the derived line (A6.P0.1)", () => {
    renderWithIntl(
      <ConventionCard
        c={CANDIDATE}
        repoFullName="acme/payments-api"
        sha="main"
        onAccept={noop}
        onReject={noop}
        onEdit={noop}
      />,
    );
    const link = screen.getByRole("link", { name: /resilience\.ts:5/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/acme/payments-api/blob/main/src/platform/resilience.ts#L5",
    );
  });

  it("editing the rule inline calls onEdit (A4.P1.2)", () => {
    const onEdit = vi.fn();
    renderWithIntl(<ConventionCard c={CANDIDATE} onAccept={noop} onReject={noop} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("Wrap fetch calls in withTimeout")); // enter edit mode
    const input = screen.getByLabelText("Edit rule");
    fireEvent.change(input, { target: { value: "Always wrap fetch in withTimeout" } });
    fireEvent.blur(input);
    expect(onEdit).toHaveBeenCalledWith("Always wrap fetch in withTimeout");
  });

  it("shows the accepted state", () => {
    renderWithIntl(
      <ConventionCard c={{ ...CANDIDATE, accepted: true }} onAccept={noop} onReject={noop} onEdit={noop} />,
    );
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });
});
