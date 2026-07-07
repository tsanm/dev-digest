import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { SkillType, SkillSource } from '@devdigest/shared';
import * as t from '../../db/schema.js';

/**
 * Conventions Extractor — data access. Owns the `conventions` table (workspace-
 * scoped) and a focused skill-insert (writes the existing `skills` +
 * `skill_versions` tables) used when materializing accepted conventions into a
 * skill — no dependency on the full skills module.
 */

export type ConventionRow = typeof t.conventions.$inferSelect;

export interface InsertConvention {
  workspaceId: string;
  repoId: string;
  category: string | null;
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  evidenceLine: number | null;
  confidence: number;
}

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
  evidenceFiles: string[] | null;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  listForRepo(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      // Stable, useful order: highest-confidence first, id as deterministic tiebreak.
      // Without this Postgres returns heap order — cards reshuffle on refetch and the
      // merged skill's section order is non-deterministic.
      .orderBy(desc(t.conventions.confidence), asc(t.conventions.id));
  }

  async getById(workspaceId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
    return row;
  }

  async listAccepted(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.accepted, true),
        ),
      )
      // Same order as listForRepo so the merged skill body is deterministic.
      .orderBy(desc(t.conventions.confidence), asc(t.conventions.id));
  }

  /** Replace not-yet-accepted candidates (keeps accepted across re-scans), then insert fresh. */
  async replaceForRepo(
    workspaceId: string,
    repoId: string,
    rows: InsertConvention[],
  ): Promise<ConventionRow[]> {
    await this.db
      .delete(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.accepted, false),
        ),
      );
    if (rows.length === 0) return [];
    return this.db
      .insert(t.conventions)
      .values(
        rows.map((r) => ({
          workspaceId: r.workspaceId,
          repoId: r.repoId,
          category: r.category,
          rule: r.rule,
          evidencePath: r.evidencePath,
          evidenceSnippet: r.evidenceSnippet,
          evidenceLine: r.evidenceLine,
          confidence: r.confidence,
          accepted: false,
          rejected: false,
        })),
      )
      .returning();
  }

  async setAccepted(
    workspaceId: string,
    id: string,
    accepted: boolean,
  ): Promise<ConventionRow | undefined> {
    // accept clears reject and vice-versa (mutually exclusive states)
    const [row] = await this.db
      .update(t.conventions)
      .set({ accepted, rejected: accepted ? false : undefined })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  async setRejected(workspaceId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({ rejected: true, accepted: false })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: Partial<Pick<ConventionRow, 'rule' | 'evidenceSnippet' | 'evidenceLine' | 'confidence'>>,
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set(patch)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  /** Insert a skill (+ version 1) into the existing skills tables. Returns the new id. */
  async createSkill(input: InsertSkill): Promise<{ id: string }> {
    const [skill] = await this.db
      .insert(t.skills)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        type: input.type,
        source: input.source,
        body: input.body,
        enabled: input.enabled,
        version: 1,
        evidenceFiles: input.evidenceFiles,
      })
      .returning({ id: t.skills.id });
    const id = skill!.id;
    await this.db.insert(t.skillVersions).values({ skillId: id, version: 1, body: input.body });
    return { id };
  }
}
