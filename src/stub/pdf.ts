import type { TextItem } from 'pdfjs-dist/types/src/display/api';

/**
 * Pulls the text out of a PDF in the browser with PDF.js, rebuilding lines from each text
 * item's position. Runs on the main thread (no worker, no network), so it works from a
 * single offline file.
 */
export async function pdfText(data: ArrayBuffer): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.mjs')]);
  // PDF.js uses this in place of a Web Worker.
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;

  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 })
    .promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows: { y: number; items: { x: number; s: string }[] }[] = [];
      for (const it of content.items as TextItem[]) {
        if (!('str' in it) || !it.str.trim()) continue;
        const x = it.transform[4] as number;
        const y = it.transform[5] as number;
        let row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!row) rows.push((row = { y, items: [] }));
        row.items.push({ x, s: it.str.trim() });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' '));
    }
  } finally {
    await doc.destroy();
  }
  return lines.join('\n');
}
