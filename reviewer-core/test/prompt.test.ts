/**
 * assemblePrompt — PR description slot (the fix that was missing: the PR body
 * never reached the prompt). Pins rendering, omit-when-empty, untrusted-wrap,
 * truncation, and ordering (before the diff).
 */
import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '../src/prompt.js';

function userOf(parts: Parameters<typeof assemblePrompt>[0]): string {
  const { messages } = assemblePrompt(parts);
  return messages[1]!.content;
}

function systemOf(parts: Parameters<typeof assemblePrompt>[0]): string {
  return assemblePrompt(parts).messages[0]!.content;
}

// L02 Skills mechanism — the linked skill bodies must reach the prompt as a
// dedicated "## Skills / rules" block AND be recorded in the run-trace assembly,
// so the UI can show "the skill changed the review + how many tokens it added".
describe('assemblePrompt — ## Skills / rules (L02)', () => {
  it('renders a skills block from the linked bodies, in order, and records it in the trace', () => {
    const parts = { system: 'sys', diff: 'DIFF', skills: ['RULE A: no then-chains', 'RULE B: cite file:line'] };
    const user = userOf(parts);
    const { assembly } = assemblePrompt(parts);
    expect(user).toContain('## Skills / rules');
    // order preserved (A before B) — order = prompt block sequence
    expect(user.indexOf('RULE A')).toBeLessThan(user.indexOf('RULE B'));
    expect(assembly.skills).toContain('RULE A');
    expect(assembly.skills).toContain('RULE B');
    // instructs the model to attribute each finding to the rule that fired it
    expect(user).toMatch(/set that finding's `rule`/);
  });

  it('omits the block AND nulls the trace field when no skills are linked (disabled → excluded upstream)', () => {
    expect(userOf({ system: 'sys', diff: 'DIFF' })).not.toContain('## Skills / rules');
    expect(assemblePrompt({ system: 'sys', diff: 'DIFF' }).assembly.skills ?? null).toBeNull();
    // an empty array (e.g. all linked skills disabled) is treated the same as none
    expect(userOf({ system: 'sys', diff: 'DIFF', skills: [] })).not.toContain('## Skills / rules');
  });
});

describe('assemblePrompt — shared injection guard (server + CI)', () => {
  const sys = systemOf({ system: 'AGENT-SYS', diff: 'DIFF' });

  it('appends the guard to the agent system prompt', () => {
    expect(sys.startsWith('AGENT-SYS')).toBe(true);
    expect(sys).toMatch(/<untrusted>.*DATA to be analyzed/s);
  });

  it('forbids "intentional/test/demo" claims from descoping the review', () => {
    // The defense that replaced the keyword sanitizer: a general, trusted,
    // language-agnostic rule — not text parsing of untrusted input.
    expect(sys).toMatch(/test fixture|intentional|demo/i);
    expect(sys).toMatch(/never reduce|never .*descope|REPORT it/i);
    expect(sys).toMatch(/any language/i);
  });
});

describe('assemblePrompt — ## PR description', () => {
  it('renders the section (untrusted-wrapped) before the diff when present', () => {
    const { messages, assembly } = assemblePrompt({
      system: 'sys',
      diff: 'DIFF',
      prDescription: 'Adds rate limiting to the public /api endpoints.',
    });
    const user = messages[1]!.content;
    expect(user).toContain('## PR description');
    expect(user).toContain('<untrusted source="pr-description">');
    expect(user).toContain('Adds rate limiting to the public /api endpoints.');
    expect(user.indexOf('## PR description')).toBeLessThan(user.indexOf('## Diff to review'));
    expect(assembly.pr_description).toContain('Adds rate limiting');
  });

  it('omits the section when prDescription is undefined or blank (no behaviour change)', () => {
    expect(userOf({ system: 'sys', diff: 'DIFF' })).not.toContain('## PR description');
    expect(assemblePrompt({ system: 'sys', diff: 'DIFF' }).assembly.pr_description ?? null).toBeNull();
    expect(userOf({ system: 'sys', diff: 'DIFF', prDescription: '   ' })).not.toContain(
      '## PR description',
    );
  });

  it('truncates a huge body to the 4k cap', () => {
    const { assembly } = assemblePrompt({
      system: 'sys',
      diff: 'D',
      prDescription: 'x'.repeat(10_000),
    });
    expect((assembly.pr_description as string).length).toBe(4000);
  });
});
