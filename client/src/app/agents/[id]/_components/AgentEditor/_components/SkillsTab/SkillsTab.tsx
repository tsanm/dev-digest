"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/agents";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { filterSkills, skillTypeColor } from "./helpers";
import { s } from "./styles";

/** Skills tab — attach/reorder the skills linked to an agent.
 *  Explicit Save: toggles edit a pending set (instant checkboxes + "unsaved
 *  changes"); nothing is applied until Save, which commits in ONE atomic write
 *  and confirms with "Saved ✓". No hidden per-click auto-save, no race. */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: allSkills } = useSkills();
  const { data: links } = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const [filter, setFilter] = React.useState("");

  // The server's linked set (ordered) — the source of truth once saved.
  const serverIds = React.useMemo(() => (links ?? []).map((l) => l.skill_id), [links]);
  // The pending (editable) set. Synced from the server while there are no edits.
  const [draft, setDraft] = React.useState<string[]>(serverIds);
  const [dirty, setDirty] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setDraft(serverIds);
  }, [serverIds, dirty]);

  const draftSet = React.useMemo(() => new Set(draft), [draft]);
  const skills = filterSkills(allSkills ?? [], filter);

  const toggle = (skillId: string) => {
    setJustSaved(false);
    setDirty(true);
    setDraft((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };
  const save = () => {
    setSkills.mutate(
      { agentId: agent.id, skillIds: draft },
      {
        onSuccess: () => {
          setDirty(false);
          setJustSaved(true);
        },
      },
    );
  };
  const discard = () => {
    setDraft(serverIds);
    setDirty(false);
    setJustSaved(false);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent-text)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { linked: draftSet.size, total: (allSkills ?? []).length })}
        </Badge>
        {/* Save-state: unsaved edits → Save/Discard; after a save → "Saved ✓". */}
        {dirty ? (
          <span style={s.saveRow}>
            <span style={s.unsaved}>{t("skills.unsaved")}</span>
            <Button kind="primary" size="sm" icon="Check" onClick={save} loading={setSkills.isPending}>
              {setSkills.isPending ? t("skills.saving") : t("skills.save")}
            </Button>
            <Button kind="tertiary" size="sm" onClick={discard} disabled={setSkills.isPending}>
              {t("skills.discard")}
            </Button>
          </span>
        ) : justSaved ? (
          <span style={s.savedOk}>
            <Icon.Check size={13} /> {t("skills.saved")}
          </span>
        ) : null}
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      <div style={s.list}>
        {skills.map((sk) => {
          const on = draftSet.has(sk.id);
          const color = skillTypeColor(sk.type);
          return (
            <div key={sk.id} onClick={() => toggle(sk.id)} style={s.row(on)}>
              <Icon.Menu size={14} style={s.grip} />
              <span style={s.checkbox(on)}>{on && <Icon.Check size={11} style={s.checkIcon} />}</span>
              <span className="mono" style={s.skillName}>
                {sk.name}
              </span>
              <span style={s.typeChip(color)}>{sk.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
