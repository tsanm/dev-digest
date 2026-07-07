import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  section: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  sectionCount: {
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  // "Group by" segmented control
  groupTabs: {
    display: "inline-flex",
    gap: 2,
    padding: 2,
    borderRadius: 8,
    background: "var(--border)",
  } satisfies CSSProperties,
  groupTab: (active: boolean): CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    background: active ? "var(--bg-elevated)" : "transparent",
  }),
  // Skill-name section header chip (group-by-skill view)
  skillHeaderChip: {
    fontSize: 12,
    fontWeight: 700,
    padding: "1px 8px",
    borderRadius: 6,
    color: "var(--accent-text)",
    background: "var(--accent-bg)",
    textTransform: "none" as const,
    letterSpacing: 0,
  } satisfies CSSProperties,
} as const;
