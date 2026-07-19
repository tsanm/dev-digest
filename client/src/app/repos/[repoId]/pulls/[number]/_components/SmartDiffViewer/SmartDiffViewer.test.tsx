import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SmartDiff, PrFile } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

// Mock DiffViewer to render the paths it receives, so we can assert WHICH group
// is expanded (collapse-default) without pulling in the whole diff renderer.
vi.mock("../../../../../../../components/diff-viewer", () => ({
  DiffViewer: ({ files }: { files: PrFile[] }) => (
    <div data-testid="diff-viewer">{files.map((f) => f.path).join(",")}</div>
  ),
}));

import { SmartDiffViewer } from "./SmartDiffViewer";

afterEach(cleanup);

const file = (path: string, finding_lines: number[] = []): SmartDiff["groups"][number]["files"][number] => ({
  path,
  additions: 10,
  deletions: 2,
  finding_lines,
});

const THREE_GROUPS: SmartDiff = {
  groups: [
    { role: "core", files: [file("src/core.ts", [3])] },
    { role: "wiring", files: [file("src/index.ts")] },
    { role: "boilerplate", files: [file("package-lock.json")] },
  ],
  split_suggestion: { too_big: false, total_lines: 40, proposed_splits: [] },
};

const FILES: PrFile[] = [
  { path: "src/core.ts", additions: 10, deletions: 2, patch: null },
  { path: "src/index.ts", additions: 10, deletions: 2, patch: null },
  { path: "package-lock.json", additions: 10, deletions: 2, patch: null },
];

function renderWithIntl(sd: SmartDiff, files = FILES) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <SmartDiffViewer smartDiff={sd} files={files} />
    </NextIntlClientProvider>,
  );
}

describe("SmartDiffViewer", () => {
  it("V.P0.1 — renders a group per role with its label", () => {
    renderWithIntl(THREE_GROUPS);
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Wiring")).toBeInTheDocument();
    expect(screen.getByText("Boilerplate")).toBeInTheDocument();
  });

  it("V.P0.2 — core (first) open; wiring + boilerplate collapsed by default", () => {
    renderWithIntl(THREE_GROUPS);
    // only the first group's DiffViewer is rendered (defaultOpen === i===0)
    const viewers = screen.getAllByTestId("diff-viewer");
    expect(viewers).toHaveLength(1);
    expect(viewers[0]).toHaveTextContent("src/core.ts");
    // the collapsed groups' files are NOT in the DOM
    expect(screen.queryByText("src/index.ts")).not.toBeInTheDocument();
    expect(screen.queryByText("package-lock.json")).not.toBeInTheDocument();
  });

  it("V.P1.2 — group order is core → wiring → boilerplate (core on top)", () => {
    renderWithIntl(THREE_GROUPS);
    const [core, wiring, boiler] = ["Core", "Wiring", "Boilerplate"].map((l) => screen.getByText(l));
    expect(core!.compareDocumentPosition(wiring!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wiring!.compareDocumentPosition(boiler!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("V.P1.1 — split nudge banner shows when too_big; hidden otherwise", () => {
    const big: SmartDiff = {
      ...THREE_GROUPS,
      split_suggestion: {
        too_big: true,
        total_lines: 500,
        proposed_splits: [{ name: "core changes", files: ["src/core.ts"] }],
      },
    };
    renderWithIntl(big);
    expect(screen.getByText("This PR is large (500 changed lines)")).toBeInTheDocument();
    cleanup();
    renderWithIntl(THREE_GROUPS); // too_big false
    expect(screen.queryByText(/This PR is large/)).not.toBeInTheDocument();
  });
});
