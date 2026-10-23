import { describe, expect, it } from 'vitest';
import { projectYear, recommend } from '../src/engine';
import { scenario } from './fixtures';

describe('recommend', () => {
  const p = projectYear(scenario);

  it('spreads a federal shortfall over the paychecks left, rounded up', () => {
    const r = recommend(p, scenario, 'breakEven');
    expect(r.federal.needed).toBeCloseTo(1_071.75, 2);
    expect(r.federal.perPaycheckChange).toBe(215); // 1,071.75 / 5 = 214.35
  });

  it('finds the whole-percent RSU rate that covers it instead', () => {
    const r = recommend(p, scenario, 'breakEven');
    // 22% + 1,071.75 / 10,000 of vests = 32.7% → 33%
    expect(r.federal.rsuRate).toBe(0.33);
    expect(r.federal.perPaycheckWithRsuRate).toBe(0);
  });

  it('caps the RSU rate at 37% and puts the rest on paychecks', () => {
    // $1,000 of RSUs left and lighter paycheck withholding: ~$2,400 short
    const small = {
      ...scenario,
      vests: [{ date: '2026-12-25', shares: 4 }],
      paycheck: { ...scenario.paycheck, federalWithholding: 1_000 },
    };
    const q = projectYear(small);
    const r = recommend(q, small, 'breakEven');
    expect(r.federal.rsuRate).toBe(0.37);
    const left = r.federal.needed - 0.15 * 1_000;
    expect(r.federal.perPaycheckWithRsuRate).toBe(Math.ceil(left / 5));
    expect(r.federal.perPaycheckWithRsuRate).toBe(451); // (2,401.75 − 150) / 5
  });

  it('shows how much California withholding can drop', () => {
    const r = recommend(p, scenario, 'breakEven');
    expect(r.california.needed).toBeCloseTo(-4_527.14, 1);
    expect(r.california.perPaycheckChange).toBe(-906);
  });

  it('aims at the penalty threshold in safe-harbor mode', () => {
    const r = recommend(p, scenario, 'safeHarbor');
    expect(r.federal.needed).toBeCloseTo(0.9 * p.federal.totalTax - p.federal.withheld.total, 2);
    expect(r.federal.rsuRate).toBeUndefined();
  });
});
