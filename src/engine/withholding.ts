import { bracketTax } from './brackets';
import { californiaIncomeTax } from './california';
import type { TaxYear } from './types';

export interface W4 {
  step2Checked?: boolean;
  /** Step 3 credits, annual. */
  step3Credits?: number;
  /** Step 4(a) other income, annual. */
  step4aOtherIncome?: number;
  /** Step 4(b) deductions, annual. */
  step4bDeductions?: number;
  /** Step 4(c) extra withholding per paycheck. */
  step4cExtra?: number;
}

/**
 * Federal withholding on one regular paycheck, Pub 15-T Worksheet 1A (annual percentage
 * method, standard table). The standard table is the tax brackets shifted up by the
 * standard deduction minus the line 1g adjustment.
 */
export function federalRegularWithholding(
  taxableWagesPerCheck: number,
  periodsPerYear: number,
  w4: W4,
  year: TaxYear,
): number {
  if (w4.step2Checked) throw new Error('W-4 Step 2 checkbox tables are not supported yet');
  const { standardDeduction, brackets, withholding } = year.federal;
  const adjusted =
    taxableWagesPerCheck * periodsPerYear +
    (w4.step4aOtherIncome ?? 0) -
    (w4.step4bDeductions ?? 0) -
    withholding.line1gAdjustment;
  const tableStart = standardDeduction - withholding.line1gAdjustment;
  const annual = Math.max(0, bracketTax(Math.max(0, adjusted - tableStart), brackets) - (w4.step3Credits ?? 0));
  return annual / periodsPerYear + (w4.step4cExtra ?? 0);
}

/**
 * Rough California withholding on one regular paycheck (DE 44 Method B, single, one
 * allowance, no estimated deductions). Use the stub's real figure when there is one.
 */
export function californiaRegularWithholdingEstimate(
  taxableWagesPerCheck: number,
  periodsPerYear: number,
  year: TaxYear,
  additionalPerCheck = 0,
): number {
  const annualWages = taxableWagesPerCheck * periodsPerYear;
  const annual = californiaIncomeTax(annualWages - year.california.standardDeduction, annualWages, year);
  return annual / periodsPerYear + additionalPerCheck;
}

/**
 * Federal withholding on one supplemental payment (RSU vest or bonus). Pay up to $1M of
 * supplemental wages for the year uses `rate` (22% unless a higher rate was elected); pay
 * above $1M must be withheld at 37%.
 */
export function federalSupplementalWithholding(
  amount: number,
  supplementalYtdBefore: number,
  year: TaxYear,
  rate = year.federal.withholding.supplementalRate,
): number {
  const { supplementalOverMillionRate } = year.federal.withholding;
  const underMillion = Math.max(0, Math.min(amount, 1_000_000 - supplementalYtdBefore));
  const overMillion = amount - underMillion;
  return underMillion * rate + overMillion * Math.max(rate, supplementalOverMillionRate);
}
