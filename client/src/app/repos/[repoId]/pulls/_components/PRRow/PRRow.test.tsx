import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import messages from "../../../../../../../messages/en/prReview.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PRRow } from "./PRRow";

afterEach(cleanup);

function mk(over: Partial<PrMeta>): PrMeta {
  return {
    id: "p1",
    number: 1,
    title: "Test PR",
    author: "alice",
    branch: "feat",
    base: "main",
    head_sha: "abc",
    additions: 10,
    deletions: 2,
    files_count: 3,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: null,
    findings_critical: null,
    findings_warning: null,
    findings_suggestion: null,
    ...over,
  } as PrMeta;
}

function renderRow(pr: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={pr} repoId="r1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow findings column", () => {
  it("shows all three severities for a reviewed PR (zeros included)", () => {
    renderRow(mk({ score: 80, findings_critical: 2, findings_warning: 0, findings_suggestion: 1 }));
    expect(screen.getByLabelText("Critical: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Warning: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Suggestion: 1")).toBeInTheDocument();
  });

  it("shows no severity chips for a never-reviewed PR", () => {
    renderRow(mk({ score: null }));
    expect(screen.queryByLabelText(/Critical:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Warning:/)).not.toBeInTheDocument();
  });
});
