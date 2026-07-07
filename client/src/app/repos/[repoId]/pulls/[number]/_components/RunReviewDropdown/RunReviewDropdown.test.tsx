import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";

const runMutate = vi.hoisted(() => vi.fn().mockResolvedValue({ runs: [] }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgents: () => ({ data: [{ id: "a1", name: "Security", model: "gpt-4.1", enabled: true }] }),
}));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useRunReview: () => ({ mutateAsync: runMutate, isPending: false }),
}));

import { RunReviewDropdown } from "./RunReviewDropdown";

afterEach(() => {
  cleanup();
  runMutate.mockClear();
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("RunReviewDropdown (smoke)", () => {
  it("renders the trigger label", () => {
    renderWithIntl(<RunReviewDropdown prId="pr1" />);
    expect(screen.getByText("Run Review")).toBeInTheDocument();
  });

  it("each agent entry fires exactly ONE run (with-skills vs baseline are separate items)", async () => {
    renderWithIntl(<RunReviewDropdown prId="pr1" />);
    fireEvent.click(screen.getByText("Run Review")); // open the dropdown
    // the agent appears twice: under "Run with skills" and under "Run baseline".
    // "with skills" entry (first Security) → one run, no skipSkills
    fireEvent.click(screen.getAllByText("Security")[0]!);
    await waitFor(() => expect(runMutate).toHaveBeenCalledTimes(1));
    expect(runMutate.mock.calls[0]![0]).toMatchObject({ prId: "pr1", agentId: "a1" });
    expect(runMutate.mock.calls[0]![0].skipSkills).toBeFalsy();

    // clicking an item closes the dropdown — reopen for the baseline entry
    runMutate.mockClear();
    fireEvent.click(screen.getByText("Run Review"));
    const reopened = screen.getAllByText("Security");
    fireEvent.click(reopened[reopened.length - 1]!); // baseline entry → one run, skipSkills
    await waitFor(() => expect(runMutate).toHaveBeenCalledTimes(1));
    expect(runMutate.mock.calls[0]![0]).toMatchObject({ prId: "pr1", agentId: "a1", skipSkills: true });
  });
});
