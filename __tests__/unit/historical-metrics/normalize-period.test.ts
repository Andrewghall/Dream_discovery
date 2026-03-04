/**
 * Tests for period normalization helper.
 *
 * Validates that various date/period string formats are correctly
 * normalized to ISO date strings (YYYY-MM-DD) representing the
 * start of the period.
 */

import { describe, it, expect } from 'vitest';
import { normalizePeriodString } from '@/lib/historical-metrics/normalize-period';

describe('normalizePeriodString', () => {
  // -- ISO dates --

  it('parses ISO date YYYY-MM-DD', () => {
    expect(normalizePeriodString('2024-01-15', 'daily')).toBe('2024-01-15');
  });

  it('parses ISO date with single-digit month/day', () => {
    expect(normalizePeriodString('2024-3-5', 'daily')).toBe('2024-03-05');
  });

  it('parses ISO month YYYY-MM', () => {
    expect(normalizePeriodString('2024-01', 'monthly')).toBe('2024-01-01');
  });

  it('parses ISO month YYYY-MM with single digit', () => {
    expect(normalizePeriodString('2024-3', 'monthly')).toBe('2024-03-01');
  });

  // -- UK dates --

  it('parses UK date DD/MM/YYYY', () => {
    expect(normalizePeriodString('15/01/2024', 'daily')).toBe('2024-01-15');
  });

  it('parses UK date DD-MM-YYYY', () => {
    expect(normalizePeriodString('15-01-2024', 'daily')).toBe('2024-01-15');
  });

  it('parses UK date with single-digit day/month', () => {
    expect(normalizePeriodString('5/3/2024', 'daily')).toBe('2024-03-05');
  });

  // -- Month-year --

  it('parses "Jan 2024"', () => {
    expect(normalizePeriodString('Jan 2024', 'monthly')).toBe('2024-01-01');
  });

  it('parses "January 2024"', () => {
    expect(normalizePeriodString('January 2024', 'monthly')).toBe('2024-01-01');
  });

  it('parses "December 2023"', () => {
    expect(normalizePeriodString('December 2023', 'monthly')).toBe('2023-12-01');
  });

  it('parses "2024 Jan" (year first)', () => {
    expect(normalizePeriodString('2024 Jan', 'monthly')).toBe('2024-01-01');
  });

  it('parses month names case-insensitively', () => {
    expect(normalizePeriodString('FEB 2024', 'monthly')).toBe('2024-02-01');
    expect(normalizePeriodString('mar 2024', 'monthly')).toBe('2024-03-01');
  });

  // -- Quarters --

  it('parses "Q1 2024"', () => {
    expect(normalizePeriodString('Q1 2024', 'quarterly')).toBe('2024-01-01');
  });

  it('parses "Q2 2024"', () => {
    expect(normalizePeriodString('Q2 2024', 'quarterly')).toBe('2024-04-01');
  });

  it('parses "Q3 2024"', () => {
    expect(normalizePeriodString('Q3 2024', 'quarterly')).toBe('2024-07-01');
  });

  it('parses "Q4 2024"', () => {
    expect(normalizePeriodString('Q4 2024', 'quarterly')).toBe('2024-10-01');
  });

  it('parses "2024-Q3"', () => {
    expect(normalizePeriodString('2024-Q3', 'quarterly')).toBe('2024-07-01');
  });

  it('parses "2024 Q1"', () => {
    expect(normalizePeriodString('2024 Q1', 'quarterly')).toBe('2024-01-01');
  });

  it('parses lowercase "q2 2024"', () => {
    expect(normalizePeriodString('q2 2024', 'quarterly')).toBe('2024-04-01');
  });

  // -- Year only --

  it('parses year "2024"', () => {
    expect(normalizePeriodString('2024', 'yearly')).toBe('2024-01-01');
  });

  it('parses year "2023"', () => {
    expect(normalizePeriodString('2023', 'yearly')).toBe('2023-01-01');
  });

  // -- ISO weeks --

  it('parses "W01 2024"', () => {
    const result = normalizePeriodString('W01 2024', 'weekly');
    expect(result).toBeTruthy();
    // Week 1 of 2024 starts on Monday 2024-01-01
    expect(result).toBe('2024-01-01');
  });

  it('parses "2024-W10"', () => {
    const result = normalizePeriodString('2024-W10', 'weekly');
    expect(result).toBeTruthy();
    // Should return a valid date in March 2024
    expect(result!.startsWith('2024-03')).toBe(true);
  });

  // -- Edge cases --

  it('returns null for empty string', () => {
    expect(normalizePeriodString('', 'monthly')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(normalizePeriodString('   ', 'monthly')).toBeNull();
  });

  it('returns null for garbage string', () => {
    expect(normalizePeriodString('not-a-date', 'monthly')).toBeNull();
  });

  it('returns null for invalid month number', () => {
    expect(normalizePeriodString('2024-13', 'monthly')).toBeNull();
  });

  it('returns null for invalid quarter number', () => {
    expect(normalizePeriodString('Q5 2024', 'quarterly')).toBeNull();
  });

  it('handles trimming whitespace', () => {
    expect(normalizePeriodString('  2024-01-15  ', 'daily')).toBe('2024-01-15');
  });

  it('handles null-like input', () => {
    expect(normalizePeriodString(null as any, 'daily')).toBeNull();
    expect(normalizePeriodString(undefined as any, 'daily')).toBeNull();
  });
});
