import type { CSSProperties } from "react";

/** Co-located styles for VerdictBanner (extracted from inline styles). */
export const s = {
  wrap: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    padding: 18,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  iconBox: (bg: string, color: string): CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: bg,
    color,
    flexShrink: 0,
  }),
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  // Agent name = the hero of the banner.
  agentTitle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 19,
    fontWeight: 700,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  // Verdict is now a small supporting pill, not the headline.
  verdictPill: (color: string): CSSProperties => ({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "2px 8px",
    borderRadius: 999,
    color,
    background: "color-mix(in srgb, currentColor 14%, transparent)",
  }),
  // Findings line — prominent, second only to the agent name.
  findingsLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  blockerCount: { color: "var(--crit)", fontWeight: 700 } satisfies CSSProperties,
  label: (color: string): CSSProperties => ({ fontSize: 18, fontWeight: 700, color }),
  summary: {
    fontSize: 13.5,
    lineHeight: 1.55,
    color: "var(--text-muted)",
    marginTop: 8,
  } satisfies CSSProperties,
  scoreCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  } satisfies CSSProperties,
  scoreLabel: {
    fontSize: 12,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
  } satisfies CSSProperties,
} as const;
