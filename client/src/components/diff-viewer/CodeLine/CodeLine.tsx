/* CodeLine — one rendered diff line: gutter number, +/- sign, text, plus the
   hover "+" affordance, any anchored comment threads, and an inline composer. */
"use client";

import React from "react";
import { SeverityBadge } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { commentTargetFor, type CommentThread, type DiffCommentApi, cs } from "../comments";
import { type Line, diffLineAnchorId } from "../helpers";
import { s, lineRowFor, lineSignFor } from "../styles";
import { CommentThreadView } from "../CommentThreadView";
import { InlineComposer } from "../InlineComposer";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "var(--crit)",
  WARNING: "var(--warn)",
  SUGGESTION: "var(--sugg)",
};
/** Inline finding-detail card styles (rendered on the flagged diff line). */
const fs = {
  card: (sev: string): React.CSSProperties => ({
    margin: "2px 0 6px 44px",
    padding: "8px 12px",
    borderRadius: 8,
    borderLeft: `3px solid ${SEV_COLOR[sev] ?? "var(--border)"}`,
    background: "var(--bg-elevated)",
  }),
  head: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  title: { fontSize: 13, fontWeight: 700, color: "var(--text-primary)" },
  cat: { fontSize: 12, color: "var(--text-muted)" },
  body: { fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 5 },
  fix: { fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 5 },
  fixLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: "var(--text-muted)" },
};

export function CodeLine({
  ln,
  path,
  threads,
  commenting,
  findings,
}: {
  ln: Line;
  path: string;
  threads: CommentThread[];
  commenting?: DiffCommentApi;
  /** Smart Diff: findings that START on this line → render inline detail. */
  findings?: FindingRecord[];
}) {
  const [hover, setHover] = React.useState(false);
  const [composing, setComposing] = React.useState(false);

  if (ln.kind === "hunk") {
    return (
      <div className="mono" style={s.hunk}>
        {ln.text}
      </div>
    );
  }

  const sign = ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : "";
  const target = commenting?.canComment ? commentTargetFor(ln) : null;
  const showAdd = hover && !!target && !composing;

  return (
    <div
      id={ln.newNo != null ? diffLineAnchorId(path, ln.newNo) : undefined}
      style={cs.rowWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={lineRowFor(ln.kind)}>
        <span className="mono tnum" style={{ ...s.lineNo, position: "relative" }}>
          {showAdd && target && (
            <button
              type="button"
              title="Add a comment on this line"
              aria-label="Add a comment on this line"
              onClick={() => setComposing(true)}
              style={cs.addBtn}
            >
              +
            </button>
          )}
          {ln.newNo ?? ln.oldNo ?? ""}
        </span>
        <span className="mono" style={lineSignFor(ln.kind)}>
          {sign}
        </span>
        <span className="mono" style={s.lineText}>
          {ln.text || " "}
        </span>
      </div>

      {findings?.map((f, i) => (
        <div key={`finding-${i}`} style={fs.card(f.severity)}>
          <div style={fs.head}>
            <SeverityBadge severity={f.severity as Severity} compact />
            <span style={fs.title}>{f.title}</span>
            <span style={fs.cat}>{f.category}</span>
          </div>
          {f.rationale && <div style={fs.body}>{f.rationale}</div>}
          {f.suggestion && (
            <div style={fs.fix}>
              <span style={fs.fixLabel}>Suggested fix</span> {f.suggestion}
            </div>
          )}
        </div>
      ))}

      {commenting &&
        commenting.showComments &&
        threads.map((th) => (
          <CommentThreadView key={th.rootId} thread={th} commenting={commenting} path={path} />
        ))}

      {commenting && composing && target && (
        <InlineComposer
          commenting={commenting}
          path={path}
          line={target.line}
          side={target.side}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}
