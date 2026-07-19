/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments (Files changed tab): hover a line → "+" → comment,
   posted live to GitHub; existing GitHub review comments render inline. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { PrFile } from "@/lib/types";
import type { FindingRecord } from "@devdigest/shared";
import { type DiffCommentApi } from "../comments";
import { s } from "../styles";
import { FileCard } from "../FileCard";

export function DiffViewer({
  files,
  commenting,
  findingLines,
  findingsByPath,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  /** Smart Diff overlay: per-path finding line numbers → clickable badge. */
  findingLines?: Record<string, number[]>;
  /** Smart Diff overlay: per-path findings → rendered inline on their line. */
  findingsByPath?: Record<string, FindingRecord[]>;
}) {
  const t = useTranslations("shell");
  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  return (
    <div style={s.list}>
      {files.map((f, i) => (
        <FileCard
          key={i}
          file={f}
          commenting={commenting}
          findingLines={findingLines?.[f.path]}
          findings={findingsByPath?.[f.path]}
        />
      ))}
    </div>
  );
}
