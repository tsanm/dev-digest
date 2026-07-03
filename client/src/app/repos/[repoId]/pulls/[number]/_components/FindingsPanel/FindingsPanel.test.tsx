import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

/** Build a finding, overriding only the fields a test cares about. */
function mk(over: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f0",
    severity: "WARNING",
    category: "bug",
    title: "Finding",
    file: "src/index.ts",
    start_line: 1,
    end_line: 1,
    rationale: "Explanation of the issue.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...over,
  };
}

const FINDINGS: FindingRecord[] = [
  mk({
    id: "f1",
    severity: "CRITICAL",
    title: "Hardcoded secret",
    file: "src/config.ts",
    rationale: "A live API key is committed to source control.",
  }),
];

const FINDINGS_MIX: FindingRecord[] = [
  ...FINDINGS,
  mk({
    id: "f2",
    severity: "WARNING",
    title: "N+1 query",
    file: "src/users/list.ts",
    rationale: "The loop issues one query per user; batch the fetch instead.",
  }),
  mk({
    id: "f3",
    severity: "SUGGESTION",
    title: "Magic number",
    file: "src/rate-limit.ts",
    confidence: 0.4, // below the hide-low threshold
    rationale: "Extract the literal 3600 into a named constant.",
  }),
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** A severity chip, scoped to the counter group so it never matches a finding card. */
function chip(name: RegExp) {
  return within(screen.getByRole("group", { name: "Findings by severity" })).getByRole("button", {
    name,
  });
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state (and no counter) when there are no findings", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Findings by severity" })).not.toBeInTheDocument();
  });
});

describe("FindingsPanel severity counter + filter", () => {
  it("tallies each severity", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS_MIX} prId="pr1" />);
    expect(chip(/CRITICAL/)).toHaveTextContent("1");
    expect(chip(/WARNING/)).toHaveTextContent("1");
    expect(chip(/SUGGESTION/)).toHaveTextContent("1");
  });

  it("filters the list to the clicked severity, and clears on re-click", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS_MIX} prId="pr1" />);
    expect(screen.getByText("N+1 query")).toBeInTheDocument();

    fireEvent.click(chip(/CRITICAL/));
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("N+1 query")).not.toBeInTheDocument();
    expect(chip(/CRITICAL/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(chip(/CRITICAL/));
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
    expect(chip(/CRITICAL/)).toHaveAttribute("aria-pressed", "false");
  });

  it("counts reflect the hide-low-confidence toggle", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS_MIX} prId="pr1" />);
    expect(chip(/SUGGESTION/)).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("switch"));
    expect(chip(/SUGGESTION/)).toHaveTextContent("0");
    expect(chip(/SUGGESTION/)).toBeDisabled();
  });

  it("keeps an active filter clearable after hide-low zeroes its count", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS_MIX} prId="pr1" />);
    // Filter to SUGGESTION (the only low-confidence finding), then hide-low → its count hits 0.
    fireEvent.click(chip(/SUGGESTION/));
    fireEvent.click(screen.getByRole("switch"));
    expect(chip(/SUGGESTION/)).toHaveTextContent("0");
    expect(chip(/SUGGESTION/)).toBeEnabled(); // active chip must NOT be disabled — else it's a dead-end
    // Clicking it clears the filter; the (still hide-low'd) list comes back.
    fireEvent.click(chip(/SUGGESTION/));
    expect(chip(/SUGGESTION/)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("Magic number")).not.toBeInTheDocument(); // still hidden by hide-low
  });
});
