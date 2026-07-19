import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { PrFile, SmartDiff } from "@devdigest/shared";

const SMART_DIFF: SmartDiff = {
  groups: [{ role: "core", files: [{ path: "src/a.ts", additions: 1, deletions: 0, finding_lines: [] }] }],
  split_suggestion: { too_big: false, total_lines: 1, proposed_splits: [] },
};

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/lib/hooks/reviews", () => ({
  usePrComments: () => ({ data: [] }),
  useCreatePrComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSmartDiff: () => ({ data: SMART_DIFF }),
  usePrReviews: () => ({ data: [] }),
  usePrRuns: () => ({ data: [] }),
  useDeleteRun: () => ({ mutateAsync: vi.fn() }),
  useRunReview: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ notify: { error: vi.fn() } }));
vi.mock("@/components/diff-viewer", () => ({ DiffViewer: () => <div data-testid="diff-viewer" /> }));
vi.mock("../SmartDiffViewer", () => ({ SmartDiffViewer: () => <div data-testid="smart-diff-viewer" /> }));

import { DiffTab } from "./DiffTab";

afterEach(cleanup);

const FILES: PrFile[] = [{ path: "src/a.ts", additions: 1, deletions: 0, patch: null }];

describe("DiffTab — Smart/Original toggle (I)", () => {
  it("I.P0.1 — renders SmartDiffViewer (smart order) by default", () => {
    render(<DiffTab prId="pr1" filesCount={1} files={FILES} />);
    expect(screen.getByTestId("smart-diff-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("diff-viewer")).not.toBeInTheDocument();
  });

  it("I.P0.2 — 'Original order' toggle swaps to the plain DiffViewer", () => {
    render(<DiffTab prId="pr1" filesCount={1} files={FILES} />);
    fireEvent.click(screen.getByRole("tab", { name: "Original order" }));
    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("smart-diff-viewer")).not.toBeInTheDocument();
  });
});
