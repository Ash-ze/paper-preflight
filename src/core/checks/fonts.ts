import type { CheckResult, DocModel, Finding, Preset } from '../types';
import { result } from '../util';

/** The 14 standard PDF fonts every conforming viewer must provide. */
export const BASE14 = new Set([
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Symbol', 'ZapfDingbats',
]);

/** Strip a subset tag such as "ABCDEF+" and normalise separators. */
export function baseFontName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '').replace(/,/g, '-');
}

export function isBase14(name: string): boolean {
  return BASE14.has(baseFontName(name));
}

export function checkFonts(doc: DocModel, preset: Preset): CheckResult {
  const findings: Finding[] = [];
  const allowType3 = preset.fonts?.allowType3 ?? true;
  const requireAll = preset.fonts?.requireAllEmbedded ?? false;

  for (const f of doc.fonts) {
    const pages = f.pages.slice(0, 8).join(', ') + (f.pages.length > 8 ? ', …' : '');
    const ev = { text: `${f.name} (${f.type})`, start: 0, end: f.name.length };
    if (f.isType3) {
      findings.push({
        severity: allowType3 ? 'warn' : 'fail',
        code: 'fonts.type3',
        page: f.pages[0],
        params: { name: baseFontName(f.name), pages },
        evidence: ev,
      });
    }
    if (!f.embedded && !f.isType3) {
      if (isBase14(f.name)) {
        findings.push({
          severity: requireAll ? 'fail' : 'warn',
          code: 'fonts.base14',
          page: f.pages[0],
          params: { name: baseFontName(f.name), pages },
          evidence: ev,
        });
      } else {
        findings.push({
          severity: 'fail',
          code: 'fonts.notEmbedded',
          page: f.pages[0],
          params: { name: baseFontName(f.name), pages },
          evidence: ev,
        });
      }
    }
  }
  findings.push({
    severity: 'info',
    code: 'fonts.summary',
    params: {
      count: doc.fonts.length,
      embedded: doc.fonts.filter((f) => f.embedded).length,
      list: doc.fonts.map((f) => `${baseFontName(f.name)} [${f.type}${f.embedded ? '' : ', not embedded'}]`).join('; '),
    },
  });
  findings.push({ severity: 'info', code: 'fonts.limits' });
  return result('fonts', findings, 'fonts.ok');
}
