"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, MonoLink, ProgressBar, Icon } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { githubBlobUrl } from "../../../../../../lib/github-urls";
import { confidenceColor, copySnippet, evidenceEndLine } from "./helpers";
import { s } from "./styles";

/**
 * One extracted convention candidate: editable rule + evidence (clickable
 * file:line → GitHub + snippet) + confidence + accept/reject actions.
 */
export function ConventionCard({
  c,
  repoFullName,
  sha,
  onAccept,
  onReject,
  onEdit,
  busy,
}: {
  c: ConventionCandidate;
  repoFullName?: string | null;
  sha?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (rule: string) => void;
  busy?: boolean;
}) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c.rule);
  React.useEffect(() => setDraft(c.rule), [c.rule]);

  const line = c.evidence_line ?? undefined;
  const end = line != null ? evidenceEndLine(line, c.evidence_snippet) : undefined;
  const href =
    repoFullName && sha && c.evidence_path
      ? githubBlobUrl(repoFullName, sha, c.evidence_path, line, end)
      : undefined;
  const evidenceLabel =
    line != null ? `${c.evidence_path}:${line}${end && end !== line ? `-${end}` : ""}` : c.evidence_path;

  const saveEdit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== c.rule) onEdit(v);
    else setDraft(c.rule);
  };

  return (
    <div style={s.card(c.accepted, c.rejected)}>
      <div style={s.row}>
        <div style={s.main}>
          {editing ? (
            <input
              style={s.ruleInput}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") {
                  setDraft(c.rule);
                  setEditing(false);
                }
              }}
              aria-label={t("card.editRule")}
            />
          ) : (
            <button type="button" style={s.rule} onClick={() => setEditing(true)} title={t("card.editRule")}>
              {c.rule}
            </button>
          )}
          {c.category && <span style={s.category}>{c.category}</span>}

          <div style={s.evidence}>
            <div style={s.evidenceHeader}>
              <MonoLink href={href}>{evidenceLabel}</MonoLink>
              <Icon.Copy
                size={12}
                style={s.copyIcon}
                onClick={() => copySnippet(c.evidence_snippet)}
                aria-label={t("card.copy")}
              />
            </div>
            <pre className="mono" style={s.snippet}>
              {c.evidence_snippet}
            </pre>
          </div>

          <div style={s.confidenceRow}>
            <span style={s.confidenceLabel}>{t("card.confidence")}</span>
            <div style={s.confidenceBar}>
              <ProgressBar value={c.confidence * 100} height={5} color={confidenceColor(c.confidence)} />
            </div>
            <span className="mono tnum" style={s.confidenceValue}>
              {Math.round(c.confidence * 100)}%
            </span>
          </div>
        </div>

        <div style={s.actionCol}>
          <Button
            kind={c.accepted ? "primary" : "secondary"}
            size="sm"
            icon="CheckCircle"
            full
            active={c.accepted}
            onClick={onAccept}
            disabled={busy}
          >
            {c.accepted ? t("card.accepted") : t("card.accept")}
          </Button>
          <Button
            kind={c.rejected ? "danger" : "tertiary"}
            size="sm"
            icon="X"
            full
            onClick={onReject}
            disabled={busy}
          >
            {t("card.reject")}
          </Button>
        </div>
      </div>
    </div>
  );
}
