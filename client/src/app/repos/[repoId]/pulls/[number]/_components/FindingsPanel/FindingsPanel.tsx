/* FindingsPanel — hide-low-confidence + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState, SeverityBadge } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings, groupBySeverity, groupBySkill } from "./helpers";
import { s } from "./styles";

type GroupMode = "severity" | "skill";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [groupMode, setGroupMode] = React.useState<GroupMode>("severity");
  const [focusIdx, setFocusIdx] = React.useState(0);

  const shown = React.useMemo(() => visibleFindings(findings, hideLow), [findings, hideLow]);
  // Two views over the SAME grounded list: "severity" = the aggregated, prioritized
  // final list; "skill" = findings grouped under the skill that produced them.
  // Flat index preserved either way so j/k keyboard navigation still works.
  const sections = React.useMemo(
    () => (groupMode === "skill" ? groupBySkill(shown) : groupBySeverity(shown)),
    [shown, groupMode],
  );
  // Are any findings attributed to a skill? (enables the "by skill" toggle)
  const hasSkillFindings = React.useMemo(() => shown.some((f) => f.rule && f.rule.trim()), [shown]);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        {hasSkillFindings && (
          <div style={s.groupTabs}>
            <button
              type="button"
              style={s.groupTab(groupMode === "severity")}
              onClick={() => setGroupMode("severity")}
            >
              {t("panel.groupBySeverity")}
            </button>
            <button
              type="button"
              style={s.groupTab(groupMode === "skill")}
              onClick={() => setGroupMode("skill")}
            >
              {t("panel.groupBySkill")}
            </button>
          </div>
        )}
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          sections.map((sec) => (
            <div key={sec.key} style={s.section}>
              <div style={s.sectionHeader}>
                {sec.kind === "severity" ? (
                  <SeverityBadge severity={sec.severity as Severity} count={sec.items.length} />
                ) : (
                  <>
                    <span className="mono" style={s.skillHeaderChip}>
                      {sec.label}
                    </span>
                    <span style={s.sectionCount}>{sec.items.length}</span>
                  </>
                )}
              </div>
              {sec.items.map(({ f, index }) => (
                <FindingCard
                  key={f.id}
                  f={f}
                  focused={index === focusIdx}
                  defaultExpanded={index === 0}
                  pending={action.isPending}
                  repoFullName={repoFullName}
                  headSha={headSha}
                  onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
