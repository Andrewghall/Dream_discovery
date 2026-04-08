/**
 * lib/evidence/extractor.ts
 *
 * File content extraction pipeline.
 * Converts raw uploaded files into plain text + structure — no user mapping required.
 *
 * Supported types:
 *   PDF    → pdfjs-dist (text by page, Node-safe)
 *   DOCX   → mammoth (structured text)
 *   XLSX   → xlsx (rows as readable text)
 *   CSV    → xlsx (same path)
 *   PPTX   → officeparser (slide text)
 *   Images → OpenAI Vision API (gpt-4o)
 *   Screenshots → same as images
 *   TXT    → direct read
 */

import type { RawFileExtraction } from './types';

// ── Lazy imports (avoid loading large parsers at module init) ──────────────

async function extractPdf(buffer: Buffer): Promise<RawFileExtraction> {
  // pdfjs-dist (Node-safe) — pdf-parse v2 requires DOMMatrix which isn't available in Node
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);
  const path = await import('path');
  const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerPath;

  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map((item: { str?: string }) => item.str ?? '').join(' '));
  }

  return {
    text: pages.join('\n'),
    pageCount: pdf.numPages,
    extractionMethod: 'text',
    mimeType: 'application/pdf',
  };
}

async function extractDocx(buffer: Buffer): Promise<RawFileExtraction> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value ?? '',
    extractionMethod: 'text',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

async function extractXlsx(buffer: Buffer, mimeType: string): Promise<RawFileExtraction> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const lines: string[] = [];
  let rowCount = 0;

  for (const sheetName of workbook.SheetNames) {
    lines.push(`=== Sheet: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    rowCount += rows.length;

    // Cap at 500 rows per sheet to avoid token overload
    const capped = rows.slice(0, 500);
    for (const row of capped) {
      // Format as "Key: Value | Key: Value" for readability
      const parts = Object.entries(row)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`);
      if (parts.length > 0) lines.push(parts.join(' | '));
    }
    if (rows.length > 500) {
      lines.push(`[... ${rows.length - 500} more rows truncated]`);
    }
  }

  return {
    text: lines.join('\n'),
    rowCount,
    extractionMethod: 'structured',
    mimeType,
  };
}

async function extractPptx(buffer: Buffer): Promise<RawFileExtraction> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const officeParser = require('officeparser');
  // officeparser returns a structured object (not a plain string) — walk the tree
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: unknown = await new Promise((resolve, reject) => {
    officeParser.parseOffice(buffer, (data: unknown, err: Error) => {
      if (err) reject(err);
      else resolve(data ?? '');
    });
  });

  function extractText(node: unknown): string {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractText).join(' ');
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj['text'] === 'string') return obj['text'];
      return Object.values(obj).map(extractText).join(' ');
    }
    return '';
  }

  const text = typeof raw === 'string' ? raw : extractText(raw);

  return {
    text,
    extractionMethod: 'text',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
}

async function extractImage(buffer: Buffer, mimeType: string, fileName: string): Promise<RawFileExtraction> {
  const { env } = await import('@/lib/env');
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — cannot extract image content');
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: `You are extracting content from a business document image or screenshot named "${fileName}".

Describe and transcribe ALL visible content: text, numbers, charts, tables, graphs, diagrams, labels, headings.
Be thorough — include every number, percentage, date, and label you can see.
Format your extraction clearly with sections for different content areas.
If this is a chart or graph, describe the data it shows in detail.
If this is a table, reproduce the data row by row.
If this is a screenshot, describe every panel and metric visible.`,
          },
        ],
      },
    ],
  });

  return {
    text: response.choices[0]?.message?.content ?? '',
    extractionMethod: 'vision',
    mimeType,
  };
}

async function extractText(buffer: Buffer, mimeType: string): Promise<RawFileExtraction> {
  return {
    text: buffer.toString('utf-8'),
    extractionMethod: 'text',
    mimeType,
  };
}

// ── Main Dispatcher ────────────────────────────────────────────────────────

/**
 * Extract readable content from any supported file type.
 * Dispatches by MIME type. No user mapping required.
 */
export async function extractFileContent(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<RawFileExtraction> {
  const mime = mimeType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  // PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return extractPdf(buffer);
  }

  // Word documents (.docx only — mammoth does not support legacy binary .doc)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return extractDocx(buffer);
  }

  // Excel / CSV
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'csv'
  ) {
    return extractXlsx(buffer, mime);
  }

  // PowerPoint — OOXML (.pptx) only; legacy binary .ppt is not supported by officeparser
  if (
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === 'pptx'
  ) {
    return extractPptx(buffer);
  }

  // Images & screenshots
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'].includes(ext)
  ) {
    return extractImage(buffer, mimeType, fileName);
  }

  // Plain text
  if (mime === 'text/plain' || mime === 'text/markdown' || ext === 'txt' || ext === 'md') {
    return extractText(buffer, mimeType);
  }

  throw new Error(`Unsupported file type: ${mimeType} (.${ext})`);
}

/**
 * Returns a human-readable label for a MIME type.
 */
export function fileTypeLabel(mimeType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mime = mimeType.toLowerCase();

  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF Document';
  if (ext === 'docx') return 'Word Document';
  if (ext === 'xlsx' || ext === 'xls') return 'Excel Spreadsheet';
  if (ext === 'csv') return 'CSV Data';
  if (ext === 'pptx' || ext === 'ppt') return 'PowerPoint Presentation';
  if (mime.startsWith('image/')) return 'Image / Screenshot';
  if (ext === 'txt') return 'Text File';
  return 'Document';
}

/**
 * Returns the max file size allowed for a given MIME type (in bytes).
 */
export function maxFileSizeForType(mimeType: string): number {
  if (mimeType.startsWith('image/')) return 10 * 1024 * 1024;   // 10 MB
  if (mimeType === 'application/pdf') return 50 * 1024 * 1024;  // 50 MB
  return 25 * 1024 * 1024;                                       // 25 MB default
}

/** MIME types accepted by the evidence upload endpoint */
export const ACCEPTED_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // application/vnd.ms-powerpoint (.ppt) intentionally excluded — officeparser only handles OOXML
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'text/plain',
] as const;
