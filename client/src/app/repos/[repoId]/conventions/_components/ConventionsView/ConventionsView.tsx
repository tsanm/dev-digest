/* Conventions Extractor (HW-2 Part A). Scan the cloned repo → candidate cards
   (evidence file:line → GitHub + snippet + confidence) → accept/reject/edit →
   merge accepted into one repo-conventions skill (+ link to an agent). */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../../../../components/app-shell";
import {
  useConventions,
  useExtractConventions,
  useAcceptConvention,
  useRejectConvention,
  useEditConvention,
} from "../../../../../../lib/hooks/conventions";
import { useRepos } from "../../../../../../lib/hooks";
import { useRepoNotFound } from "../../../../../../lib/repo-context";
import { ApiError } from "../../../../../../lib/api";
import { ConventionCard } from "../ConventionCard";
import { CreateSkillModal } from "../CreateSkillModal";
import { s } from "./styles";

export function ConventionsView() {
  const t = useTranslations("conventions");
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;
  const { data: repos } = useRepos();
  const repo = repos?.find((r) => r.id === repoId);
  const repoNotFound = useRepoNotFound(repoId);

  const { data: conventions, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const accept = useAcceptConvention(repoId);
  const reject = useRejectConvention(repoId);
  const edit = useEditConvention(repoId);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const candidates = conventions ?? [];
  const acceptedList = candidates.filter((c) => c.accepted);
  const acceptedCount = acceptedList.length;

  const runExtract = async () => {
    setError(null);
    try {
      await extract.mutateAsync(undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("page.extractionFailed"));
    }
  };
  const withBusy = (id: string, fn: () => Promise<unknown>) => async () => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };
  const deselectAll = async () => {
    for (const c of acceptedList) await accept.mutateAsync(c.id); // toggle off
  };

  if (repoNotFound) {
    return (
      <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
        <EmptyState icon="AlertTriangle" title={t("page.repoFallback")} body={t("page.loadError")} />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerMain}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span className="mono" style={s.repoName}>
                {repo?.name ?? t("page.repoFallback")}
              </span>
            </h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <Button kind="secondary" size="sm" icon="RefreshCw" onClick={runExtract} disabled={extract.isPending}>
            {extract.isPending ? t("page.scanning") : candidates.length > 0 ? t("page.rescan") : t("page.runExtraction")}
          </Button>
        </div>

        {error && (
          <div style={s.errorWrap}>
            <ErrorState body={error} onRetry={runExtract} />
          </div>
        )}

        {isLoading && (
          <div style={s.skeletonStack}>
            <Skeleton height={150} />
            <Skeleton height={150} />
          </div>
        )}

        {isError && !isLoading && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}

        {!isLoading && !isError && candidates.length === 0 && !extract.isPending && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={runExtract}
          />
        )}

        {extract.isPending && candidates.length === 0 && (
          <div style={s.skeletonStack}>
            <Skeleton height={150} />
            <Skeleton height={150} />
          </div>
        )}

        {candidates.length > 0 && (
          <>
            <div style={s.toolbar}>
              <Button
                kind="tertiary"
                size="sm"
                icon="X"
                onClick={deselectAll}
                disabled={acceptedCount === 0}
              >
                {t("toolbar.deselectAll")}
              </Button>
              <span style={s.toolbarCount}>
                {t("toolbar.acceptedCount", { count: acceptedCount, total: candidates.length })}
              </span>
              <span style={s.toolbarSpacer} />
              <Button
                kind="primary"
                size="sm"
                icon="Sparkles"
                onClick={() => setModalOpen(true)}
                disabled={acceptedCount === 0}
              >
                {t("toolbar.createSkill")}
              </Button>
            </div>

            {candidates.map((c) => (
              <ConventionCard
                key={c.id}
                c={c}
                repoFullName={repo?.full_name}
                sha={repo?.default_branch}
                busy={busyId === c.id}
                onAccept={withBusy(c.id, () => accept.mutateAsync(c.id))}
                onReject={withBusy(c.id, () => reject.mutateAsync(c.id))}
                onEdit={(rule) => edit.mutate({ id: c.id, patch: { rule } })}
              />
            ))}
          </>
        )}

        {modalOpen && repo && (
          <CreateSkillModal
            repoId={repoId}
            repoName={repo.name}
            accepted={acceptedList}
            onClose={() => setModalOpen(false)}
          />
        )}
      </div>
    </AppShell>
  );
}
