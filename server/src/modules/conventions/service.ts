import type { Container } from '../../platform/container.js';
import type {
  ConventionCandidate,
  ConventionEdit,
  ConventionSkillRequest,
  Provider,
} from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { ConventionsRepository, type ConventionRow } from './repository.js';
import { runExtraction, loadRepo } from './extract.js';
import {
  toCandidate,
  mergeConventionsSkillBody,
  groundEvidence,
  type MergeItem,
} from './helpers.js';
import { CONVENTIONS_SKILL_TYPE } from './constants.js';

/**
 * Conventions Extractor service. Extraction lives in extract.ts; this owns the
 * user actions (list / accept / reject / edit) and the "merge accepted → one
 * `repo-conventions` skill (+ optional agent link)" flow.
 */
export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    return (await this.repo.listForRepo(workspaceId, repoId)).map(toCandidate);
  }

  extract(
    workspaceId: string,
    repoId: string,
    opts: { provider?: Provider; model?: string } = {},
  ): Promise<ConventionCandidate[]> {
    return runExtraction(this.container, this.repo, workspaceId, repoId, opts);
  }

  /** Toggle the accepted (selected) state — the mockup's "Accepted" chip deselects on re-click. */
  async accept(workspaceId: string, id: string): Promise<ConventionCandidate> {
    const row = await this.mustGet(workspaceId, id);
    return toCandidate((await this.repo.setAccepted(workspaceId, id, !row.accepted))!);
  }

  async reject(workspaceId: string, id: string): Promise<ConventionCandidate> {
    await this.mustGet(workspaceId, id);
    return toCandidate((await this.repo.setRejected(workspaceId, id))!);
  }

  async edit(workspaceId: string, id: string, patch: ConventionEdit): Promise<ConventionCandidate> {
    const row = await this.mustGet(workspaceId, id);
    const update: Partial<Pick<ConventionRow, 'rule' | 'evidenceSnippet' | 'evidenceLine' | 'confidence'>> = {};
    if (patch.rule !== undefined) update.rule = patch.rule;
    if (patch.evidence_snippet !== undefined) {
      update.evidenceSnippet = patch.evidence_snippet;
      // re-ground the edited snippet against its file (line + confidence stay honest)
      if (row.evidencePath && row.repoId) {
        const repoRow = await loadRepo(this.container, workspaceId, row.repoId);
        const content = await this.container.git
          .readFile({ owner: repoRow.owner, name: repoRow.name }, row.evidencePath)
          .catch(() => '');
        const g = groundEvidence(
          {
            rule: patch.rule ?? row.rule,
            evidence_path: row.evidencePath,
            evidence_snippet: patch.evidence_snippet,
            confidence: row.confidence ?? 0.5,
          },
          new Map([[row.evidencePath, content]]),
        );
        if (g) {
          update.evidenceLine = g.evidence_line;
          update.confidence = g.confidence;
        }
      }
    }
    return toCandidate((await this.repo.update(workspaceId, id, update))!);
  }

  /** Merge accepted candidates into ONE `repo-conventions` skill; optionally link to an agent. */
  async createSkill(
    workspaceId: string,
    repoId: string,
    body: ConventionSkillRequest,
  ): Promise<{ skill_id: string }> {
    const accepted = await this.repo.listAccepted(workspaceId, repoId);
    if (accepted.length === 0) {
      throw new AppError('no_accepted', 'No accepted conventions to create a skill from', 400);
    }
    const repoRow = await loadRepo(this.container, workspaceId, repoId);
    const name = body.name ?? `${repoRow.name}-conventions`;
    const items: MergeItem[] = accepted.map((a) => ({
      rule: a.rule,
      evidencePath: a.evidencePath,
      evidenceLine: a.evidenceLine,
      evidenceSnippet: a.evidenceSnippet,
    }));
    const skillBody = body.body ?? mergeConventionsSkillBody(name, repoRow.name, items);
    const description = body.description ?? `${accepted.length} house conventions extracted from ${repoRow.name}`;
    const evidenceFiles = [
      ...new Set(accepted.map((a) => a.evidencePath).filter((p): p is string => !!p)),
    ];

    const skill = await this.repo.createSkill({
      workspaceId,
      name,
      description,
      type: body.type ?? CONVENTIONS_SKILL_TYPE,
      source: 'extracted',
      body: skillBody,
      enabled: body.enabled ?? true,
      evidenceFiles: evidenceFiles.length ? evidenceFiles : null,
    });

    if (body.agent_id) {
      const links = await this.container.agentsRepo.linkedSkills(body.agent_id);
      await this.container.agentsRepo.linkSkill(body.agent_id, skill.id, links.length);
    }
    return { skill_id: skill.id };
  }

  private async mustGet(workspaceId: string, id: string): Promise<ConventionRow> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) throw new NotFoundError('Convention not found');
    return row;
  }
}
