/**
 * End-to-end through pdf.js (Node legacy build) on the generated fixtures.
 * Regenerate fixtures with `npm run fixtures`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { extractDocument } from '../../src/core/extract';
import { runChecks } from '../../src/core/run';
import type { CheckId, Report } from '../../src/core/types';
import { PRESETS } from '../../src/presets';
import { opts } from './helpers';

const load = (name: string) => new Uint8Array(readFileSync(join(__dirname, '..', 'fixtures', name)));
const preset = (id: string) => PRESETS.find((p) => p.id === id)!;
const check = (r: Report, id: CheckId) => r.checks.find((c) => c.id === id)!;
const codes = (r: Report, id: CheckId) => check(r, id).findings.map((f) => f.code);

async function analyse(file: string, presetId: string, extra = {}) {
  const doc = await extractDocument(pdfjs as any, load(file));
  return { doc, report: runChecks(doc, opts({ preset: preset(presetId), ...extra })) };
}

describe('fixture: clean.pdf', () => {
  it('passes every check for NeurIPS', async () => {
    const { doc, report } = await analyse('clean.pdf', 'neurips');
    expect(doc.numPages).toBe(10);
    expect(report.referencesPage).toBe(9);
    expect(report.bodyPages).toBe(8);
    for (const c of report.checks) expect(c.status, c.id).toBe('pass');
    expect(doc.fonts.every((f) => f.embedded && !f.isType3)).toBe(true);
  });
});

describe('fixture: leaky.pdf', () => {
  it('reports the anonymity leaks, unresolved refs, fonts and low-res image', async () => {
    const { doc, report } = await analyse('leaky.pdf', 'neurips', { authorNames: ['Alex Placeholder'], affiliations: ['Exampleton Robotics Lab'] });
    expect(doc.info.Author).toBe('Alex Placeholder');
    expect(doc.xmp['dc:creator']).toBe('Alex Placeholder');
    const anon = check(report, 'anonymity');
    expect(anon.status).toBe('fail');
    const c = codes(report, 'anonymity');
    for (const code of ['anon.metaAuthor', 'anon.metaName', 'anon.ack', 'anon.hostLink', 'anon.email', 'anon.institution', 'anon.selfCite', 'anon.name', 'anon.affil']) {
      expect(c, code).toContain(code);
    }
    expect(anon.findings.find((f) => f.code === 'anon.ack')!.page).toBe(4);
    const gh = anon.findings.filter((f) => f.code === 'anon.hostLink');
    expect(gh.some((f) => f.params!.host === 'github.com' && f.params!.user === 'alexplaceholder')).toBe(true);
    expect(gh.some((f) => f.params!.host === 'huggingface.co')).toBe(true);

    const refs = check(report, 'refs');
    expect(refs.findings.map((f) => [f.code, f.page])).toEqual([
      ['refs.ref', 2],
      ['refs.cite', 3],
    ]);

    expect(codes(report, 'fonts')).toContain('fonts.base14');
    expect(check(report, 'images').findings.find((f) => f.code === 'images.lowres')).toMatchObject({ page: 2, params: { dpi: 6 } });
  });
});

describe('fixture: overlength.pdf', () => {
  it('fails the NeurIPS page limit and paper size', async () => {
    const { report } = await analyse('overlength.pdf', 'neurips');
    expect(report.bodyPages).toBe(12);
    expect(check(report, 'pages').findings.find((f) => f.code === 'pages.overBody')!.params).toMatchObject({ count: 12, limit: 9, over: 3 });
    expect(check(report, 'paper').findings.find((f) => f.code === 'paper.mismatch')!.params!.actual).toBe('a4');
  });

  it('passes paper size for an A4 venue', async () => {
    const { report } = await analyse('overlength.pdf', 'acl-long');
    expect(check(report, 'paper').status).toBe('pass');
  });
});

describe('fixture: type3.pdf (matplotlib, pdf.fonttype=3)', () => {
  it('detects the Type 3 font', async () => {
    const { doc, report } = await analyse('type3.pdf', 'icml');
    expect(doc.fonts.some((f) => f.isType3)).toBe(true);
    const f = check(report, 'fonts').findings.find((x) => x.code === 'fonts.type3')!;
    expect(f.severity).toBe('fail');
    expect(f.page).toBe(1);
  });
});
