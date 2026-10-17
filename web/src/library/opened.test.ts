import { describe, expect, it } from 'vitest';
import { opened_ago } from './opened';

const now = new Date(2026, 9, 16, 9, 0);

function days_before(days: number, hour = 21) {
  return new Date(2026, 9, 16 - days, hour).toISOString();
}

describe('opened_ago', () => {
  it('counts calendar days', () => {
    expect(opened_ago(days_before(0, 1), now)).toBe('today');
    expect(opened_ago(days_before(1), now)).toBe('yesterday');
    expect(opened_ago(days_before(3), now)).toBe('3 days ago');
  });

  it('rounds older opens to weeks, months and years', () => {
    expect(opened_ago(days_before(8), now)).toBe('last week');
    expect(opened_ago(days_before(20), now)).toBe('3 weeks ago');
    expect(opened_ago(days_before(65), now)).toBe('2 months ago');
    expect(opened_ago(days_before(400), now)).toBe('last year');
  });
});
