import type { TaxYear } from './types';

export interface SafeHarborResult {
  /** Payments needed by year end to avoid an underpayment penalty. */
  required: number;
  /** Which rule set `required`. */
  basis: 'current-year-90' | 'prior-year-100' | 'prior-year-110';
  met: boolean;
  /** How much more withholding is needed to meet `required` (0 when met). */
  shortfall: number;
}

interface PriorTax {
  totalTax: number;
  agi: number;
}

function check(
  currentTax: number,
  withheld: number,
  penaltyFloor: number,
  prior: PriorTax | undefined,
  priorAllowed: boolean,
  year: TaxYear,
): SafeHarborResult {
  const currentRule = 0.9 * currentTax;
  let required = currentRule;
  let basis: SafeHarborResult['basis'] = 'current-year-90';
  if (prior && priorAllowed) {
    const highIncome = prior.agi > year.safeHarbor.priorYearHighIncomeAgi;
    const priorRule = prior.totalTax * (highIncome ? 1.1 : 1);
    if (priorRule < currentRule) {
      required = priorRule;
      basis = highIncome ? 'prior-year-110' : 'prior-year-100';
    }
  }
  // Owing less than the floor at filing means no penalty either way.
  const met = withheld >= required || currentTax - withheld < penaltyFloor;
  return { required, basis, met, shortfall: met ? 0 : required - withheld };
}

export function federalSafeHarbor(
  currentTax: number,
  withheld: number,
  prior: PriorTax | undefined,
  year: TaxYear,
): SafeHarborResult {
  return check(currentTax, withheld, year.safeHarbor.federalPenaltyFloor, prior, true, year);
}

/** California drops the prior-year option once current-year AGI reaches $1M. */
export function californiaSafeHarbor(
  currentTax: number,
  withheld: number,
  currentAgi: number,
  prior: PriorTax | undefined,
  year: TaxYear,
): SafeHarborResult {
  const priorAllowed = currentAgi < year.safeHarbor.californiaNoPriorYearAgi;
  return check(currentTax, withheld, year.safeHarbor.californiaPenaltyFloor, prior, priorAllowed, year);
}
