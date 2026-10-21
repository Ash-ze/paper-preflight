import type { CheckResult, DocModel, Finding } from '../types';
import { result, snippet } from '../util';

/** "??" (unresolved \ref) and "[?]" / "[?, ?]" (unresolved \cite). */
export const UNRESOLVED = /\?\?+|\[\s*\?(?:\s*[,;]\s*\?)*\s*\]/g;
const MAX = 50;

export function checkUnresolved(doc: DocModel): CheckResult {
  const findings: Finding[] = [];
  let total = 0;
  for (const page of doc.pages) {
    for (const m of page.text.matchAll(UNRESOLVED)) {
      total++;
      if (findings.length >= MAX) continue;
      const kind = m[0].startsWith('[') ? 'cite' : 'ref';
      findings.push({
        severity: 'fail',
        code: kind === 'cite' ? 'refs.cite' : 'refs.ref',
        page: page.number,
        evidence: snippet(page.text, m.index!, m.index! + m[0].length),
      });
    }
  }
  if (total > MAX) findings.push({ severity: 'info', code: 'refs.truncated', params: { total, shown: MAX } });
  return result('refs', findings, 'refs.ok');
}
