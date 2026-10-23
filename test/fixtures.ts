import { TAX_YEAR_2026 as Y, type ProjectionInput } from '../src/engine';

/** A mid-October scenario: 5 paychecks and 2 vests left. Worked by hand in engine.test.ts. */
export const scenario: ProjectionInput = {
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
