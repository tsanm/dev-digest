/* RunFindingsHover — inline per-severity count badges for a review run, with a
   hover popover that lists that run's findings. Portaled to <body> so it escapes
   the accordion's overflow:hidden. Read-only summary. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Icon, MonoLink, ConfidenceNum } from "@devdigest/ui";
import { SEV, CAT, type Severity, type Category } from "@/vendor/ui/primitives/tokens";
import type { FindingRecord } from "@devdigest/shared";
import { githubBlobUrl } from "../../../../../../../lib/github-urls";
import { lineLabel } from "../FindingCard/helpers";

const ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];
const HIDE_DELAY_MS = 120; // lets the cursor cross the gap onto the popover

export function RunFindingsHover({
  findings,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  };
  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setRect(null), HIDE_DELAY_MS);
  };

  if (findings.length === 0) {
    return <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>0 findings</span>;
  }

  return (
    <span
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      {ORDER.map((sv) => {
        const n = counts[sv] ?? 0;
        if (!n) return null;
        const meta = SEV[sv];
        const SIcon = Icon[meta.icon];
        return (
          <span
            key={sv}
            className="tnum"
            style={{ display: "inline-flex", alignItems: "center", gap: 3, color: meta.c, fontSize: 12.5, fontWeight: 600 }}
          >
            <SIcon size={13} />
            {n}
          </span>
        );
      })}
      {rect &&
        createPortal(
          <div
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: "fixed",
              top: rect.bottom + 6,
              left: rect.left,
              zIndex: 60,
              width: 380,
              maxHeight: 340,
              overflowY: "auto",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
              {findings.length} finding{findings.length === 1 ? "" : "s"} in this run
            </div>
            {findings.map((f) => {
              const meta = SEV[f.severity as Severity] ?? SEV.INFO;
              const SIcon = Icon[meta.icon];
              const href =
                repoFullName && headSha ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line) : undefined;
              return (
                <div key={f.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <SIcon size={13} style={{ color: meta.c, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{CAT[f.category as Category]?.label ?? f.category}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    {href ? (
                      <MonoLink href={href}>
                        {f.file}:{lineLabel(f)}
                      </MonoLink>
                    ) : (
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {f.file}:{lineLabel(f)}
                      </span>
                    )}
                    <ConfidenceNum value={f.confidence} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, maxHeight: 34, overflow: "hidden" }}>
                    {f.rationale}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </span>
  );
}
