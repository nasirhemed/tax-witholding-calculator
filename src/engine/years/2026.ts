import type { TaxYear } from '../types';

/**
 * Tax year 2026 figures, single filer.
 *
 * Sources (checked 2026-10-23):
 * - Federal brackets, standard deduction: IRS newsroom, "IRS releases tax inflation
 *   adjustments for tax year 2026" (Rev. Proc. 2025-32).
 * - Withholding: IRS Publication 15-T (2026), Worksheet 1A annual table, line 1g.
 * - Capital gains thresholds: Rev. Proc. 2025-32 (as reported by Kiplinger).
 * - Social Security wage base: SSA 2026 announcement.
 * - California brackets, standard deduction, exemption credit: FTB Tax News, October 2026,
 *   "2026 Indexing".
 * - California SDI: EDD "Rates and Withholding" (1.3%, no wage limit).
 */
export const TAX_YEAR_2026: TaxYear = {
  year: 2026,
  federal: {
    standardDeduction: 16_100,
    brackets: [
      { over: 0, rate: 0.1 },
      { over: 12_400, rate: 0.12 },
      { over: 50_400, rate: 0.22 },
      { over: 105_700, rate: 0.24 },
      { over: 201_775, rate: 0.32 },
      { over: 256_225, rate: 0.35 },
      { over: 640_600, rate: 0.37 },
    ],
    capitalGains: { zeroRateTop: 49_450, fifteenRateTop: 545_500 },
    niit: { rate: 0.038, threshold: 200_000 },
    withholding: {
      // Pub 15-T Worksheet 1A line 1g when the Step 2 box is not checked.
      line1gAdjustment: 8_600,
      supplementalRate: 0.22,
      supplementalOverMillionRate: 0.37,
    },
  },
  fica: {
    socialSecurityRate: 0.062,
    socialSecurityWageBase: 184_500,
    medicareRate: 0.0145,
    additionalMedicareRate: 0.009,
    additionalMedicareThreshold: 200_000,
  },
  california: {
    standardDeduction: 5_900,
    brackets: [
      { over: 0, rate: 0.01 },
      { over: 11_456, rate: 0.02 },
      { over: 27_157, rate: 0.04 },
      { over: 42_861, rate: 0.06 },
      { over: 59_498, rate: 0.08 },
      { over: 75_197, rate: 0.093 },
      { over: 384_109, rate: 0.103 },
      { over: 460_927, rate: 0.113 },
      { over: 768_213, rate: 0.123 },
    ],
    mentalHealthTax: { rate: 0.01, threshold: 1_000_000 },
    exemptionCredit: {
      amount: 158,
      // FTB has not published the 2026 phaseout threshold yet. This is the 2025 figure
      // ($252,203) indexed by the 3.4% FTB used for 2026. Above ~$325k the credit is
      // fully phased out, so the estimate only matters in a narrow band.
      phaseoutStart: 260_778,
      reductionPer2500: 6,
    },
    sdiRate: 0.013,
    supplementalBonusAndStockRate: 0.1023,
  },
  safeHarbor: {
    priorYearHighIncomeAgi: 150_000,
    federalPenaltyFloor: 1_000,
    californiaPenaltyFloor: 500,
    californiaNoPriorYearAgi: 1_000_000,
  },
};
