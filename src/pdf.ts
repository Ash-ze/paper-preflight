// The "legacy" build includes polyfills, so the app also works in browsers that lack the newest
// JavaScript features. The worker is bundled by Vite as a same-origin asset: no CDN, works offline.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { extractDocument, type ExtractProgress } from './core/extract';
import type { DocModel } from './core/types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function analysePdf(data: Uint8Array, onProgress?: ExtractProgress): Promise<DocModel> {
  return extractDocument(pdfjs as any, data, onProgress);
}
