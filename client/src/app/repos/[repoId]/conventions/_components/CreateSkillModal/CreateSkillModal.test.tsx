import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";

const createMutate = vi.hoisted(() => vi.fn().mockResolvedValue({ skill_id: "sk-1" }));

vi.mock("../../../../../../lib/hooks/conventions", () => ({
  useCreateConventionSkill: () => ({ mutateAsync: createMutate, isPending: false }),
}));
vi.mock("../../../../../../lib/hooks/agents", () => ({
  useAgents: () => ({ data: [{ id: "ag-1", name: "API Contract Reviewer" }] }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(() => {
  cleanup();
  createMutate.mockClear();
});

const cand = (over: Partial<ConventionCandidate>): ConventionCandidate => ({
  id: "c",
  category: "x",
  rule: "rule",
  evidence_path: "src/a.ts",
  evidence_snippet: "code",
  evidence_line: 1,
  confidence: 0.9,
  accepted: true,
  rejected: false,
  ...over,
});

// The parent (ConventionsView) passes ONLY accepted candidates — so the modal's
// merged body is, by construction, free of rejected rules.
const ACCEPTED = [
  cand({ id: "c1", rule: "Use async await for DB access", evidence_path: "src/db.ts", evidence_line: 3 }),
  cand({ id: "c2", rule: "Throw typed ApiError", evidence_path: "src/err.ts", evidence_line: 5 }),
];

function renderModal() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <CreateSkillModal repoId="r1" repoName="payments-api" accepted={ACCEPTED} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("CreateSkillModal (conventions → skill)", () => {
  it("prefills the merged body from the accepted candidates", () => {
    renderModal();
    const body = screen.getByLabelText(messages.modal.body) as HTMLTextAreaElement;
    expect(body.value).toContain("Use async await for DB access");
    expect(body.value).toContain("Throw typed ApiError");
    expect(body.value).toContain("payments-api"); // repo-scoped heading
  });

  it("creates the skill and links it to the selected agent", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(messages.modal.linkAgent), { target: { value: "ag-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Create skill/i }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const payload = createMutate.mock.calls[0]![0];
    expect(payload.agent_id).toBe("ag-1"); // linked to the agent at creation
    expect(payload.body).toContain("Use async await for DB access");
    expect(payload.name).toBe("payments-api-conventions");
  });
});
