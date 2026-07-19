"use client";

import React from "react";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, useSmartDiff, usePrReviews } from "@/lib/hooks/reviews";
import { notify } from "@/lib/toast";
import type { PrFile, FindingRecord } from "@devdigest/shared";
import { SmartDiffViewer } from "../SmartDiffViewer";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
}

export function DiffTab({ prId, filesCount, files, canComment }: DiffTabProps) {
  const { data: comments } = usePrComments(prId);
  const create = useCreatePrComment(prId);
  const { data: smartDiff } = useSmartDiff(prId);
  const { data: reviews } = usePrReviews(prId);
  // Findings from the last review, grouped by file path → rendered inline on the
  // flagged diff line in Smart order (severity + title + rationale + fix).
  const findingsByPath = React.useMemo(() => {
    const map: Record<string, FindingRecord[]> = {};
    for (const f of (reviews ?? []).flatMap((r) => r.findings)) {
      (map[f.file] ??= []).push(f);
    }
    return map;
  }, [reviews]);
  // Smart order (risk-ordered layout) is the default; toggle to the raw file order.
  const [order, setOrder] = React.useState<"smart" | "original">("smart");
  // Comments start hidden so the diff is clean by default — toggle to reveal.
  const [showComments, setShowComments] = React.useState(false);

  const commentCount = comments?.length ?? 0;

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowComments(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {smartDiff && (
              <div role="tablist" aria-label="Diff order" style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 8, background: "var(--border)" }}>
                {(["smart", "original"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="tab"
                    aria-selected={order === o}
                    onClick={() => setOrder(o)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      color: order === o ? "var(--text-primary)" : "var(--text-muted)",
                      background: order === o ? "var(--bg-elevated)" : "transparent",
                    }}
                  >
                    {o === "smart" ? "Smart order" : "Original order"}
                  </button>
                ))}
              </div>
            )}
            {commentCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={showComments ? "EyeOff" : "Eye"}
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments ? "Hide comments" : "Show comments"} ({commentCount})
              </Button>
            )}
          </div>
        }
      >
        Files changed · {filesCount} files
      </SectionLabel>
      {order === "smart" && smartDiff ? (
        <SmartDiffViewer
          smartDiff={smartDiff}
          files={files}
          commenting={commenting}
          findingsByPath={findingsByPath}
        />
      ) : (
        <DiffViewer files={files} commenting={commenting} />
      )}
    </section>
  );
}
