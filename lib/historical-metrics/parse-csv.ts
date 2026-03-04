/**
 * CSV Parsing -- thin wrapper around papaparse
 *
 * Provides a simple interface for parsing CSV text into header + row objects.
 * Handles BOM stripping, header trimming, and error collection.
 */

import Papa from 'papaparse';

// ============================================================
// Types
// ============================================================

export interface ParsedCsv {
  /** Column headers (trimmed, BOM-stripped) */
  headers: string[];
  /** Row objects keyed by header name */
  rows: Record<string, string>[];
  /** Parse errors with row numbers */
  errors: Array<{ row: number; message: string }>;
}

// ============================================================
// Public API
// ============================================================

/**
 * Parse a CSV string into headers + row objects.
 *
 * Uses papaparse with header mode and no dynamic typing -- all values
 * are returned as strings for downstream validation to handle.
 */
export function parseCsvString(csvText: string): ParsedCsv {
  // Strip BOM if present
  const cleaned = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const rows = result.data ?? [];

  const errors = (result.errors ?? []).map((e) => ({
    row: typeof e.row === 'number' ? e.row + 1 : 0, // Convert to 1-indexed
    message: e.message || 'Unknown parse error',
  }));

  return { headers, rows, errors };
}
