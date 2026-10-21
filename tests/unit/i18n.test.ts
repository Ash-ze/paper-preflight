import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_KEYS, t, ZH_KEYS } from '../../src/i18n';

describe('i18n', () => {
  it('English and Chinese have the same keys', () => {
    expect([...ZH_KEYS].sort()).toEqual([...ALL_KEYS].sort());
  });

  it('every finding code emitted by the checks is translated', () => {
    const dir = join(__dirname, '..', '..', 'src', 'core', 'checks');
    const src = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    const used = new Set([...src.matchAll(/'((?:anon|fonts|pages|refs|paper|images)\.[a-zA-Z]+)'/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(30);
    for (const code of used) expect(ALL_KEYS, code).toContain(code);
  });

  it('interpolates params and translates sizes', () => {
    expect(t('en', 'pages.overBody', { count: 10, limit: 9, over: 1 })).toBe('Main text is 10 pages, limit is 9 (1 over).');
    expect(t('zh', 'paper.mismatch', { count: 2, actual: 'a4', expected: 'letter' })).toBe('2 页为 A4，但会议要求 US Letter。');
  });
});
