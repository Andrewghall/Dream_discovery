/**
 * Multi-format file parser for historical metrics upload.
 *
 * Accepts CSV, Excel (.xlsx / .xls), JSON, and pasted tabular text.
 * All formats are normalised into the same ParsedCsv shape so the
 * rest of the validation/upload pipeline is format-agnostic.
 */

import * as XLSX from 'xlsx';
import { parseCsvString, type ParsedCsv } from './parse-csv';

// ============================================================
// Public API
// ============================================================

export type SupportedFormat = 'csv' | 'excel' | 'json' | 'paste';

/**
 * Detect file format from the file name extension.
 * Returns null if the extension is not recognised.
 */
export function detectFormat(filename: string): SupportedFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'json':
      return 'json';
    default:
      return null;
  }
}

/**
 * Parse a file (from the browser File API) into the unified ParsedCsv shape.
 *
 * CSV/TSV: read as text, run through papaparse.
 * Excel:   read as ArrayBuffer, convert first sheet via SheetJS.
 * JSON:    read as text, parse array of objects.
 */
export async function parseFile(file: File): Promise<ParsedCsv> {
  const format = detectFormat(file.name);
  if (!format) {
    return {
      headers: [],
      rows: [],
      errors: [{ row: 0, message: `Unsupported file type: ${file.name.split('.').pop()}` }],
    };
  }

  switch (format) {
    case 'csv':
      return parseCsvFromFile(file);
    case 'excel':
      return parseExcelFromFile(file);
    case 'json':
      return parseJsonFromFile(file);
    default:
      return { headers: [], rows: [], errors: [{ row: 0, message: 'Unknown format' }] };
  }
}

/**
 * Parse pasted text (from clipboard).
 *
 * Attempts TSV first (tab-separated, common from Excel/Sheets copy),
 * falls back to CSV comma-separated parsing.
 */
export function parsePastedText(text: string): ParsedCsv {
  const trimmed = text.trim();
  if (!trimmed) {
    return { headers: [], rows: [], errors: [{ row: 0, message: 'Clipboard is empty' }] };
  }

  // If more tabs than commas on the first line, treat as TSV
  const firstLine = trimmed.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  if (tabCount > commaCount) {
    // Convert tabs to commas for papaparse (simpler than configuring delimiter)
    // But really, just use papaparse with tab delimiter detection
    return parseCsvString(trimmed);
  }

  // Try JSON array of objects
  if (trimmed.startsWith('[')) {
    try {
      return parseJsonString(trimmed);
    } catch {
      // Not valid JSON, fall through to CSV
    }
  }

  return parseCsvString(trimmed);
}

// ============================================================
// Internal parsers
// ============================================================

async function parseCsvFromFile(file: File): Promise<ParsedCsv> {
  const text = await file.text();
  return parseCsvString(text);
}

async function parseExcelFromFile(file: File): Promise<ParsedCsv> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Use the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { headers: [], rows: [], errors: [{ row: 0, message: 'Excel file has no sheets' }] };
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return { headers: [], rows: [], errors: [{ row: 0, message: `Sheet "${sheetName}" is empty` }] };
    }

    // Convert to array of objects (header row becomes keys)
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false, // Return formatted strings, not raw values
    });

    if (jsonData.length === 0) {
      return { headers: [], rows: [], errors: [{ row: 0, message: 'Excel sheet is empty' }] };
    }

    // Extract headers from first row keys
    const headers = Object.keys(jsonData[0]).map((h) => h.trim());

    // Convert all values to strings (SheetJS may return numbers)
    const rows: Record<string, string>[] = jsonData.map((row) => {
      const stringRow: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const trimmedKey = key.trim();
        stringRow[trimmedKey] = value == null ? '' : String(value).trim();
      }
      return stringRow;
    });

    return { headers, rows, errors: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse Excel file';
    return { headers: [], rows: [], errors: [{ row: 0, message: `Excel parse failed: ${message}` }] };
  }
}

async function parseJsonFromFile(file: File): Promise<ParsedCsv> {
  const text = await file.text();
  return parseJsonString(text);
}

function parseJsonString(text: string): ParsedCsv {
  try {
    const data = JSON.parse(text);

    // Expect an array of objects
    if (!Array.isArray(data)) {
      return {
        headers: [],
        rows: [],
        errors: [{ row: 0, message: 'JSON must be an array of objects (e.g. [{"period": "2024-01", "metric": 123}])' }],
      };
    }

    if (data.length === 0) {
      return { headers: [], rows: [], errors: [{ row: 0, message: 'JSON array is empty' }] };
    }

    // Validate that entries are objects
    if (typeof data[0] !== 'object' || data[0] === null) {
      return {
        headers: [],
        rows: [],
        errors: [{ row: 0, message: 'JSON array entries must be objects with key-value pairs' }],
      };
    }

    // Collect all unique keys across all objects (some rows may have extra/missing keys)
    const headerSet = new Set<string>();
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        for (const key of Object.keys(item)) {
          headerSet.add(key.trim());
        }
      }
    }
    const headers = Array.from(headerSet);

    // Convert all values to strings
    const rows: Record<string, string>[] = data.map((item: unknown) => {
      const stringRow: Record<string, string> = {};
      if (typeof item === 'object' && item !== null) {
        for (const header of headers) {
          const val = (item as Record<string, unknown>)[header];
          stringRow[header] = val == null ? '' : String(val).trim();
        }
      }
      return stringRow;
    });

    return { headers, rows, errors: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return { headers: [], rows: [], errors: [{ row: 0, message: `JSON parse failed: ${message}` }] };
  }
}
