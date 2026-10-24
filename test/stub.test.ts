import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TAX_YEAR_2026 as Y } from '../src/engine';
import { parseStub } from '../src/stub/parse';
import { readStub } from '../src/stub/toInputs';

// Made-up numbers in the layout of Google's Workday "Pay Statement".
const sideBySide = readFileSync(new URL('./stubs/side-by-side.txt', import.meta.url), 'utf8');
const pasted = readFileSync(new URL('./stubs/pasted.txt', import.meta.url), 'utf8');

describe.each([
  ['PDF text (Earnings and Deductions side by side)', sideBySide],
  ['copied from the Workday page', pasted],
])('parseStub: %s', (_, text) => {
  const s = parseStub(text);

  it('reads the header', () => {
    expect(s.payDate).toBe('2026-10-23');
    expect(s.payFrequency).toBe('biweekly');
  });

  it('keeps earnings and deductions apart, even with the same label', () => {
    expect(s.earnings['Regular Pay']).toEqual({ current: 7_308, ytd: 153_468 });
    expect(s.earnings['Goog Stock Unit']).toEqual({ current: 9_000, ytd: 108_000 });
    expect(s.earnings['InternetStipend']).toEqual({ current: 0, ytd: 300 });
    expect(s.earnings['Group Term Life']).toEqual({ current: 12, ytd: 252 });
    expect(s.deductions['Group Term Life']).toEqual({ current: 12, ytd: 252 });
    expect(s.deductions['Bonus 401K Pre']).toEqual({ current: 0, ytd: 4_000 });
    expect(s.deductions['Dental']).toEqual({ current: 10, ytd: 210 });
    expect(Object.keys(s.earnings)).toHaveLength(9);
    expect(Object.keys(s.deductions)).toHaveLength(6);
  });

  it('reads taxes with their wage base', () => {
    expect(s.taxes.federal).toEqual({ basedOn: 16_307, current: 3_800, ytd: 70_000 });
    expect(s.taxes.california?.ytd).toBe(27_000);
    expect(s.taxes.medicare?.ytd).toBe(5_050);
    expect(s.taxes.socialSecurity?.ytd).toBe(11_439);
    expect(s.taxes.caDisability?.ytd).toBe(3_700);
  });

  it('reads the pay summary', () => {
    expect(s.summary.ytd?.fitTaxableWages).toBe(298_302);
    expect(s.summary.current?.gross).toBe(16_320);
  });
});

describe('readStub', () => {
  const r = readStub(parseStub(sideBySide), Y, 0.22);

  it('builds year-to-date figures', () => {
    expect(r.warnings).toEqual([]);
    expect(r.ytd.asOf).toBe('2026-10-23');
    expect(r.ytd.federalTaxableWages).toBe(298_302);
    // Annual + Gross-Up + Peer + Goog Stock Unit
    expect(r.ytd.supplementalWages).toBe(148_295);
    expect(r.ytdRsu).toBe(108_000);
    expect(r.ytd.socialSecurityWages).toBeCloseTo(184_500, 2);
    // 200,000 + (5,050 − 2,900) / 2.35%
    expect(r.ytd.medicareWages).toBeCloseTo(291_489.36, 1);
    expect(r.ytd.sdiWithheld).toBe(3_700);
  });

  it('strips this period’s vest out of the per-paycheck numbers', () => {
    expect(r.current.rsu).toBe(9_000);
    expect(r.paycheck.gross).toBe(7_320); // 16,320 − 9,000
    expect(r.paycheck.section125).toBe(13); // dental + vision lower federal wages
    expect(r.paycheck.federalWithholding).toBeCloseTo(1_820, 2); // 3,800 − 22% × 9,000
    expect(r.paycheck.californiaWithholding).toBeCloseTo(779.3, 2); // 1,700 − 10.23% × 9,000
  });

  it('uses the elected RSU rate when backing out the vest', () => {
    const elected = readStub(parseStub(sideBySide), Y, 0.3);
    expect(elected.paycheck.federalWithholding).toBeCloseTo(3_800 - 2_700, 2);
  });

  it('warns about a stub from another year', () => {
    const old = readStub(parseStub(sideBySide.replace('10/23/2026', '10/23/2025')), Y, 0.22);
    expect(old.warnings[0]).toMatch(/2025/);
  });
});
