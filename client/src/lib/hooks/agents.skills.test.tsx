import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AgentSkillLink } from "@devdigest/shared";

// Mock the API layer so we control the POST + inspect payloads.
const post = vi.hoisted(() => vi.fn(async () => [] as AgentSkillLink[]));
vi.mock("../api", () => ({ api: { post, get: vi.fn() } }));

import { useSetAgentSkills, useAgentSkills } from "./agents";

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useSetAgentSkills — optimistic linking (no stale-cache overwrite)", () => {
  beforeEach(() => post.mockClear());

  it("updates the agent-skills cache IMMEDIATELY so rapid toggles accumulate", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // seed the agent's linked-skills cache as EMPTY
    qc.setQueryData(["agent", "a1", "skills"], [] as AgentSkillLink[]);

    const set = renderHook(() => useSetAgentSkills(), { wrapper: wrapper(qc) });
    const read = renderHook(() => useAgentSkills("a1"), { wrapper: wrapper(qc) });

    // toggle skill A → cache reflects [A] synchronously (optimistic), before the POST resolves
    act(() => {
      set.result.current.mutate({ agentId: "a1", skillIds: ["A"] });
    });
    await waitFor(() =>
      expect((read.result.current.data ?? []).map((l) => l.skill_id)).toEqual(["A"]),
    );

    // a second toggle computed from the CURRENT (optimistic) set → [A, B], not [B]
    act(() => {
      set.result.current.mutate({ agentId: "a1", skillIds: ["A", "B"] });
    });
    await waitFor(() =>
      expect((read.result.current.data ?? []).map((l) => l.skill_id)).toEqual(["A", "B"]),
    );

    // both POSTs fired with the accumulating set (last one is the full set)
    expect(post).toHaveBeenLastCalledWith("/agents/a1/skills", { skill_ids: ["A", "B"] });
  });
});
