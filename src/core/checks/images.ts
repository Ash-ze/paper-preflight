import type { CheckResult, DocModel, Finding, ImageInfo } from '../types';
import { result } from '../util';

/** Effective resolution of an image as rendered on the page (lower of the two axes). */
export function effectiveDpi(img: ImageInfo): number {
  const dx = img.widthPt > 0 ? img.pxWidth / (img.widthPt / 72) : Infinity;
  const dy = img.heightPt > 0 ? img.pxHeight / (img.heightPt / 72) : Infinity;
  return Math.min(dx, dy);
}

/** Ignore tiny decorations (< 0.5 in on a side) and 1-pixel fills. */
function relevant(img: ImageInfo) {
  return img.widthPt >= 36 && img.heightPt >= 36 && img.pxWidth > 2 && img.pxHeight > 2;
}

export function checkImages(doc: DocModel, minDpi: number): CheckResult {
  const findings: Finding[] = [];
  let count = 0;
  for (const page of doc.pages) {
    for (const img of page.images) {
      if (!relevant(img)) continue;
      count++;
      const dpi = effectiveDpi(img);
      if (dpi < minDpi) {
        findings.push({
          severity: 'warn',
          code: 'images.lowres',
          page: page.number,
          params: {
            dpi: Math.round(dpi),
            min: minDpi,
            px: `${img.pxWidth}×${img.pxHeight}px`,
            size: `${(img.widthPt / 72).toFixed(1)}×${(img.heightPt / 72).toFixed(1)} in`,
          },
        });
      }
    }
  }
  findings.push({ severity: 'info', code: 'images.count', params: { count } });
  return result('images', findings, 'images.ok');
}
