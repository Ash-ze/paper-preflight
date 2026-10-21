import type { CheckId, CheckResult, Evidence, Finding, Severity } from './types';

// 'info' never raises a check's status.
const ORDER: Record<Severity, number> = { pass: 0, info: 0, warn: 2, fail: 3 };

export function worst(list: Severity[]): Severity {
  return list.reduce<Severity>((a, b) => (ORDER[b] > ORDER[a] ? b : a), 'pass');
}

/** Build a CheckResult; adds a pass finding when there are only informational findings. */
export function result(id: CheckId, findings: Finding[], okCode: string): CheckResult {
  const decided = findings.some((f) => f.severity !== 'info');
  const all = decided ? findings : [{ severity: 'pass' as const, code: okCode }, ...findings];
  return { id, status: worst(all.map((f) => f.severity)), findings: all };
}

/** Context snippet around [start, end) of text, with the highlight range remapped. */
export function snippet(text: string, start: number, end: number, radius = 70): Evidence {
  const s = Math.max(0, start - radius);
  const e = Math.min(text.length, end + radius);
  let out = text.slice(s, e).replace(/\n/g, ' ');
  let off = s;
  let prefix = '';
  if (s > 0) {
    prefix = '…';
  }
  const suffix = e < text.length ? '…' : '';
  out = prefix + out + suffix;
  off -= prefix.length;
  return { text: out, start: start - off, end: end - off };
}

/** Lower-case, strip diacritics, collapse whitespace. Keeps string length stable enough for matching. */
export function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case/diacritic-insensitive regex for a user-supplied term, matching whole words
 * and allowing any whitespace between words. Intended for use on fold()-ed text.
 */
export function termRegex(term: string): RegExp | null {
  const t = fold(term).trim();
  if (t.length < 2) return null;
  const body = t.split(/\s+/).map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'gu');
}

/**
 * fold() can change string length (e.g. ligatures). To report evidence on the original text we
 * fold character-by-character and keep an index map.
 */
export function foldWithMap(s: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const f = fold(s[i]);
    for (let k = 0; k < f.length; k++) {
      folded += f[k];
      map.push(i);
    }
  }
  map.push(s.length);
  return { folded, map };
}

export function parseList(raw: string): string[] {
  return raw
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}
