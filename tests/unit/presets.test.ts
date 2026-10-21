import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatePreset } from '../../src/core/presets';
import { PRESETS } from '../../src/presets';

const dir = join(__dirname, '..', '..', 'presets');
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'schema.json');

describe('presets/*.json', () => {
  it.each(files)('%s is valid', (file) => {
    const p = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    expect(validatePreset(p, file.replace(/\.json$/, ''))).toEqual([]);
  });

  it('all presets are bundled by the loader', () => {
    expect(PRESETS).toHaveLength(files.length);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(files.length);
  });

  it('validator rejects bad input', () => {
    expect(validatePreset({ id: 'X', pageLimit: 0 }).length).toBeGreaterThan(3);
    expect(validatePreset({ ...PRESETS[0], cfpUrl: 'http://insecure' })).toContain('cfpUrl must be an https URL or ""');
    expect(validatePreset({ ...PRESETS[0], sources: ['http://insecure'] })).toContain('sources must be a list of https URLs');
    expect(validatePreset({ ...PRESETS[0], unverified: ['nope'] })).toContain('unverified must list existing field names');
  });
});
