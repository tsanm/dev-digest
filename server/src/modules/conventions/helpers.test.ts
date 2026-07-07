import { describe, it, expect } from 'vitest';
import {
  deriveEvidenceLine,
  groundEvidence,
  mergeConventionsSkillBody,
  slugify,
  evidenceRef,
  snippetLineSpan,
} from './helpers.js';

const FILE = `import x from 'y';

async function getUser(id) {
  const user = await db.users.find(id);
  return user;
}
`;

describe('deriveEvidenceLine (A5.P1.1)', () => {
  it('returns the 1-based start line of the snippet', () => {
    expect(deriveEvidenceLine(FILE, 'const user = await db.users.find(id);')).toBe(4);
  });
  it('is whitespace-tolerant', () => {
    expect(deriveEvidenceLine(FILE, '  const   user = await db.users.find(id);  ')).toBe(4);
  });
  it('returns null when the snippet is absent', () => {
    expect(deriveEvidenceLine(FILE, 'not in the file at all')).toBeNull();
  });
});

describe('groundEvidence (A5.P0.1, A5.P0.2)', () => {
  const byPath = new Map([['src/user.ts', FILE]]);

  it('drops a candidate whose evidence_path was not sampled', () => {
    const out = groundEvidence(
      { rule: 'r', evidence_path: 'src/nope.ts', evidence_snippet: 'x', confidence: 0.9 },
      byPath,
    );
    expect(out).toBeNull();
  });

  it('keeps a grounded candidate at full confidence and derives the line', () => {
    const out = groundEvidence(
      {
        rule: 'use await',
        evidence_path: 'src/user.ts',
        evidence_snippet: 'const user = await db.users.find(id);',
        confidence: 0.91,
      },
      byPath,
    );
    expect(out).not.toBeNull();
    expect(out!.confidence).toBe(0.91);
    expect(out!.evidence_line).toBe(4);
  });

  it('caps confidence at 0.5 when the snippet is not found verbatim', () => {
    const out = groundEvidence(
      {
        rule: 'r',
        evidence_path: 'src/user.ts',
        evidence_snippet: 'return res.json(fabricated)',
        confidence: 0.95,
      },
      byPath,
    );
    expect(out).not.toBeNull();
    expect(out!.confidence).toBeLessThanOrEqual(0.5);
  });
});

describe('slugify / evidenceRef', () => {
  it('kebab-cases and caps the rule slug', () => {
    expect(slugify('Always use async/await instead of .then() chains')).toBe('always-use-async-await-instead-of');
  });
  it('builds a path:start-end range from the snippet span', () => {
    expect(snippetLineSpan('a\nb\nc')).toBe(3);
    expect(evidenceRef('f.ts', 4, 'a\nb\nc')).toBe('f.ts:4-6');
    expect(evidenceRef('f.ts', 4, 'a')).toBe('f.ts:4');
    expect(evidenceRef('f.ts', null, 'a')).toBe('f.ts');
  });
});

describe('mergeConventionsSkillBody (A7.P0.1)', () => {
  const items = [
    {
      rule: 'Always use async/await instead of .then() chains',
      evidencePath: 'src/api/users.ts',
      evidenceLine: 23,
      evidenceSnippet: 'const user = await db.users.find(id);',
    },
    {
      rule: 'All public route handlers return typed Result<T, ApiError>',
      evidencePath: 'src/api/public/index.ts',
      evidenceLine: 14,
      evidenceSnippet: 'function handler(): Result<Item[], ApiError> {',
    },
  ];

  it('produces the mockup format: # name + directive intro + one ## <slug> per item', () => {
    const body = mergeConventionsSkillBody('payments-api-conventions', 'payments-api', items);
    expect(body.startsWith('# payments-api-conventions')).toBe(true);
    expect(body).toContain('House conventions for `payments-api`. Flag changes that violate');
    expect(body).toContain('## always-use-async-await-instead');
    expect(body).toContain('Detected in `src/api/users.ts:23`:');
    expect(body).toContain('## all-public-route-handlers-return');
  });

  it('includes ONLY the items passed in (rejected are never merged)', () => {
    const body = mergeConventionsSkillBody('c', 'r', [items[0]!]);
    expect(body).toContain('async-await');
    expect(body).not.toContain('Result<Item');
  });
});
