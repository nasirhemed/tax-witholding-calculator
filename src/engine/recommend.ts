import type { Projection } from './project';
import type { ProjectionInput } from './types';

/** `breakEven` aims for a $0 balance in April; `safeHarbor` aims only to avoid the penalty. */
export type Target = 'breakEven' | 'safeHarbor';

export interface Recommendation {
  /** Extra withholding needed between now and December. Negative = over-withheld by that much. */
  needed: number;
  /** Change to the per-paycheck extra (W-4 Step 4(c) or DE 4 line 2). Negative = you can lower it. */
  perPaycheckChange: number;
}

export interface FederalRecommendation extends Recommendation {
  /**
   * RSU withholding rate that alone closes the gap, if there are RSUs left to vest under the
   * $1M line. Capped at 37%; any remainder is in `perPaycheckWithRsuRate`.
   */
  rsuRate?: number;
  perPaycheckWithRsuRate?: number;
}

export interface Recommendations {
  federal: FederalRecommendation;
  california: Recommendation;
}

const MAX_RSU_RATE = 0.37;

function goal(t: Projection['federal'] | Projection['california'], target: Target): number {
  return target === 'breakEven' ? t.totalTax : t.safeHarbor.required;
}

/** Whole dollars per paycheck, rounded away from zero so the target is met, not just missed. */
function perCheck(amount: number, checks: number): number {
  if (checks <= 0 || Math.abs(amount) < 0.5) return 0;
  const raw = amount / checks;
  return raw > 0 ? Math.ceil(raw) : Math.floor(raw);
}

export function recommend(p: Projection, input: ProjectionInput, target: Target): Recommendations {
  const checks = input.paycheck.checksRemaining;
  const currentRsuRate = input.rsuFederalElectedRate ?? input.year.federal.withholding.supplementalRate;

  const fedNeeded = goal(p.federal, target) - p.federal.withheld.total;
  const federal: FederalRecommendation = { needed: fedNeeded, perPaycheckChange: perCheck(fedNeeded, checks) };

  const rsuBase = p.income.futureRsuUnderMillion;
  if (fedNeeded > 0 && rsuBase > 0 && currentRsuRate < MAX_RSU_RATE) {
    const exact = currentRsuRate + fedNeeded / rsuBase;
    // Round up to a whole percent, since elections are usually whole numbers.
    const rate = Math.min(MAX_RSU_RATE, Math.ceil(exact * 100 - 1e-9) / 100);
    const covered = (rate - currentRsuRate) * rsuBase;
    federal.rsuRate = rate;
    federal.perPaycheckWithRsuRate = Math.max(0, perCheck(fedNeeded - covered, checks));
  }

  const caNeeded = goal(p.california, target) - p.california.withheld.total;
  return {
    federal,
    california: { needed: caNeeded, perPaycheckChange: perCheck(caNeeded, checks) },
  };
}
