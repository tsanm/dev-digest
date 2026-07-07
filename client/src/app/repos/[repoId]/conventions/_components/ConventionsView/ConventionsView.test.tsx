import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";

const noopMut = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("next/navigation", () => ({ useParams: () => ({ repoId: "r1" }) }));
vi.mock("../../../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../../lib/hooks", () => ({
  useRepos: () => ({
    data: [{ id: "r1", name: "payments-api", full_name: "acme/payments-api", default_branch: "main" }],
  }),
}));
vi.mock("../../../../../../lib/repo-context", () => ({ useRepoNotFound: () => false }));

const CANDIDATES: ConventionCandidate[] = [
  { id: "c1", category: "data", rule: "Use async await for DB access", evidence_path: "src/db.ts", evidence_snippet: "await db.find()", evidence_line: 3, confidence: 0.9, accepted: true, rejected: false },
  { id: "c2", category: "err", rule: "Throw typed ApiError", evidence_path: "src/err.ts", evidence_snippet: "throw new ApiError()", evidence_line: 5, confidence: 0.8, accepted: false, rejected: true },
  { id: "c3", category: "http", rule: "All handlers return Result", evidence_path: "src/h.ts", evidence_snippet: "return ok(x)", evidence_line: 1, confidence: 0.7, accepted: false, rejected: false },
];

vi.mock("../../../../../../lib/hooks/conventions", () => ({
  useConventions: () => ({ data: CANDIDATES, isLoading: false, isError: false, refetch: vi.fn() }),
  useExtractConventions: () => noopMut,
  useAcceptConvention: () => noopMut,
  useRejectConvention: () => noopMut,
  useEditConvention: () => noopMut,
}));

import { ConventionsView } from "./ConventionsView";

afterEach(cleanup);

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionsView />
    </NextIntlClientProvider>,
  );
}

describe("ConventionsView (Conventions Extractor results on UI)", () => {
  it("renders a card per extracted candidate", () => {
    renderView();
    expect(screen.getByText("Use async await for DB access")).toBeInTheDocument();
    expect(screen.getByText("Throw typed ApiError")).toBeInTheDocument();
    expect(screen.getByText("All handlers return Result")).toBeInTheDocument();
  });

  it("the toolbar reflects how many candidates are accepted", () => {
    renderView();
    // 1 of 3 accepted (c1 accepted; c2 rejected; c3 neutral)
    expect(screen.getByText("1 of 3 accepted")).toBeInTheDocument();
    // Create-skill is enabled because there is ≥1 accepted candidate
    expect(screen.getByRole("button", { name: /Create skill/i })).toBeEnabled();
  });
});
