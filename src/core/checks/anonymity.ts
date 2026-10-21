import type { CheckOptions, CheckResult, DocModel, Finding, PageModel } from '../types';
import { fold, foldWithMap, result, snippet, termRegex } from '../util';

const ACK_HEADING = /^(?:(?:\d+(?:\.\d+)*|[A-Z])\.?\s+)?acknowledge?ments?\b/i;

/** Code-hosting user / organisation links. Group 1: host, group 2: account name. */
export const HOST_LINK =
  /\b(?:https?:\/\/)?(?:www\.)?(github\.com|gitlab\.com|huggingface\.co|bitbucket\.org|codeberg\.org)\/(?:(?:datasets|spaces|models)\/)?([A-Za-z0-9][A-Za-z0-9_.-]*)/gi;
/** Personal homepage patterns. */
export const HOMEPAGE =
  /\b(?:https?:\/\/)?(?:[A-Za-z0-9-]+\.github\.io|sites\.google\.com\/(?:view|site)\/[A-Za-z0-9_-]+|[A-Za-z0-9.-]+\.[a-z]{2,}\/~[A-Za-z0-9_.-]+|scholar\.google\.[a-z.]+\/citations\?user=[A-Za-z0-9_-]+|orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX])/gi;
export const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
/** Generic institution words; only searched in the first-page author block. */
export const INSTITUTION =
  /\b(?:University|Universit[éäà]t?|Universidad|Universidade|Università|Institute|Institut|College|Laborator(?:y|ies)|Lab|School of|Department of|Dept\.? of|Faculty of|Academy of Sciences|Research Center|Research Centre|Inc\.|Ltd\.?|LLC|GmbH|Corporation)\b/g;
export const SELF_CITE = new RegExp(
  [
    String.raw`\bour\s+(?:own\s+)?(?:previous|prior|earlier|past|preceding|recent)\s+(?:work|works|paper|papers|study|studies|publication|publications|approach|method|version|conference\s+version|findings)\b`,
    String.raw`\bin\s+our\s+(?:previous|prior|earlier|other)\s+(?:work|paper|study|publication)\b`,
    String.raw`\bwe\s+(?:have\s+)?previously\b`,
    String.raw`\bas\s+we\s+(?:have\s+)?(?:showed|shown|demonstrated|proposed|argued|reported)\s+(?:in|before|earlier)\b`,
    String.raw`\b(?:extends?|extending|builds?\s+on|building\s+on)\s+our\b`,
  ].join('|'),
  'gi',
);

const ANON_OK = /anonym|blind[-_ ]?review|xxxx|@example\.(?:com|org|net)\b/i;
const PATH_LEAK = /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)([^/\\\s]+)/;
const NAME_KEYS = /^(Author|dc:creator|pdf:Author|xmp:Author|photoshop:AuthorsPosition|xmpRights:Owner|dc:rights)$/i;

/** "Alex Placeholder" / "alex-placeholder" / "AlexPlaceholder" -> "alexplaceholder" */
const compact = (s: string) => fold(s).replace(/[^\p{L}\p{N}]/gu, '');

interface Ctx {
  doc: DocModel;
  compactNames: string[];
  inRefs: (p: PageModel) => boolean;
  names: RegExp[];
  affils: RegExp[];
}

function push(fs: Finding[], f: Finding, seen: Set<string>) {
  const key = `${f.code}|${f.page}|${JSON.stringify(f.params ?? {})}|${f.evidence?.text.slice(f.evidence.start, f.evidence.end).toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  fs.push(f);
}

function matchesAny(regs: RegExp[], text: string): { start: number; end: number } | null {
  const { folded, map } = foldWithMap(text);
  for (const r of regs) {
    r.lastIndex = 0;
    const m = r.exec(folded);
    if (m) return { start: map[m.index], end: map[m.index + m[0].length] };
  }
  return null;
}

function allMatches(regs: RegExp[], text: string): { start: number; end: number; term: string }[] {
  const { folded, map } = foldWithMap(text);
  const out: { start: number; end: number; term: string }[] = [];
  for (const r of regs) {
    r.lastIndex = 0;
    for (const m of folded.matchAll(r)) {
      out.push({ start: map[m.index!], end: map[m.index! + m[0].length], term: text.slice(map[m.index!], map[m.index! + m[0].length]) });
    }
  }
  return out;
}

function checkMetadata(ctx: Ctx, fs: Finding[], seen: Set<string>) {
  const fields: [string, string][] = [
    ...Object.entries(ctx.doc.info).map(([k, v]) => [k, v] as [string, string]),
    ...Object.entries(ctx.doc.xmp).map(([k, v]) => [`XMP ${k}`, v] as [string, string]),
  ];
  for (const [key, value] of fields) {
    const bare = key.replace(/^XMP /, '');
    const ev = { text: `${key}: ${value}`, start: key.length + 2, end: key.length + 2 + value.length };
    if (NAME_KEYS.test(bare) && value.trim() && !ANON_OK.test(value)) {
      push(fs, { severity: 'fail', code: 'anon.metaAuthor', params: { field: key }, evidence: ev }, seen);
      continue;
    }
    const hit = matchesAny([...ctx.names, ...ctx.affils], value);
    if (hit) {
      push(fs, {
        severity: 'fail', code: 'anon.metaName', params: { field: key },
        evidence: { text: ev.text, start: key.length + 2 + hit.start, end: key.length + 2 + hit.end },
      }, seen);
      continue;
    }
    const path = PATH_LEAK.exec(value);
    if (path) {
      push(fs, {
        severity: 'warn', code: 'anon.metaPath', params: { field: key },
        evidence: { text: ev.text, start: key.length + 2 + path.index, end: key.length + 2 + path.index + path[0].length },
      }, seen);
    }
  }
  const tools = ['Creator', 'Producer'].filter((k) => ctx.doc.info[k]).map((k) => `${k}: ${ctx.doc.info[k]}`);
  if (tools.length) fs.push({ severity: 'info', code: 'anon.metaTools', params: { tools: tools.join(' · ') } });
}

function authorBlockEnd(page: PageModel): number {
  const idx = page.lines.findIndex((l) => /^\s*abstract\b/i.test(l.text));
  const lineIdx = idx > 0 ? idx : Math.min(page.lines.length, 12);
  return page.lines.slice(0, lineIdx).reduce((n, l) => n + l.text.length + 1, 0);
}

function checkPage(ctx: Ctx, page: PageModel, fs: Finding[], seen: Set<string>) {
  const text = page.text;
  const refs = ctx.inRefs(page);
  const p = page.number;

  // Acknowledgements heading
  let offset = 0;
  for (const line of page.lines) {
    if (ACK_HEADING.test(line.text) && line.text.length < 120) {
      push(fs, { severity: 'fail', code: 'anon.ack', page: p, evidence: snippet(text, offset, offset + line.text.length, 120) }, seen);
    }
    offset += line.text.length + 1;
  }

  // user-supplied names / affiliations
  for (const m of allMatches(ctx.names, text)) {
    push(fs, {
      severity: refs ? 'warn' : 'fail', code: refs ? 'anon.nameInRefs' : 'anon.name', page: p,
      params: { term: m.term }, evidence: snippet(text, m.start, m.end),
    }, seen);
  }
  for (const m of allMatches(ctx.affils, text)) {
    push(fs, {
      severity: refs ? 'warn' : 'fail', code: 'anon.affil', page: p,
      params: { term: m.term }, evidence: snippet(text, m.start, m.end),
    }, seen);
  }

  if (refs) return; // links/e-mails in the bibliography are normal

  // code-hosting links, in text and in link annotations
  const sources: { text: string; fromAnnot: boolean }[] = [{ text, fromAnnot: false }, ...page.links.map((u) => ({ text: u, fromAnnot: true }))];
  for (const src of sources) {
    for (const m of src.text.matchAll(HOST_LINK)) {
      const user = m[2];
      if (ANON_OK.test(user)) continue;
      const isAuthor = ctx.compactNames.some((n) => compact(user).includes(n));
      push(fs, {
        severity: isAuthor ? 'fail' : 'warn', code: 'anon.hostLink', page: p,
        params: { host: m[1].toLowerCase(), user },
        evidence: src.fromAnnot ? { text: src.text, start: m.index!, end: m.index! + m[0].length } : snippet(text, m.index!, m.index! + m[0].length),
      }, seen);
    }
    for (const m of src.text.matchAll(HOMEPAGE)) {
      if (ANON_OK.test(m[0])) continue;
      push(fs, {
        severity: 'warn', code: 'anon.homepage', page: p,
        evidence: src.fromAnnot ? { text: src.text, start: m.index!, end: m.index! + m[0].length } : snippet(text, m.index!, m.index! + m[0].length),
      }, seen);
    }
  }

  // e-mail addresses (mailto: annotations included)
  for (const src of sources) {
    for (const m of src.text.matchAll(EMAIL)) {
      if (ANON_OK.test(m[0])) continue;
      push(fs, {
        severity: p === 1 ? 'fail' : 'warn', code: 'anon.email', page: p,
        evidence: src.fromAnnot ? { text: src.text, start: m.index!, end: m.index! + m[0].length } : snippet(text, m.index!, m.index! + m[0].length),
      }, seen);
    }
  }

  // institution words in the first-page author block
  if (p === 1) {
    const end = authorBlockEnd(page);
    for (const m of text.slice(0, end).matchAll(INSTITUTION)) {
      push(fs, { severity: 'warn', code: 'anon.institution', page: p, params: { term: m[0] }, evidence: snippet(text, m.index!, m.index! + m[0].length) }, seen);
    }
  }

  // self-citation phrasing
  for (const m of text.matchAll(SELF_CITE)) {
    push(fs, { severity: 'warn', code: 'anon.selfCite', page: p, evidence: snippet(text, m.index!, m.index! + m[0].length) }, seen);
  }
}

/**
 * @param isBibliographyPage pages that hold only the reference list; link and e-mail checks are
 *        skipped there and author-name matches are downgraded (third-person self-citation is fine).
 */
export function checkAnonymity(doc: DocModel, opts: CheckOptions, isBibliographyPage: (page: number) => boolean): CheckResult {
  const fs: Finding[] = [];
  if (!opts.preset.doubleBlind) {
    fs.push({ severity: 'info', code: 'anon.notBlind' });
  }
  const ctx: Ctx = {
    doc,
    inRefs: (pg) => isBibliographyPage(pg.number),
    compactNames: opts.authorNames.map(compact).filter((n) => n.length >= 4),
    names: opts.authorNames.map(termRegex).filter((r): r is RegExp => r !== null),
    affils: opts.affiliations.map(termRegex).filter((r): r is RegExp => r !== null),
  };
  const seen = new Set<string>();
  checkMetadata(ctx, fs, seen);
  for (const page of doc.pages) checkPage(ctx, page, fs, seen);
  if (!opts.preset.doubleBlind) {
    // downgrade everything: anonymity is not required for this venue
    for (const f of fs) if (f.severity === 'fail' || f.severity === 'warn') f.severity = 'info';
  }
  if (!ctx.names.length && !ctx.affils.length) fs.push({ severity: 'info', code: 'anon.addNames' });
  return result('anonymity', fs, 'anon.ok');
}
