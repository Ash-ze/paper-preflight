import type { CheckResult, DocModel, Finding, PaperSize } from '../types';
import { result } from '../util';

export const SIZES: Record<PaperSize, [number, number]> = {
  letter: [612, 792],
  a4: [595.276, 841.89],
};
const TOL = 3; // points

export function classify(w: number, h: number): PaperSize | 'other' {
  const [a, b] = [Math.min(w, h), Math.max(w, h)];
  for (const [name, [sw, sh]] of Object.entries(SIZES) as [PaperSize, [number, number]][]) {
    if (Math.abs(a - sw) <= TOL && Math.abs(b - sh) <= TOL) return name;
  }
  return 'other';
}

function fmt(w: number, h: number) {
  return `${(w / 72).toFixed(2)} × ${(h / 72).toFixed(2)} in (${Math.round(w)} × ${Math.round(h)} pt)`;
}

export function checkPaper(doc: DocModel, expected: PaperSize | null): CheckResult {
  const findings: Finding[] = [];
  if (!doc.pages.length) return result('paper', findings, 'paper.ok');
  const first = doc.pages[0];
  const kind = classify(first.width, first.height);
  findings.push({ severity: 'info', code: 'paper.detected', params: { size: kind, dims: fmt(first.width, first.height) } });

  if (expected) {
    const bad = doc.pages.filter((p) => classify(p.width, p.height) !== expected);
    if (bad.length) {
      findings.push({
        severity: 'fail',
        code: 'paper.mismatch',
        page: bad[0].number,
        params: { expected, actual: classify(bad[0].width, bad[0].height), count: bad.length },
      });
    }
  }
  const odd = doc.pages.filter((p) => Math.abs(p.width - first.width) > TOL || Math.abs(p.height - first.height) > TOL);
  if (odd.length) {
    findings.push({
      severity: 'warn',
      code: 'paper.inconsistent',
      page: odd[0].number,
      params: { count: odd.length, dims: fmt(odd[0].width, odd[0].height) },
    });
  }
  return result('paper', findings, 'paper.ok');
}
