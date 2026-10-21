import { buildLines, type RawTextItem } from './text';
import type { DocModel, FontInfo, ImageInfo, PageModel } from './types';

/** Minimal surface of the pdf.js module we depend on (browser build or Node legacy build). */
export interface PdfJsLike {
  getDocument: (src: any) => { promise: Promise<any> };
  OPS: Record<string, number>;
}

export interface ExtractProgress {
  (done: number, total: number): void;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m: Matrix, n: number[]): Matrix {
  // returns n x m (PDF convention: new CTM = n * CTM)
  return [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
}

/** Wait for a pdf.js common object (fonts resolve asynchronously in browsers). */
function resolveObj(objs: any, id: string, ms = 4000): Promise<any> {
  return new Promise((res) => {
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      res(null);
    }, ms);
    try {
      objs.get(id, (v: unknown) => {
        if (done) return;
        clearTimeout(timer);
        res(v);
      });
    } catch {
      clearTimeout(timer);
      res(null);
    }
  });
}

function str(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join('; ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('name' in o) return String(o.name);
    return Object.values(o).map(str).filter(Boolean).join('; ');
  }
  return String(v);
}

/**
 * Parse a PDF with pdf.js and collect everything the checks need.
 * Runs fully locally: the bytes are handed to pdf.js and never leave the process.
 */
export async function extractDocument(
  pdfjs: PdfJsLike,
  data: Uint8Array,
  onProgress?: ExtractProgress,
): Promise<DocModel> {
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    fontExtraProperties: true,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const warnings: string[] = [];

  const info: Record<string, string> = {};
  const xmp: Record<string, string> = {};
  try {
    const md = await doc.getMetadata();
    for (const [k, v] of Object.entries(md?.info ?? {})) {
      if (/^(PDFFormatVersion|Is[A-Z]|Language|EncryptFilterName)/.test(k)) continue;
      const s = str(v).trim();
      if (s) info[k] = s;
    }
    if (md?.metadata && typeof md.metadata[Symbol.iterator] === 'function') {
      for (const [k, v] of md.metadata as Iterable<[string, unknown]>) {
        const s = str(v).trim();
        if (s) xmp[k] = s;
      }
    }
  } catch (e) {
    warnings.push(`metadata: ${(e as Error).message}`);
  }

  const OPS = pdfjs.OPS;
  const textOps = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
  const fonts = new Map<string, FontInfo>();
  const pages: PageModel[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const [x0, y0, x1, y1] = page.view as number[];
    const rotated = (page.rotate ?? 0) % 180 !== 0;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const model: PageModel = {
      number: p,
      width: rotated ? h : w,
      height: rotated ? w : h,
      lines: [],
      text: '',
      links: [],
      images: [],
    };

    try {
      const tc = await page.getTextContent();
      model.lines = buildLines(tc.items as RawTextItem[]);
      model.text = model.lines.map((l) => l.text).join('\n');
    } catch (e) {
      warnings.push(`page ${p} text: ${(e as Error).message}`);
    }

    try {
      const ann = await page.getAnnotations();
      for (const a of ann) if (a.url) model.links.push(String(a.url));
    } catch (e) {
      warnings.push(`page ${p} annotations: ${(e as Error).message}`);
    }

    try {
      const ol = await page.getOperatorList();
      let ctm: Matrix = IDENTITY;
      const stack: Matrix[] = [];
      let currentFont: string | null = null;
      const usedFonts = new Set<string>();
      for (let i = 0; i < ol.fnArray.length; i++) {
        const fn = ol.fnArray[i];
        const args = ol.argsArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? IDENTITY;
        else if (fn === OPS.transform) ctm = mul(ctm, args);
        else if (fn === OPS.paintFormXObjectBegin) {
          stack.push(ctm);
          if (Array.isArray(args?.[0]) || ArrayBuffer.isView(args?.[0])) ctm = mul(ctm, Array.from(args[0] as ArrayLike<number>));
        } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? IDENTITY;
        else if (fn === OPS.setFont) currentFont = args[0];
        else if (textOps.has(fn) && currentFont) usedFonts.add(currentFont);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
          const pxW = fn === OPS.paintImageXObject ? args[1] : args[0]?.width;
          const pxH = fn === OPS.paintImageXObject ? args[2] : args[0]?.height;
          if (pxW && pxH) {
            const img: ImageInfo = {
              page: p,
              pxWidth: pxW,
              pxHeight: pxH,
              widthPt: Math.hypot(ctm[0], ctm[1]),
              heightPt: Math.hypot(ctm[2], ctm[3]),
            };
            model.images.push(img);
          }
        }
      }
      for (const id of usedFonts) {
        const fo: any = await resolveObj(page.commonObjs, id);
        if (!fo || typeof fo !== 'object') {
          warnings.push(`page ${p}: could not inspect font ${id}`);
          continue;
        }
        const name = String(fo.name ?? fo.loadedName ?? id);
        const type = String(fo.type ?? (fo.isType3Font ? 'Type3' : 'unknown'));
        const key = `${name}|${type}`;
        const entry = fonts.get(key) ?? {
          name,
          type,
          isType3: Boolean(fo.isType3Font) || type === 'Type3',
          embedded: !fo.missingFile,
          pages: [],
        };
        if (!entry.pages.includes(p)) entry.pages.push(p);
        fonts.set(key, entry);
      }
    } catch (e) {
      warnings.push(`page ${p} operators: ${(e as Error).message}`);
    }

    pages.push(model);
    page.cleanup?.();
    onProgress?.(p, doc.numPages);
  }

  await doc.destroy?.();
  return { numPages: pages.length, info, xmp, pages, fonts: [...fonts.values()], warnings };
}
