import type { Container } from '../../platform/container.js';
import type { Skill, SkillType, SkillSource } from '@devdigest/shared';
import { wrapUntrusted } from '../../platform/prompt.js';
import { AppError } from '../../platform/errors.js';
import { SkillsRepository } from './repository.js';
import { toDto, inferType, firstLine } from './helpers.js';
import { DEFAULT_IMPORT_SOURCE, DEFAULT_SKILL_NAME } from './constants.js';

/**
 * Skills service. Create/update/toggle skills, version them, and import from a
 * file body.
 *
 * Prompt-injection hardening: imported skill bodies are UNTRUSTED. We wrap them
 * in delimiters (`wrapUntrusted`) so when assembled into a review prompt they are
 * treated strictly as data, never as instructions.
 *
 * Pure helpers (toDto / inferType / firstLine) live in helpers.ts; literals live
 * in constants.ts. (Community-catalog + URL import are intentionally out of scope
 * for this build — see lab-2 "поза скоупом".)
 */

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toDto(row) : undefined;
  }

  /** Delete a skill (and its versions/agent-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async create(
    workspaceId: string,
    input: {
      name: string;
      description?: string;
      type?: SkillType;
      source?: SkillSource;
      body: string;
      enabled?: boolean;
      evidenceFiles?: string[] | null;
    },
  ): Promise<Skill> {
    const source = input.source ?? 'manual';
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description ?? firstLine(input.body, input.name),
      type: input.type ?? inferType(input.name, input.body),
      source,
      body: input.body,
      enabled: input.enabled ?? true,
      evidenceFiles: input.evidenceFiles ?? null,
    });
    return toDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: { name?: string; description?: string; type?: SkillType; body?: string; enabled?: boolean },
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toDto(row) : undefined;
  }

  /**
   * Import a skill from a raw file body. The content is UNTRUSTED — we wrap it in
   * delimiters so prompt assembly (and the skill preview) treat it as data, never
   * instructions. Imported skills land DISABLED so a human must vet + enable them
   * before an agent can use them (the "preview before save / untrusted" gate).
   */
  async importSkill(
    workspaceId: string,
    input: { body: string; name?: string; source?: SkillSource },
  ): Promise<Skill> {
    const rawBody = input.body;
    if (!rawBody || !rawBody.trim()) {
      throw new AppError('empty_skill_body', 'Imported skill body is empty', 400);
    }
    const source: SkillSource = input.source ?? DEFAULT_IMPORT_SOURCE;
    const resolvedName = input.name ?? firstLine(rawBody, DEFAULT_SKILL_NAME);
    const safeBody = wrapUntrusted(`imported:${source}`, rawBody.trim());

    return this.create(workspaceId, {
      name: resolvedName,
      body: safeBody,
      source,
      // Imported skills arrive disabled — explicit vetting gate before use.
      enabled: false,
    });
  }

  /** Make a skill available to an agent via agent_skills. */
  async linkToAgent(
    workspaceId: string,
    agentId: string,
    skillId: string,
    order = 0,
  ): Promise<void> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) throw new AppError('skill_not_found', 'Skill not found', 404);
    await this.repo.linkToAgent(agentId, skillId, order);
  }

  async skillsForAgent(agentId: string): Promise<Skill[]> {
    const rows = await this.repo.skillsForAgent(agentId);
    return rows.map(toDto);
  }
}
