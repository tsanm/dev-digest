import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });

  it("groups findings into severity sections with a per-section count", () => {
    const mixed: FindingRecord[] = [
      { ...FINDINGS[0]!, id: "a", severity: "CRITICAL", title: "Crit A" },
      { ...FINDINGS[0]!, id: "b", severity: "CRITICAL", title: "Crit B" },
      { ...FINDINGS[0]!, id: "c", severity: "WARNING", title: "Warn C", confidence: 0.8 },
    ];
    renderWithIntl(<FindingsPanel findings={mixed} prId="pr1" />);
    // one section header per severity (labelled; cards use compact = icon-only)
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    // section counts (2 critical, 1 warning) + all three cards present
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Crit A")).toBeInTheDocument();
    expect(screen.getByText("Warn C")).toBeInTheDocument();
  });

  it("offers a By-skill grouping that buckets findings under the skill that produced them", () => {
    const attributed: FindingRecord[] = [
      { ...FINDINGS[0]!, id: "a", severity: "CRITICAL", title: "Break A", rule: "breaking-change" },
      { ...FINDINGS[0]!, id: "b", severity: "WARNING", title: "Depr B", rule: "deprecation-policy", confidence: 0.8 },
      { ...FINDINGS[0]!, id: "c", severity: "SUGGESTION", title: "Plain C", rule: null, confidence: 0.7 },
    ];
    renderWithIntl(<FindingsPanel findings={attributed} prId="pr1" />);
    // the toggle appears because ≥1 finding is skill-attributed
    fireEvent.click(screen.getByText("By skill"));
    // section headers per skill name (also appears on the card badge → getAllByText)
    // + an "Other" bucket for the unattributed finding
    expect(screen.getAllByText("breaking-change").length).toBeGreaterThan(0);
    expect(screen.getAllByText("deprecation-policy").length).toBeGreaterThan(0);
    expect(screen.getByText("Other")).toBeInTheDocument();
    // all findings still shown
    expect(screen.getByText("Break A")).toBeInTheDocument();
    expect(screen.getByText("Plain C")).toBeInTheDocument();
  });
});
