import { bracketTax } from './brackets';
import type { TaxYear } from './types';

/** California exemption credit after the high-income phaseout. */
export function californiaExemptionCredit(federalAgi: number, year: TaxYear): number {
  const { amount, phaseoutStart, reductionPer2500 } = year.california.exemptionCredit;
  if (federalAgi <= phaseoutStart) return amount;
  const steps = Math.ceil((federalAgi - phaseoutStart) / 2_500);
  return Math.max(0, amount - steps * reductionPer2500);
}

/** Form 540 tax: Schedule X, minus the exemption credit, plus the Mental Health Services Tax. */
export function californiaIncomeTax(taxableIncome: number, federalAgi: number, year: TaxYear): number {
  const taxable = Math.max(0, taxableIncome);
  const { mentalHealthTax } = year.california;
  const base = Math.max(0, bracketTax(taxable, year.california.brackets) - californiaExemptionCredit(federalAgi, year));
  return base + mentalHealthTax.rate * Math.max(0, taxable - mentalHealthTax.threshold);
}
