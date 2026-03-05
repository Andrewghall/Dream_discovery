/**
 * Period Normalization -- flexible date/period string parser
 *
 * Converts various date and period formats into ISO date strings
 * (YYYY-MM-DD) representing the start of the period. Supports ISO dates,
 * UK dates (DD/MM/YYYY), month-year, quarters, years, and ISO weeks.
 *
 * Defaults to DD/MM/YYYY interpretation for ambiguous dates since the
 * primary user base is UK-based consultancy.
 */

import type { PeriodGranularity } from './types';

// -- Month lookup (case-insensitive, 3-letter and full name)
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

// -- Quarter start months
const QUARTER_START_MONTH: Record<number, number> = {
  1: 0,  // Q1 -> January
  2: 3,  // Q2 -> April
  3: 6,  // Q3 -> July
  4: 9,  // Q4 -> October
};

/**
 * Pad a number to 2 digits with leading zero.
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format a Date into YYYY-MM-DD string.
 */
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Get the Monday of ISO week N for a given year.
 * ISO week 1 is the week containing the first Thursday of the year.
 */
function isoWeekToDate(year: number, week: number): Date | null {
  if (week < 1 || week > 53) return null;
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7
  // Monday of ISO week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  // Target week Monday
  const target = new Date(week1Monday);
  target.setDate(week1Monday.getDate() + (week - 1) * 7);
  return target;
}

/**
 * Parse a flexible date/period string into an ISO date (YYYY-MM-DD)
 * representing the start of the period.
 *
 * Supported formats:
 *   - ISO dates: "2024-01-15", "2024-01"
 *   - UK dates: "15/01/2024", "15-01-2024"
 *   - Month-year: "Jan 2024", "January 2024", "2024 Jan"
 *   - Quarters: "Q1 2024", "2024-Q1", "2024 Q1"
 *   - Years: "2024"
 *   - Week numbers: "W01 2024", "2024-W01"
 *
 * Returns null if the string cannot be parsed.
 */
export function normalizePeriodString(
  raw: string,
  granularity: PeriodGranularity,
): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // -- ISO date: YYYY-MM-DD
  const isoFull = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoFull) {
    const [, y, m, d] = isoFull;
    const date = new Date(+y, +m - 1, +d);
    if (!isNaN(date.getTime()) && date.getFullYear() === +y) {
      return toIsoDate(date);
    }
    return null;
  }

  // -- ISO month: YYYY-MM
  const isoMonth = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonth) {
    const [, y, m] = isoMonth;
    if (+m >= 1 && +m <= 12) {
      return `${y}-${pad2(+m)}-01`;
    }
    return null;
  }

  // -- UK date: DD/MM/YYYY or DD-MM-YYYY
  const ukDate = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (ukDate) {
    const [, d, m, y] = ukDate;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
      const date = new Date(+y, +m - 1, +d);
      if (!isNaN(date.getTime()) && date.getFullYear() === +y) {
        return toIsoDate(date);
      }
    }
    return null;
  }

  // -- Quarter: "Q1 2024", "Q1-2024", "2024-Q1", "2024 Q1"
  const quarterA = trimmed.match(/^[Qq](\d)\s*[-\s]?\s*(\d{4})$/);
  if (quarterA) {
    const q = +quarterA[1];
    const y = +quarterA[2];
    if (q >= 1 && q <= 4) {
      return `${y}-${pad2(QUARTER_START_MONTH[q] + 1)}-01`;
    }
    return null;
  }
  const quarterB = trimmed.match(/^(\d{4})\s*[-\s]\s*[Qq](\d)$/);
  if (quarterB) {
    const y = +quarterB[1];
    const q = +quarterB[2];
    if (q >= 1 && q <= 4) {
      return `${y}-${pad2(QUARTER_START_MONTH[q] + 1)}-01`;
    }
    return null;
  }

  // -- ISO week: "W01 2024", "2024-W01", "2024 W01"
  const weekA = trimmed.match(/^[Ww](\d{1,2})\s*[-\s]?\s*(\d{4})$/);
  if (weekA) {
    const w = +weekA[1];
    const y = +weekA[2];
    const d = isoWeekToDate(y, w);
    return d ? toIsoDate(d) : null;
  }
  const weekB = trimmed.match(/^(\d{4})\s*[-\s]\s*[Ww](\d{1,2})$/);
  if (weekB) {
    const y = +weekB[1];
    const w = +weekB[2];
    const d = isoWeekToDate(y, w);
    return d ? toIsoDate(d) : null;
  }

  // -- Month-year: "Jan 2024", "January 2024", "2024 Jan", "2024 January"
  const monthYearA = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearA) {
    const monthIdx = MONTH_MAP[monthYearA[1].toLowerCase()];
    if (monthIdx !== undefined) {
      return `${monthYearA[2]}-${pad2(monthIdx + 1)}-01`;
    }
    return null;
  }
  const monthYearB = trimmed.match(/^(\d{4})\s+([A-Za-z]+)$/);
  if (monthYearB) {
    const monthIdx = MONTH_MAP[monthYearB[2].toLowerCase()];
    if (monthIdx !== undefined) {
      return `${monthYearB[1]}-${pad2(monthIdx + 1)}-01`;
    }
    return null;
  }

  // -- Year only: "2024"
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  return null;
}
