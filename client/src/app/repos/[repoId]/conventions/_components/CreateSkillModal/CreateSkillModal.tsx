"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Toggle, Icon } from "@devdigest/ui";
import type { ConventionCandidate, SkillType } from "@devdigest/shared";
import { useCreateConventionSkill } from "../../../../../../lib/hooks/conventions";
import { useAgents } from "../../../../../../lib/hooks/agents";
import { ApiError } from "../../../../../../lib/api";
import { buildConventionsSkillBody, estimateTokens } from "./helpers";
import { s } from "./styles";

const TYPES: SkillType[] = ["convention", "rubric", "security", "custom"];

/** "Create skill from conventions" modal (HW mockup View 2). Prefilled + editable. */
export function CreateSkillModal({
  repoId,
  repoName,
  accepted,
  onClose,
  onCreated,
}: {
  repoId: string;
  repoName: string;
  accepted: ConventionCandidate[];
  onClose: () => void;
  onCreated?: (skillId: string) => void;
}) {
  const t = useTranslations("conventions");
  const create = useCreateConventionSkill(repoId);
  const { data: agents } = useAgents();
  const defaultName = `${repoName}-conventions`;
  const [name, setName] = React.useState(defaultName);
  const [description, setDescription] = React.useState(
    `${accepted.length} house conventions extracted from ${repoName}`,
  );
  const [type, setType] = React.useState<SkillType>("convention");
  const [enabled, setEnabled] = React.useState(true);
  const [body, setBody] = React.useState(() => buildConventionsSkillBody(defaultName, repoName, accepted));
  const [agentId, setAgentId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const res = await create.mutateAsync({
        name,
        description,
        type,
        body,
        enabled,
        ...(agentId ? { agent_id: agentId } : {}),
      });
      onCreated?.(res.skill_id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("modal.error"));
    }
  };

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-label={t("modal.title")} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <div style={s.title}>{t("modal.title")}</div>
            <div className="mono" style={s.subtitle}>
              {name}
            </div>
          </div>
          <button type="button" style={s.close} onClick={onClose} aria-label={t("modal.close")}>
            <Icon.X size={18} />
          </button>
        </div>

        <div style={s.banner}>
          <Icon.Sparkles size={14} />
          <span>{t("modal.banner", { count: accepted.length, repo: repoName })}</span>
        </div>

        <div style={s.body}>
          <div style={s.field}>
            <label style={s.label}>
              {t("modal.name")} <span style={s.req}>*</span>
            </label>
            <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("modal.name")} />
          </div>
          <div style={s.field}>
            <label style={s.label}>{t("modal.description")}</label>
            <input
              style={s.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label={t("modal.description")}
            />
          </div>
          <div style={s.twoCol}>
            <div style={s.field}>
              <label style={s.label}>{t("modal.type")}</label>
              <select
                style={s.input}
                value={type}
                onChange={(e) => setType(e.target.value as SkillType)}
                aria-label={t("modal.type")}
              >
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>{t("modal.enabled")}</label>
              <div style={s.toggleRow}>
                <Toggle on={enabled} onChange={setEnabled} size={16} />
                <span style={s.hint}>{t("modal.enabledHint")}</span>
              </div>
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>
              {t("modal.body")} <span style={s.req}>*</span>
            </label>
            <div>
              <div style={s.editorHeader}>
                <span className="mono" style={s.editorFile}>
                  {name}.md <span style={s.unsaved}>{t("modal.unsaved")}</span>
                </span>
                <span className="mono tnum">{t("modal.tokens", { count: estimateTokens(body) })}</span>
              </div>
              <textarea
                style={s.textarea}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label={t("modal.body")}
              />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>{t("modal.linkAgent")}</label>
            <select
              style={s.input}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              aria-label={t("modal.linkAgent")}
            >
              <option value="">{t("modal.noAgent")}</option>
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.footer}>
          <span style={s.footerStatus}>{t("modal.savedHint")}</span>
          <div style={s.footerActions}>
            <Button kind="tertiary" size="sm" onClick={onClose}>
              {t("modal.cancel")}
            </Button>
            <Button
              kind="primary"
              size="sm"
              icon="Sparkles"
              onClick={submit}
              disabled={create.isPending || !name.trim() || !body.trim()}
            >
              {create.isPending ? t("modal.creating") : t("modal.create")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
