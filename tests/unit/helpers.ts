import type { CheckOptions, DocModel, PageModel, Preset } from '../../src/core/types';

export const PRESET: Preset = {
  id: 'test',
  name: 'Test',
  pageLimit: 8,
  doubleBlind: true,
  paperSize: 'letter',
  referencesCountTowardLimit: false,
  fonts: { allowType3: false, requireAllEmbedded: false },
  cfpUrl: '',
  unverified: [],
};

/** Build a synthetic document: one string[] (lines) per page. */
export function makeDoc(pages: string[][], extra: Partial<DocModel> = {}, size: [number, number] = [612, 792]): DocModel {
  const pm: PageModel[] = pages.map((lines, i) => ({
    number: i + 1,
    width: size[0],
    height: size[1],
    lines: lines.map((text, k) => ({ text, x: 72, y: 720 - k * 12, fontSize: 10 })),
    text: lines.join('\n'),
    links: [],
    images: [],
  }));
  return { numPages: pm.length, info: {}, xmp: {}, pages: pm, fonts: [], warnings: [], ...extra };
}

export function opts(o: Partial<CheckOptions> = {}): CheckOptions {
  return { preset: PRESET, authorNames: [], affiliations: [], bodyEndPage: null, minImageDpi: 150, ...o };
}

export const BODY = 'This is an ordinary line of body text that is long enough to count.';
export const codes = (fs: { code: string }[]) => fs.map((f) => f.code);
