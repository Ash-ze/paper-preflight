import type { CheckOptions, CheckResult, DocModel, Finding, PageModel } from '../types';
import { result } from '../util';

const REF_HEADING = /^(?:(?:\d+|[IVX]+|[A-Z])\.?\s+)?(?:references?|bibliography|literature cited|references and notes)\s*$/i;

export interface ReferencesLocation {
  page: number;
  /** true if there is body text above the heading on the same page. */
  sharesPage: boolean;
  lineIndex: number;
}

/** Find the first "References" / "Bibliography" heading line, skipping the first page. */
export function detectReferences(doc: DocModel): ReferencesLocation | null {
  for (const page of doc.pages) {
    if (page.number === 1 && doc.numPages > 1) continue;
    const idx = page.lines.findIndex((l) => REF_HEADING.test(l.text));
    if (idx >= 0) {
      const above = page.lines.slice(0, idx).filter((l) => l.text.length > 25).length;
      return { page: page.number, sharesPage: above >= 2, lineIndex: idx };
    }
  }
  return null;
}

/** Number of main-body pages according to override or detected references. */
export function countBodyPages(doc: DocModel, opts: Pick<CheckOptions, 'bodyEndPage'>): {
  bodyPages: number;
  refs: ReferencesLocation | null;
  source: 'manual' | 'auto' | 'none';
} {
  const refs = detectReferences(doc);
  if (opts.bodyEndPage && opts.bodyEndPage > 0) {
    return { bodyPages: Math.min(opts.bodyEndPage, doc.numPages), refs, source: 'manual' };
  }
  if (refs) return { bodyPages: refs.sharesPage ? refs.page : refs.page - 1, refs, source: 'auto' };
  return { bodyPages: doc.numPages, refs: null, source: 'none' };
}

export function firstLine(page: PageModel | undefined, index: number) {
  const t = page?.lines[index]?.text ?? '';
  return { text: t, start: 0, end: t.length };
}

export function checkPages(doc: DocModel, opts: CheckOptions): CheckResult & { bodyPages: number; refsPage: number | null } {
  const { preset } = opts;
  const { bodyPages, refs, source } = countBodyPages(doc, opts);
  const findings: Finding[] = [];

  findings.push({ severity: 'info', code: 'pages.total', params: { total: doc.numPages, body: bodyPages } });
  if (source === 'auto' && refs) {
    findings.push({
      severity: 'info',
      code: 'pages.refsDetected',
      page: refs.page,
      params: { page: refs.page },
      evidence: firstLine(doc.pages[refs.page - 1], refs.lineIndex),
    });
  } else if (source === 'manual') {
    findings.push({ severity: 'info', code: 'pages.manual', params: { page: bodyPages } });
  } else {
    findings.push({ severity: 'warn', code: 'pages.refsNotFound' });
  }

  if (preset.pageLimit != null) {
    const counted = preset.referencesCountTowardLimit ? doc.numPages : bodyPages;
    const code = preset.referencesCountTowardLimit ? 'pages.overTotal' : 'pages.overBody';
    if (counted > preset.pageLimit) {
      findings.push({
        severity: 'fail',
        code,
        page: preset.pageLimit + 1,
        params: { count: counted, limit: preset.pageLimit, over: counted - preset.pageLimit },
      });
    } else {
      findings.push({ severity: 'pass', code: 'pages.within', params: { count: counted, limit: preset.pageLimit } });
    }
    if (!preset.referencesCountTowardLimit && preset.referencesPageLimit != null && refs && source !== 'none') {
      const refPages = doc.numPages - bodyPages;
      if (refPages > preset.referencesPageLimit) {
        findings.push({
          severity: 'warn',
          code: 'pages.refsLong',
          params: { count: refPages, limit: preset.referencesPageLimit },
        });
      }
    }
  } else {
    findings.push({ severity: 'info', code: 'pages.noLimit' });
  }
  const r = result('pages', findings, 'pages.ok');
  return { ...r, bodyPages, refsPage: refs?.page ?? null };
}

const APPENDIX_HEADING = /^(?:[A-Z]\.?\s+)?(?:appendix|appendices|supplementary\s+materials?|technical\s+appendices)\b/i;

/** First page at or after `from` whose lines contain an appendix heading. */
export function detectAppendix(doc: DocModel, from: number): number | null {
  for (const page of doc.pages) {
    if (page.number <= from) continue;
    if (page.lines.some((l) => APPENDIX_HEADING.test(l.text) && l.text.length < 80)) return page.number;
  }
  return null;
}
