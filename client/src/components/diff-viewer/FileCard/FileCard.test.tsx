import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrFile } from "@devdigest/shared";
import messages from "../../../../messages/en/shell.json";
import { FileCard } from "./FileCard";

afterEach(cleanup);
beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — stub it so the badge click works.
  (HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
});

// A small file (auto-expanded) whose patch has an added line at new-line 5.
const FILE: PrFile = {
  path: "src/a.ts",
  additions: 1,
  deletions: 0,
  patch: "@@ -1,0 +5,1 @@\n+const x = 1;",
};

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FileCard — Smart Diff finding badge (V.P0.3)", () => {
  it("renders a clickable 'N findings' badge when the file has finding lines", () => {
    renderCard(<FileCard file={FILE} findingLines={[5]} />);
    const badge = screen.getByRole("button", { name: /1 findings — jump to line 5/i });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("1 finding");
  });

  it("clicking the badge scrolls to the diff line (click → line)", async () => {
    renderCard(<FileCard file={FILE} findingLines={[5]} />);
    const line = document.getElementById("dl-src/a.ts-5");
    expect(line).not.toBeNull(); // the anchor exists (auto-expanded file)
    fireEvent.click(screen.getByRole("button", { name: /jump to line 5/i }));
    await waitFor(() => expect(line!.scrollIntoView).toHaveBeenCalled());
  });

  it("shows no badge when the file has no findings", () => {
    renderCard(<FileCard file={FILE} findingLines={[]} />);
    expect(screen.queryByRole("button", { name: /findings/i })).not.toBeInTheDocument();
    cleanup();
    renderCard(<FileCard file={FILE} />);
    expect(screen.queryByRole("button", { name: /findings/i })).not.toBeInTheDocument();
  });
});
