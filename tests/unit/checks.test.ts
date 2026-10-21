import { describe, expect, it } from 'vitest';
import { baseFontName, checkFonts, isBase14 } from '../../src/core/checks/fonts';
import { checkImages, effectiveDpi } from '../../src/core/checks/images';
import { checkPages, countBodyPages, detectReferences } from '../../src/core/checks/pages';
import { checkPaper, classify } from '../../src/core/checks/paper';
import { checkUnresolved } from '../../src/core/checks/refs';
import { runChecks } from '../../src/core/run';
import { snippet } from '../../src/core/util';
import { BODY, codes, makeDoc, opts, PRESET } from './helpers';

const bodyPages = (n: number) => Array.from({ length: n }, () => [BODY, BODY, BODY]);

describe('unresolved references', () => {
  it('finds ?? and [?] with page and evidence', () => {
    const doc = makeDoc([[BODY], ['As shown in Figure ?? and Section ??.', 'Prior work [?] and [?, ?] did this.']]);
    const r = checkUnresolved(doc);
    expect(r.status).toBe('fail');
    expect(codes(r.findings)).toEqual(['refs.ref', 'refs.ref', 'refs.cite', 'refs.cite']);
    expect(r.findings.every((f) => f.page === 2)).toBe(true);
    const e = r.findings[0].evidence!;
    expect(e.text.slice(e.start, e.end)).toBe('??');
  });

  it('ignores a single question mark', () => {
    expect(checkUnresolved(makeDoc([['Is this right? Yes.']])).status).toBe('pass');
  });

  it('caps the number of findings', () => {
    const doc = makeDoc([Array.from({ length: 80 }, () => 'Fig. ??')]);
    const r = checkUnresolved(doc);
    expect(r.findings.filter((f) => f.code === 'refs.ref')).toHaveLength(50);
    expect(r.findings.at(-1)!.params).toEqual({ total: 80, shown: 50 });
  });
});

describe('page count', () => {
  it('detects a References heading at the top of a page', () => {
    const doc = makeDoc([...bodyPages(8), ['References', '[1] A paper.'], ['[2] Another.']]);
    expect(detectReferences(doc)).toMatchObject({ page: 9, sharesPage: false });
    expect(countBodyPages(doc, { bodyEndPage: null }).bodyPages).toBe(8);
    expect(checkPages(doc, opts()).status).toBe('pass');
  });

  it('counts a page shared by body text and references as body', () => {
    const doc = makeDoc([...bodyPages(8), [BODY, BODY, '7 References', '[1] A paper.']]);
    const r = checkPages(doc, opts());
    expect(r.bodyPages).toBe(9);
    expect(r.status).toBe('fail');
    expect(r.findings.find((f) => f.code === 'pages.overBody')!.params).toMatchObject({ count: 9, limit: 8, over: 1 });
  });

  it('accepts numbered / bibliography variants but not prose', () => {
    for (const h of ['REFERENCES', 'Bibliography', '8. References', 'VII. REFERENCES']) {
      expect(detectReferences(makeDoc([[BODY], [BODY, h]])), h).not.toBeNull();
    }
    expect(detectReferences(makeDoc([[BODY], ['See the references in the appendix for details.']]))).toBeNull();
  });

  it('honours a manual body-end page', () => {
    const doc = makeDoc(bodyPages(12));
    expect(checkPages(doc, opts({ bodyEndPage: 8 })).status).toBe('pass');
    expect(codes(checkPages(doc, opts({ bodyEndPage: 8 })).findings)).toContain('pages.manual');
  });

  it('warns when references cannot be found and uses the total', () => {
    const r = checkPages(makeDoc(bodyPages(10)), opts());
    expect(codes(r.findings)).toContain('pages.refsNotFound');
    expect(r.status).toBe('fail');
  });

  it('counts all pages when references count toward the limit', () => {
    const doc = makeDoc([...bodyPages(7), ['References'], ['x']]);
    const r = checkPages(doc, opts({ preset: { ...PRESET, referencesCountTowardLimit: true } }));
    expect(r.findings.find((f) => f.code === 'pages.overTotal')!.params!.count).toBe(9);
  });

  it('warns when references exceed referencesPageLimit', () => {
    const doc = makeDoc([...bodyPages(7), ['References'], ['x'], ['y']]);
    const r = checkPages(doc, opts({ preset: { ...PRESET, pageLimit: 7, referencesPageLimit: 2 } }));
    expect(codes(r.findings)).toContain('pages.refsLong');
  });
});

describe('fonts', () => {
  const font = (name: string, type: string, embedded = true) => ({ name, type, isType3: type === 'Type3', embedded, pages: [1, 2] });

  it('normalises names', () => {
    expect(baseFontName('ABCDEF+Times-Roman')).toBe('Times-Roman');
    expect(isBase14('Helvetica,Bold')).toBe(true);
    expect(isBase14('Arial')).toBe(false);
    expect(isBase14('XYZABC+Helvetica-Bold')).toBe(true);
  });

  it('fails on Type 3 when the venue forbids it, warns otherwise', () => {
    const doc = makeDoc([[BODY]], { fonts: [font('DejaVuSans', 'Type3')] });
    expect(checkFonts(doc, PRESET).status).toBe('fail');
    expect(checkFonts(doc, { ...PRESET, fonts: { allowType3: true } }).status).toBe('warn');
  });

  it('warns on non-embedded Base-14, fails on other non-embedded fonts', () => {
    const b14 = makeDoc([[BODY]], { fonts: [font('Helvetica', 'Type1', false)] });
    expect(checkFonts(b14, PRESET).findings[0]).toMatchObject({ code: 'fonts.base14', severity: 'warn', page: 1 });
    expect(checkFonts(b14, { ...PRESET, fonts: { requireAllEmbedded: true } }).status).toBe('fail');
    const other = makeDoc([[BODY]], { fonts: [font('Calibri', 'TrueType', false)] });
    expect(checkFonts(other, PRESET).findings[0]).toMatchObject({ code: 'fonts.notEmbedded', severity: 'fail' });
  });

  it('passes when all fonts are embedded', () => {
    const doc = makeDoc([[BODY]], { fonts: [font('AAAAAA+NimbusRomNo9L-Regu', 'Type1')] });
    const r = checkFonts(doc, PRESET);
    expect(r.status).toBe('pass');
    expect(codes(r.findings)).toEqual(['fonts.ok', 'fonts.summary', 'fonts.limits']);
  });
});

describe('paper size', () => {
  it('classifies letter and A4 in either orientation', () => {
    expect(classify(612, 792)).toBe('letter');
    expect(classify(842, 595)).toBe('a4');
    expect(classify(500, 700)).toBe('other');
  });

  it('fails on a mismatch with the preset and warns on mixed sizes', () => {
    const a4 = makeDoc([[BODY], [BODY]], {}, [595.28, 841.89]);
    expect(checkPaper(a4, 'letter').findings.find((f) => f.code === 'paper.mismatch')).toMatchObject({ page: 1, severity: 'fail' });
    expect(checkPaper(a4, 'a4').status).toBe('pass');
    const mixed = makeDoc([[BODY], [BODY]]);
    mixed.pages[1].width = 595.28;
    mixed.pages[1].height = 841.89;
    expect(codes(checkPaper(mixed, null).findings)).toContain('paper.inconsistent');
  });
});

describe('images', () => {
  it('computes effective DPI and flags low-resolution bitmaps', () => {
    const img = { page: 1, pxWidth: 300, pxHeight: 300, widthPt: 144, heightPt: 144 };
    expect(effectiveDpi(img)).toBe(150);
    const doc = makeDoc([[BODY]]);
    doc.pages[0].images.push({ ...img, pxWidth: 100, pxHeight: 100 }, img, { ...img, pxWidth: 5, pxHeight: 5, widthPt: 10, heightPt: 10 });
    const r = checkImages(doc, 150);
    expect(r.findings.filter((f) => f.code === 'images.lowres')).toHaveLength(1);
    expect(r.findings[0].params!.dpi).toBe(50);
  });
});

describe('runChecks + snippet', () => {
  it('aggregates status across checks', () => {
    const doc = makeDoc([...bodyPages(3), ['References', 'x']]);
    const rep = runChecks(doc, opts());
    expect(rep.checks.map((c) => c.id)).toEqual(['anonymity', 'fonts', 'pages', 'refs', 'paper', 'images']);
    expect(rep.status).toBe('pass');
    expect(rep.bodyPages).toBe(3);
  });

  it('snippet keeps the highlight on the matched text', () => {
    const t = 'a'.repeat(200) + 'NEEDLE' + 'b'.repeat(200);
    const s = snippet(t, 200, 206, 20);
    expect(s.text.slice(s.start, s.end)).toBe('NEEDLE');
    expect(s.text.startsWith('\u2026')).toBe(true);
  });
});
