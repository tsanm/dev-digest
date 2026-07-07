import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ConventionEdit, ConventionSkillRequest } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { ConventionsService } from './service.js';

/**
 * Conventions Extractor (HW-2 Part A):
 *   GET  /repos/:id/conventions          → list candidates
 *   POST /repos/:id/conventions/extract  → scan (samples → LLM → ground) → candidates
 *   POST /repos/:id/conventions/skill    → merge accepted → one skill (+ optional agent link)
 *   POST /conventions/:id/accept | reject
 *   PUT  /conventions/:id                → edit rule / evidence (re-grounds)
 */

const ExtractBody = z
  .object({
    provider: z.enum(['openai', 'anthropic', 'openrouter']).optional(),
    model: z.string().optional(),
  })
  .optional();

export default async function conventionsRoutes(app: FastifyInstance) {
  const service = new ConventionsService(app.container);

  app.get<{ Params: { id: string } }>('/repos/:id/conventions', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post<{ Params: { id: string } }>('/repos/:id/conventions/extract', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = ExtractBody.parse(req.body ?? {}) ?? {};
    return service.extract(workspaceId, req.params.id, {
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.model ? { model: body.model } : {}),
    });
  });

  app.post<{ Params: { id: string } }>('/repos/:id/conventions/skill', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = ConventionSkillRequest.parse(req.body ?? {});
    return service.createSkill(workspaceId, req.params.id, body);
  });

  app.post<{ Params: { id: string } }>('/conventions/:id/accept', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.accept(workspaceId, req.params.id);
  });

  app.post<{ Params: { id: string } }>('/conventions/:id/reject', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.reject(workspaceId, req.params.id);
  });

  app.put<{ Params: { id: string } }>('/conventions/:id', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const patch = ConventionEdit.parse(req.body ?? {});
    return service.edit(workspaceId, req.params.id, patch);
  });
}
