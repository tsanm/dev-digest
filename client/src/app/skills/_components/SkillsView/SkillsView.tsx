/* Skills Lab (A1, L02). Left: skill list with enable toggle; center: preview +
   inline editor; import via drawer (file / url / community). Deep-links the
   selected skill (?id=) and the import drawer (?import=file|url|community). */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton, Icon } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useSkills, useUpdateSkill, useCreateSkill } from "../../../../lib/hooks/skills";
import { SkillListItem } from "../SkillListItem";
import { SkillPreview } from "../SkillPreview";
import { ImportDrawer } from "../ImportDrawer";
import { ADD_MENU, ADD_MENU_WIDTH, NEW_SKILL_BODY } from "./constants";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsView() {
  const t = useTranslations("skills");
  const router = useRouter();
  const params = useSearchParams();
  const selId = params.get("id");
  const importOpen = params.get("import") === "file";

  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const create = useCreateSkill();
  const [search, setSearch] = React.useState("");

  const list = filterSkills(skills ?? [], search);
  const selected = (skills ?? []).find((sk) => sk.id === selId) ?? list[0];

  const setSel = (id: string) => router.replace(`/skills?id=${id}`);
  const openImport = () => router.replace(`/skills?import=file`);
  const closeImport = () => router.replace("/skills");
  const createSkill = async () => {
    const sk = await create.mutateAsync({ name: "new-skill", body: NEW_SKILL_BODY, type: "custom" });
    router.replace(`/skills?id=${sk.id}`);
  };
  const onAdd = (action: "create" | "file") => (action === "create" ? createSkill() : openImport());

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {importOpen && <ImportDrawer onClose={closeImport} />}
      <div style={s.layout}>
        {/* left: skill list */}
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <div style={s.titleRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <Dropdown
                width={ADD_MENU_WIDTH}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                    {t("page.addSkill")}
                  </Button>
                }
                items={ADD_MENU.map((m) => ({
                  label: t(m.labelKey),
                  icon: m.icon,
                  onClick: () => onAdd(m.action),
                }))}
              />
            </div>
            <div style={s.searchBox}>
              <Icon.Search size={13} style={s.searchIcon} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>
          <div style={s.list}>
            {isLoading && (
              <div style={s.loadingStack}>
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
              </div>
            )}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {!isLoading && !isError && list.length === 0 && (
              <EmptyState
                icon="Sparkles"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => createSkill()}
              />
            )}
            {list.map((sk) => (
              <SkillListItem
                key={sk.id}
                s={sk}
                active={selected?.id === sk.id}
                onClick={() => setSel(sk.id)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        </div>

        {/* center: preview / editor */}
        {selected ? (
          <SkillPreview skill={selected} />
        ) : (
          <div style={s.emptyPane}>
            {!isLoading && (
              <EmptyState icon="FileText" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
