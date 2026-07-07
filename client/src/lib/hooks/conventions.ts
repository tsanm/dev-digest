/* hooks/conventions.ts — React Query hooks for the Conventions Extractor (HW-2 Part A). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate, ConventionEdit, ConventionSkillRequest } from "@devdigest/shared";

const key = (repoId: string | null | undefined) => ["conventions", repoId];

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: key(repoId),
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { provider?: "openai" | "anthropic" | "openrouter"; model?: string }) =>
      api.post<ConventionCandidate[]>(`/repos/${repoId}/conventions/extract`, opts ?? {}),
    onSuccess: (data) => qc.setQueryData(key(repoId), data),
  });
}

export function useAcceptConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ConventionCandidate>(`/conventions/${id}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }),
  });
}

export function useRejectConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ConventionCandidate>(`/conventions/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }),
  });
}

export function useEditConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ConventionEdit }) =>
      api.put<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }),
  });
}

export function useCreateConventionSkill(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConventionSkillRequest) =>
      api.post<{ skill_id: string }>(`/repos/${repoId}/conventions/skill`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: key(repoId) });
    },
  });
}
