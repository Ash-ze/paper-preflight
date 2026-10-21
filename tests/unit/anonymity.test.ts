import { describe, expect, it } from 'vitest';
import { checkAnonymity } from '../../src/core/checks/anonymity';
import { BODY, codes, makeDoc, opts, PRESET } from './helpers';

const none = () => false;

describe('anonymity: metadata', () => {
  it('fails on a non-empty Author field and XMP dc:creator', () => {
    const doc = makeDoc([[BODY]], { info: { Author: 'Alex Placeholder', Creator: 'LaTeX' }, xmp: { 'dc:creator': 'Alex Placeholder' } });
    const r = checkAnonymity(doc, opts(), none);
    expect(r.status).toBe('fail');
    expect(r.findings.filter((f) => f.code === 'anon.metaAuthor')).toHaveLength(2);
  });

  it('accepts an anonymous Author value', () => {
    const doc = makeDoc([[BODY]], { info: { Author: 'Anonymous Authors' } });
    expect(codes(checkAnonymity(doc, opts(), none).findings)).not.toContain('anon.metaAuthor');
  });

  it('finds user names in other metadata fields, diacritic-insensitive', () => {
    const doc = makeDoc([[BODY]], { info: { Title: 'Notes by José Ñandú' } });
    const r = checkAnonymity(doc, opts({ authorNames: ['jose nandu'] }), none);
    const f = r.findings.find((x) => x.code === 'anon.metaName')!;
    expect(f.severity).toBe('fail');
    expect(f.evidence!.text.slice(f.evidence!.start, f.evidence!.end)).toBe('José Ñandú');
  });

  it('warns on a home-directory path in Creator', () => {
    const doc = makeDoc([[BODY]], { info: { Creator: 'C:\\Users\\someone\\paper.tex' } });
    expect(codes(checkAnonymity(doc, opts(), none).findings)).toContain('anon.metaPath');
  });
});

describe('anonymity: body text', () => {
  it('flags an Acknowledgments heading (both spellings, numbered)', () => {
    for (const h of ['Acknowledgments', 'Acknowledgements', '6 Acknowledgement', 'Acknowledgments. We thank X.']) {
      const doc = makeDoc([[BODY], [h, BODY]]);
      const f = checkAnonymity(doc, opts(), none).findings.find((x) => x.code === 'anon.ack');
      expect(f, h).toBeDefined();
      expect(f!.page).toBe(2);
    }
  });

  it('does not flag "acknowledge" used in a sentence', () => {
    const doc = makeDoc([[BODY, 'We acknowledge that this is a limitation of the method.']]);
    expect(codes(checkAnonymity(doc, opts(), none).findings)).not.toContain('anon.ack');
  });

  it('flags github / huggingface user links but not anonymous mirrors', () => {
    const doc = makeDoc([[BODY, 'Code at https://github.com/someuser/repo and huggingface.co/datasets/orgname/data', 'Mirror: https://anonymous.4open.science/r/abc and github.com/anonymous-submission/x']]);
    const hits = checkAnonymity(doc, opts(), none).findings.filter((f) => f.code === 'anon.hostLink');
    expect(hits.map((h) => h.params!.user)).toEqual(['someuser', 'orgname']);
    expect(hits.every((h) => h.severity === 'warn')).toBe(true);
  });

  it('escalates a code link to fail when the account matches an author name', () => {
    const doc = makeDoc([[BODY, 'see github.com/alex-placeholder/tool']]);
    const r = checkAnonymity(doc, opts({ authorNames: ['Alex Placeholder'] }), none);
    expect(r.findings.find((f) => f.code === 'anon.hostLink')!.severity).toBe('fail');
    const joined = makeDoc([[BODY, 'see github.com/AlexPlaceholder/tool']]);
    expect(checkAnonymity(joined, opts({ authorNames: ['Alex Placeholder'] }), none).findings.find((f) => f.code === 'anon.hostLink')!.severity).toBe('fail');
  });

  it('checks link annotations as well as text', () => {
    const doc = makeDoc([[BODY]]);
    doc.pages[0].links.push('https://gitlab.com/someone/project', 'mailto:someone@uni.example.org');
    const c = codes(checkAnonymity(doc, opts(), none).findings);
    expect(c).toContain('anon.hostLink');
    expect(c).toContain('anon.email');
  });

  it('flags e-mails (fail on page 1) and homepages', () => {
    const doc = makeDoc([[BODY, 'contact: first.last@cs.exampleton.edu'], ['see https://someone.github.io/ and www.exampleton.edu/~someone']]);
    const fs = checkAnonymity(doc, opts(), none).findings;
    expect(fs.find((f) => f.code === 'anon.email')!.severity).toBe('fail');
    expect(fs.filter((f) => f.code === 'anon.homepage')).toHaveLength(2);
  });

  it('flags institution words only in the first-page author block', () => {
    const doc = makeDoc([
      ['Title of Paper', 'Department of Computing, University of Exampleton', 'Abstract', 'We study the University of X dataset.'],
      ['Data from Example University was used.'],
    ]);
    const fs = checkAnonymity(doc, opts(), none).findings.filter((f) => f.code === 'anon.institution');
    expect(fs.map((f) => f.params!.term)).toEqual(['Department of', 'University']);
    expect(fs.every((f) => f.page === 1)).toBe(true);
  });

  it('flags self-citation phrasing', () => {
    const phrases = ['Building on our previous work [3],', 'In our prior paper we showed', 'we previously proposed a method', 'This extends our earlier study.', 'as we have shown in [2]'];
    for (const p of phrases) {
      const doc = makeDoc([[BODY, p]]);
      expect(codes(checkAnonymity(doc, opts(), none).findings), p).toContain('anon.selfCite');
    }
    const neutral = makeDoc([[BODY, 'Previous work [3] studied this; our method differs.']]);
    expect(codes(checkAnonymity(neutral, opts(), none).findings)).not.toContain('anon.selfCite');
  });

  it('matches user-supplied names and affiliations, downgraded in the bibliography', () => {
    const doc = makeDoc([[BODY, 'Joint work with Alex Placeholder at Exampleton Robotics Lab.'], ['References', '[1] A. Placeholder, Alex Placeholder. 2023.']]);
    const fs = checkAnonymity(doc, opts({ authorNames: ['Alex Placeholder'], affiliations: ['Exampleton Robotics Lab'] }), (p) => p === 2).findings;
    expect(fs.find((f) => f.code === 'anon.name')!.page).toBe(1);
    expect(fs.find((f) => f.code === 'anon.affil')!.severity).toBe('fail');
    const inRefs = fs.find((f) => f.code === 'anon.nameInRefs')!;
    expect(inRefs.page).toBe(2);
    expect(inRefs.severity).toBe('warn');
  });

  it('skips link checks on bibliography pages', () => {
    const doc = makeDoc([[BODY], ['References', '[1] Tool. https://github.com/someorg/tool']]);
    expect(codes(checkAnonymity(doc, opts(), (p) => p === 2).findings)).not.toContain('anon.hostLink');
  });

  it('downgrades to info when the venue is not double-blind', () => {
    const doc = makeDoc([[BODY, 'Acknowledgments']], { info: { Author: 'Someone' } });
    const r = checkAnonymity(doc, opts({ preset: { ...PRESET, doubleBlind: false } }), none);
    expect(r.status).toBe('pass');
    expect(codes(r.findings)).toContain('anon.notBlind');
  });

  it('passes a clean document', () => {
    const doc = makeDoc([['Anonymous Authors', 'Abstract', BODY], [BODY]]);
    expect(checkAnonymity(doc, opts(), none).status).toBe('pass');
  });
});
