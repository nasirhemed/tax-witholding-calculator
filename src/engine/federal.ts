import { bracketTax } from './brackets';
import type { TaxYear } from './types';

/**
 * Regular federal income tax, following the Qualified Dividends and Capital Gain Tax
 * Worksheet: ordinary income uses the brackets, and qualified dividends plus net long-term
 * gains are stacked on top at 0/15/20%.
 */
export function federalIncomeTax(taxableIncome: number, preferentialIncome: number, year: TaxYear): number {
  const { brackets, capitalGains } = year.federal;
  const taxable = Math.max(0, taxableIncome);
  const pref = Math.min(Math.max(0, preferentialIncome), taxable);
  const ordinary = taxable - pref;

  const zeroBand = Math.max(0, Math.min(taxable, capitalGains.zeroRateTop) - ordinary);
  const fifteenBand = Math.max(0, Math.min(taxable, capitalGains.fifteenRateTop) - ordinary - zeroBand);
  const twentyBand = pref - zeroBand - fifteenBand;

  const withPreference = bracketTax(ordinary, brackets) + fifteenBand * 0.15 + twentyBand * 0.2;
  // The worksheet takes the smaller of this and the plain bracket tax.
  return Math.min(withPreference, bracketTax(taxable, brackets));
}

/** Net investment income tax (Form 8960). */
export function niit(netInvestmentIncome: number, magi: number, year: TaxYear): number {
  const { rate, threshold } = year.federal.niit;
  return rate * Math.max(0, Math.min(netInvestmentIncome, magi - threshold));
}

/** Additional Medicare tax owed on wages (Form 8959, single filer). */
export function additionalMedicareTax(medicareWages: number, year: TaxYear): number {
  const { additionalMedicareRate, additionalMedicareThreshold } = year.fica;
  return additionalMedicareRate * Math.max(0, medicareWages - additionalMedicareThreshold);
}
