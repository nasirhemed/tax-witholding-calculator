import { describe, expect, it } from 'vitest';
import { biweeklyChecksLeft, monthlyVests } from '../src/ui/state';

describe('biweeklyChecksLeft', () => {
  it('counts paydays after the stub date through Dec 31', () => {
    // Oct 16 + 14k days: Oct 30, Nov 13, Nov 27, Dec 11, Dec 25
    expect(biweeklyChecksLeft('2026-10-16')).toBe(5);
    expect(biweeklyChecksLeft('2026-12-25')).toBe(0);
  });
});

describe('monthlyVests', () => {
  it('fills months after the stub date and clamps short months', () => {
    expect(monthlyVests('2026-10-16', 25, 20).map((v) => v.date)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
    expect(monthlyVests('2026-01-31', 31, 1).map((v) => v.date).slice(0, 2)).toEqual(['2026-02-28', '2026-03-31']);
  });
});
