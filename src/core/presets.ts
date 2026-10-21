import type { Preset } from './types';

const KNOWN = new Set([
  '$schema', 'id', 'name', 'edition', 'pageLimit', 'doubleBlind', 'paperSize', 'referencesCountTowardLimit',
  'referencesPageLimit', 'fonts', 'cfpUrl', 'notes', 'unverified', 'lastChecked',
]);

/** Validate a preset object (mirror of presets/schema.json). Returns a list of problems. */
export function validatePreset(p: any, fileId?: string): string[] {
  const errs: string[] = [];
  if (typeof p !== 'object' || p === null) return ['not an object'];
  for (const k of Object.keys(p)) if (!KNOWN.has(k)) errs.push(`unknown field "${k}"`);
  if (typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) errs.push('id must be kebab-case');
  if (fileId && p.id !== fileId) errs.push(`id "${p.id}" must match file name "${fileId}"`);
  if (typeof p.name !== 'string' || !p.name) errs.push('name is required');
  if (!(p.pageLimit === null || (Number.isInteger(p.pageLimit) && p.pageLimit > 0))) errs.push('pageLimit must be a positive integer or null');
  if (typeof p.doubleBlind !== 'boolean') errs.push('doubleBlind must be boolean');
  if (!['letter', 'a4', null].includes(p.paperSize)) errs.push('paperSize must be "letter", "a4" or null');
  if (typeof p.referencesCountTowardLimit !== 'boolean') errs.push('referencesCountTowardLimit must be boolean');
  if (p.referencesPageLimit != null && !(Number.isInteger(p.referencesPageLimit) && p.referencesPageLimit >= 0))
    errs.push('referencesPageLimit must be a non-negative integer');
  if (p.fonts != null) {
    if (typeof p.fonts !== 'object') errs.push('fonts must be an object');
    else
      for (const [k, v] of Object.entries(p.fonts)) {
        if (!['allowType3', 'requireAllEmbedded'].includes(k)) errs.push(`unknown fonts field "${k}"`);
        else if (typeof v !== 'boolean') errs.push(`fonts.${k} must be boolean`);
      }
  }
  if (typeof p.cfpUrl !== 'string' || (p.cfpUrl && !/^https:\/\//.test(p.cfpUrl))) errs.push('cfpUrl must be an https URL or ""');
  if (!Array.isArray(p.unverified) || p.unverified.some((x: unknown) => typeof x !== 'string' || !KNOWN.has(x as string)))
    errs.push('unverified must list existing field names');
  if (p.lastChecked != null && !/^\d{4}-\d{2}-\d{2}$/.test(p.lastChecked)) errs.push('lastChecked must be YYYY-MM-DD or null');
  return errs;
}

export function sortPresets(list: Preset[]): Preset[] {
  return [...list].sort((a, b) => (a.id.startsWith('generic') ? 1 : 0) - (b.id.startsWith('generic') ? 1 : 0) || a.name.localeCompare(b.name));
}
