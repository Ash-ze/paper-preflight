import type { TextLine } from './types';

export interface RawTextItem {
  str: string;
  /** [a, b, c, d, e, f] text matrix */
  transform: number[];
  width: number;
  height?: number;
}

/**
 * Group pdf.js text items into visual lines (top to bottom, left to right).
 * Two-column layouts end up with both columns on one line; for the checks we run
 * (keyword / pattern search) that is acceptable, and we split very wide gaps with " | "
 * so that patterns do not match across columns.
 */
export function buildLines(items: RawTextItem[]): TextLine[] {
  const glyphs = items
    .filter((it) => it.str && it.str.trim().length > 0)
    .map((it) => {
      const [a, b, , , e, f] = it.transform;
      const size = Math.hypot(a, b) || it.height || 10;
      return { str: it.str, x: e, y: f, w: it.width, size };
    })
    .sort((p, q) => q.y - p.y || p.x - q.x);

  const rows: { y: number; size: number; parts: typeof glyphs }[] = [];
  for (const g of glyphs) {
    const row = rows.find((r) => Math.abs(r.y - g.y) < Math.max(2, 0.45 * Math.min(r.size, g.size)));
    if (row) row.parts.push(g);
    else rows.push({ y: g.y, size: g.size, parts: [g] });
  }
  rows.sort((p, q) => q.y - p.y);

  return rows.map((r) => {
    r.parts.sort((p, q) => p.x - q.x);
    let text = '';
    let end = -Infinity;
    for (const p of r.parts) {
      const gap = p.x - end;
      if (text.length) {
        if (gap > 4 * p.size) text += ' | ';
        else if (gap > 0.15 * p.size && !text.endsWith(' ') && !p.str.startsWith(' ')) text += ' ';
      }
      text += p.str;
      end = Math.max(end, p.x + p.w);
    }
    return {
      text: text.replace(/\s+/g, ' ').trim(),
      x: r.parts[0].x,
      y: r.y,
      fontSize: Math.max(...r.parts.map((p) => p.size)),
    };
  });
}
