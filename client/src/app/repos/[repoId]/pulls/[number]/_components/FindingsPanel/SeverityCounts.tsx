/* SeverityCounts — clickable per-severity tally for a review run's findings.
   Clicking a level filters the list to it; clicking the active level clears.
   Zero-count levels stay visible (stable layout) but disabled. Purely presentational. */
"use client";

import React from "react";
import { SEV_COLOR } from "../FindingCard/constants";
import { s } from "./styles";
import { SEVERITIES, type SeverityLevel } from "./constants";

export function SeverityCounts({
  counts,
  active,
  onToggle,
  label,
}: {
  counts: Record<SeverityLevel, number>;
  active: SeverityLevel | null;
  onToggle: (sev: SeverityLevel) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} style={s.counts}>
      {SEVERITIES.map((sev) => {
        const n = counts[sev];
        const isActive = active === sev;
        const color = SEV_COLOR[sev];
        // A zero-count level is inert — EXCEPT the active one, which must stay
        // clickable so the filter can always be cleared (e.g. after hide-low empties it).
        const inert = n === 0 && !isActive;
        return (
          <button
            key={sev}
            type="button"
            disabled={inert}
            aria-pressed={isActive}
            onClick={() => onToggle(sev)}
            style={{
              ...s.chip,
              borderColor: isActive ? color : "var(--border)",
              background: isActive ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent",
              color: isActive ? color : "var(--text-secondary)",
              cursor: inert ? "default" : "pointer",
              opacity: inert ? 0.45 : 1,
            }}
          >
            <span className="tnum" style={{ color, fontWeight: 600 }}>
              {n}
            </span>
            {sev}
          </button>
        );
      })}
    </div>
  );
}
