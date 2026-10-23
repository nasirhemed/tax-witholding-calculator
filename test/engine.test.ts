import { describe, expect, it } from 'vitest';
import {
  TAX_YEAR_2026 as Y,
  bracketTax,
  californiaExemptionCredit,
  californiaIncomeTax,
  californiaSafeHarbor,
  federalIncomeTax,
  federalRegularWithholding,
  federalSafeHarbor,
  federalSupplementalWithholding,
  niit,
  projectYear,
  type ProjectionInput,
} from '../src/engine';

// Expected values are worked by hand from the published 2026 tables.

describe('federal brackets', () => {
  it('matches the Pub 15-T tentative amounts at each bracket start', () => {
    // 15-T's standard table is these brackets shifted by $7,500, so its tentative
    // amounts are exactly the bracket tax at each threshold.
    expect(bracketTax(50_400, Y.federal.brackets)).toBeCloseTo(5_800, 2);
    expect(bracketTax(105_700, Y.federal.brackets)).toBeCloseTo(17_966, 2);
    expect(bracketTax(201_775, Y.federal.brackets)).toBeCloseTo(41_024, 2);
    expect(bracketTax(256_225, Y.federal.brackets)).toBeCloseTo(58_448, 2);
    expect(bracketTax(640_600, Y.federal.brackets)).toBeCloseTo(192_979.25, 2);
  });

  it('taxes $300k of ordinary income', () => {
    // 58,448 + 35% × (300,000 − 256,225)
    expect(federalIncomeTax(300_000, 0, Y)).toBeCloseTo(73_769.25, 2);
  });

  it('stacks qualified dividends on top at 15%', () => {
    // ordinary 290,000 → 58,448 + 35% × 33,775 = 70,269.25; plus 15% × 10,000
    expect(federalIncomeTax(300_000, 10_000, Y)).toBeCloseTo(71_769.25, 2);
  });

  it('applies 0% to gains inside the zero band', () => {
    // ordinary 30,000 → 1,240 + 12% × 17,600 = 3,352; 10,000 of gains fit under $49,450
    expect(federalIncomeTax(40_000, 10_000, Y)).toBeCloseTo(3_352, 2);
  });

  it('computes NIIT on the smaller of NII and MAGI over $200k', () => {
    expect(niit(5_000, 300_000, Y)).toBeCloseTo(190, 2);
    expect(niit(5_000, 202_000, Y)).toBeCloseTo(76, 2);
    expect(niit(5_000, 150_000, Y)).toBe(0);
  });
});

describe('California', () => {
  it('matches Schedule X at bracket starts (FTB rounds to cents)', () => {
    expect(bracketTax(75_197, Y.california.brackets)).toBeCloseTo(3_310.88, 1);
    expect(bracketTax(384_109, Y.california.brackets)).toBeCloseTo(32_039.7, 1);
    expect(bracketTax(768_213, Y.california.brackets)).toBeCloseTo(74_675.27, 1);
  });

  it('phases out the exemption credit by $6 per $2,500 or part of it', () => {
    expect(californiaExemptionCredit(200_000, Y)).toBe(158);
    expect(californiaExemptionCredit(260_778 + 2_501, Y)).toBe(146);
    expect(californiaExemptionCredit(400_000, Y)).toBe(0);
  });

  it('adds the 1% Mental Health Services Tax over $1M', () => {
    const at1m = californiaIncomeTax(1_000_000, 1_010_000, Y);
    const at1m100k = californiaIncomeTax(1_100_000, 1_110_000, Y);
    expect(at1m100k - at1m).toBeCloseTo(100_000 * 0.133, 2);
  });
});

describe('withholding', () => {
  it('follows Pub 15-T Worksheet 1A for a $300k salary paid biweekly', () => {
    // 300,000 − 8,600 = 291,400 → 58,448 + 35% × 27,675 = 68,134.25 a year
    const perCheck = federalRegularWithholding(300_000 / 26, 26, {}, Y);
    expect(perCheck).toBeCloseTo(68_134.25 / 26, 2);
  });

  it('adds Step 4(c) extra on top', () => {
    const base = federalRegularWithholding(10_000, 26, {}, Y);
    expect(federalRegularWithholding(10_000, 26, { step4cExtra: 250 }, Y)).toBeCloseTo(base + 250, 6);
  });

  it('withholds supplemental pay at 22% up to $1M, then 37%', () => {
    expect(federalSupplementalWithholding(200_000, 900_000, Y)).toBeCloseTo(59_000, 2);
    expect(federalSupplementalWithholding(10_000, 0, Y)).toBeCloseTo(2_200, 2);
  });

  it('uses an elected RSU rate under $1M', () => {
    expect(federalSupplementalWithholding(10_000, 0, Y, 0.35)).toBeCloseTo(3_500, 2);
  });
});

describe('safe harbor', () => {
  const prior = { totalTax: 70_000, agi: 300_000 };

  it('uses 110% of last year when that is lower than 90% of this year', () => {
    const r = federalSafeHarbor(100_000, 70_000, prior, Y);
    expect(r.basis).toBe('prior-year-110');
    expect(r.required).toBeCloseTo(77_000, 2);
    expect(r.met).toBe(false);
    expect(r.shortfall).toBeCloseTo(7_000, 2);
  });

  it('is met when the balance due is under the penalty floor', () => {
    expect(federalSafeHarbor(100_000, 99_500, undefined, Y).met).toBe(true);
  });

  it('drops the prior-year option in California at $1M AGI', () => {
    const r = californiaSafeHarbor(120_000, 0, 1_000_000, { totalTax: 50_000, agi: 900_000 }, Y);
    expect(r.basis).toBe('current-year-90');
    expect(r.required).toBeCloseTo(108_000, 2);
  });
});

describe('projectYear', () => {
  const input: ProjectionInput = {
    year: Y,
    ytd: {
      asOf: '2026-10-16',
      federalTaxableWages: 250_000,
      californiaTaxableWages: 255_000,
      socialSecurityWages: 184_500,
      medicareWages: 262_000,
      supplementalWages: 120_000,
      federalIncomeTaxWithheld: 55_000,
      californiaIncomeTaxWithheld: 24_000,
      socialSecurityWithheld: 11_439,
      medicareWithheld: 4_357,
      sdiWithheld: 3_406,
    },
    paycheck: {
      checksRemaining: 5,
      gross: 8_000,
      pretax401k: 1_000,
      section125: 200,
      hsa: 150,
      federalWithholding: 1_500,
      californiaWithholding: 600,
    },
    vests: [
      { date: '2026-09-25', shares: 20 }, // already on the stub, ignored
      { date: '2026-11-25', shares: 20 },
      { date: '2026-12-25', shares: 20 },
    ],
    sharePrice: 250,
    bonuses: [],
    other: { ordinaryDividends: 0, qualifiedDividends: 0, shortTermGains: 0, longTermGains: 0, otherOrdinary: 0 },
    priorYear: { federalTotalTax: 70_000, federalAgi: 280_000, californiaTotalTax: 25_000, californiaAgi: 285_000 },
  };
  const p = projectYear(input);

  it('builds full-year wages per tax', () => {
    expect(p.income.futureRsuIncome).toBe(10_000);
    expect(p.income.federalWages).toBe(293_250); // 250,000 + 5 × 6,650 + 10,000
    expect(p.income.californiaWages).toBe(299_000); // HSA stays taxable in CA
    expect(p.income.medicareWages).toBe(310_250);
  });

  it('projects federal tax and withholding', () => {
    // taxable 277,150 → 58,448 + 35% × 20,925 = 65,771.75; + 0.9% × 110,250 Medicare
    expect(p.federal.incomeTax).toBeCloseTo(65_771.75, 2);
    expect(p.federal.additionalMedicare).toBeCloseTo(992.25, 2);
    expect(p.federal.totalTax).toBeCloseTo(66_764, 2);
    expect(p.federal.withheld.rsus).toBeCloseTo(2_200, 2);
    expect(p.federal.withheld.total).toBeCloseTo(65_692.25, 2);
    expect(p.federal.balanceDue).toBeCloseTo(1_071.75, 2);
    expect(p.federal.marginalRate).toBe(0.35);
    expect(p.federal.safeHarbor.met).toBe(true);
  });

  it('projects California tax and withholding', () => {
    // taxable 293,100 → 3,310.88 + 9.3% × 217,903 = 23,575.86; credit 158 − 13 × 6 = 80
    expect(p.california.totalTax).toBeCloseTo(23_495.86, 1);
    expect(p.california.withheld.total).toBeCloseTo(28_023, 2);
    expect(p.california.balanceDue).toBeCloseTo(-4_527.14, 1);
  });

  it('projects SDI on gross minus Section 125', () => {
    expect(p.payroll.sdi).toBeCloseTo(3_406 + 49_000 * 0.013, 2);
  });
});
