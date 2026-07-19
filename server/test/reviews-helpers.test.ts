import { describe, it, expect } from 'vitest';
import { taskLine, classifyFile } from '../src/modules/reviews/helpers.js';

/**
 * Unit coverage for the review task-line. The key invariant: our trusted
 * instruction always tells the model to review the whole diff and never
 * withhold a security/correctness finding — no matter what the PR text claims.
 */

describe('taskLine', () => {
  const pull = { number: 3, title: 'test: vulnerable fixture', author: 'burnjohn' } as never;

  it('names the PR being reviewed', () => {
    const line = taskLine(pull);
    expect(line).toContain('#3');
    expect(line).toContain('test: vulnerable fixture');
  });

  it('keeps the non-negotiable "never withhold security" rule', () => {
    const line = taskLine(pull);
    expect(line).toMatch(/never .*withhold .*(or downgrade )?.*security/i);
    expect(line).toMatch(/review the entire diff/i);
  });
});

/**
 * Smart Diff (L03) file classification — deterministic, pattern-based, no LLM.
 * Patterns live in reviews/constants.ts; precedence boilerplate > wiring > core.
 */
describe('classifyFile (Smart Diff)', () => {
  it('C.P0.1 — lock files ALWAYS boilerplate', () => {
    for (const p of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'deps/foo.lock']) {
      expect(classifyFile(p)).toBe('boilerplate');
    }
  });

  it('C.P0.2 — boilerplate patterns (generated/mechanical)', () => {
    for (const p of [
      'package.json',
      'tsconfig.json',
      'src/__snapshots__/a.snap',
      'README.md',
      'LICENSE',
      '.gitignore',
      'dist/bundle.js',
      'src/db.generated.ts',
      'migrations/0001_init.sql',
    ]) {
      expect(classifyFile(p)).toBe('boilerplate');
    }
  });

  it('C.P0.3 — wiring patterns (glue: index/routes/config/module/setup)', () => {
    for (const p of [
      'src/index.ts',
      'api/routes.ts',
      'src/config.ts',
      'app.module.ts',
      'test/setup.ts',
      'lib/register.ts',
      'src/exports.ts',
    ]) {
      expect(classifyFile(p)).toBe('wiring');
    }
  });

  it('C.P1.1 — core = business logic (no boilerplate/wiring match)', () => {
    for (const p of [
      'src/middleware/ratelimit.ts',
      'src/api/public/webhooks.ts',
      'src/services/payment.ts',
    ]) {
      expect(classifyFile(p)).toBe('core');
    }
  });

  it('C.P1.2 — precedence (boilerplate > wiring) + case-insensitive', () => {
    expect(classifyFile('dist/index.js')).toBe('boilerplate'); // dist beats index
    expect(classifyFile('migrations/config.sql')).toBe('boilerplate'); // migrations beats config
    expect(classifyFile('PACKAGE-LOCK.JSON')).toBe('boilerplate'); // case-insensitive
    expect(classifyFile('Src/Config.TS')).toBe('wiring'); // case-insensitive
  });
});
