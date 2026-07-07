import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

// Capture the setSkills mutation so we can assert the reorder/link payload.
const setSkillsMutate = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({
    data: [
      { id: "s1", name: "no-then-chains", type: "convention", description: "", body: "", source: "manual", enabled: true, version: 1, evidence_files: null },
      { id: "s2", name: "secret-gate", type: "security", description: "", body: "", source: "manual", enabled: true, version: 1, evidence_files: null },
    ] as Skill[],
  }),
}));
vi.mock("../../../../../../../lib/hooks/agents", () => ({
  // s1 already linked (order 0); s2 not linked.
  useAgentSkills: () => ({ data: [{ agent_id: "a1", skill_id: "s1", order: 0 }] }),
  useSetAgentSkills: () => ({ mutate: setSkillsMutate, isPending: false }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(() => {
  cleanup();
  setSkillsMutate.mockClear();
});

const agent = { id: "a1", name: "Security Reviewer" } as Agent;

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agent={agent} />
    </NextIntlClientProvider>,
  );
}

describe("SkillsTab (L02 — attach/enable/reorder)", () => {
  it("lists all workspace skills and shows the linked-of-total count", () => {
    renderTab();
    expect(screen.getByText("no-then-chains")).toBeInTheDocument();
    expect(screen.getByText("secret-gate")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 enabled")).toBeInTheDocument(); // s1 linked, s2 not
  });

  it("toggling edits a PENDING set — nothing is saved until Save is clicked", () => {
    renderTab();
    fireEvent.click(screen.getByText("secret-gate")); // enable s2 (pending)
    expect(setSkillsMutate).not.toHaveBeenCalled(); // no auto-save
    expect(screen.getByText("2 of 2 enabled")).toBeInTheDocument(); // count reflects the draft
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("Save commits the pending set in one atomic write (appended order)", () => {
    renderTab();
    fireEvent.click(screen.getByText("secret-gate"));
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(setSkillsMutate.mock.calls[0]![0]).toEqual({ agentId: "a1", skillIds: ["s1", "s2"] });
  });

  it("detaching then Save sends the reduced set", () => {
    renderTab();
    fireEvent.click(screen.getByText("no-then-chains")); // disable s1 (pending)
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(setSkillsMutate.mock.calls[0]![0]).toEqual({ agentId: "a1", skillIds: [] });
  });

  it("Discard reverts the pending edits without saving", () => {
    renderTab();
    fireEvent.click(screen.getByText("secret-gate"));
    fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    expect(setSkillsMutate).not.toHaveBeenCalled();
    expect(screen.getByText("1 of 2 enabled")).toBeInTheDocument(); // back to server state
  });
});
