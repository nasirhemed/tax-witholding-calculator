import type { Target } from '../engine';
import type { Bonus, OtherIncome, PriorYear, ProjectionInput, RegularPaycheck, RsuVest, YearToDate } from '../engine';
import { TAX_YEAR_2026 } from '../engine';

/**
 * Everything the user has typed. Lives in memory only: nothing is written to browser
 * storage, so closing the tab clears it.
 */
export interface AppState {
  ytd: YearToDate;
  paycheck: RegularPaycheck;
  vests: RsuVest[];
  sharePrice: number;
  bonuses: Bonus[];
  other: OtherIncome;
  /** Percent, e.g. 22. */
  rsuElectedRatePct: number;
  usePriorYear: boolean;
  prior: PriorYear;
  target: Target;
  /** Monthly vest plan; `vests` is generated from it. */
  vestShares: number;
  vestDay: number;
  /** What was read from the last stub, for the summary. Numbers only, never the stub text. */
  stub?: StubSummary;
  /** The person chose to type numbers in by hand instead of reading a stub. */
  manual: boolean;
}

export interface StubSummary {
  payDate: string;
  ytdRsu: number;
  ytdOtherSupplemental: number;
  currentRsu: number;
  currentOtherSupplemental: number;
  warnings: string[];
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function initialState(): AppState {
  return {
    ytd: {
      asOf: today(),
      federalTaxableWages: 0,
      californiaTaxableWages: 0,
      socialSecurityWages: 0,
      medicareWages: 0,
      supplementalWages: 0,
      federalIncomeTaxWithheld: 0,
      californiaIncomeTaxWithheld: 0,
      socialSecurityWithheld: 0,
      medicareWithheld: 0,
      sdiWithheld: 0,
    },
    paycheck: {
      checksRemaining: biweeklyChecksLeft(today()),
      gross: 0,
      pretax401k: 0,
      section125: 0,
      hsa: 0,
      federalWithholding: 0,
      californiaWithholding: 0,
    },
    vests: [],
    sharePrice: 0,
    bonuses: [],
    other: { ordinaryDividends: 0, qualifiedDividends: 0, shortTermGains: 0, longTermGains: 0, otherOrdinary: 0 },
    rsuElectedRatePct: 22,
    usePriorYear: false,
    prior: { federalTotalTax: 0, federalAgi: 0, californiaTotalTax: 0, californiaAgi: 0 },
    target: 'breakEven',
    vestShares: 0,
    vestDay: 25,
    manual: false,
  };
}

export function toInput(s: AppState): ProjectionInput {
  return {
    year: TAX_YEAR_2026,
    ytd: s.ytd,
    paycheck: s.paycheck,
    vests: s.vests,
    sharePrice: s.sharePrice,
    bonuses: s.bonuses,
    other: s.other,
    rsuFederalElectedRate: s.rsuElectedRatePct / 100,
    priorYear: s.usePriorYear ? s.prior : undefined,
  };
}

const DAY = 86_400_000;

/** Biweekly paydays after `lastPayDate` that still fall in the same calendar year. */
export function biweeklyChecksLeft(lastPayDate: string): number {
  const start = Date.parse(lastPayDate);
  if (Number.isNaN(start)) return 0;
  const yearEnd = Date.parse(`${lastPayDate.slice(0, 4)}-12-31`);
  return Math.max(0, Math.floor((yearEnd - start) / (14 * DAY)));
}

/** One vest per month after `afterDate` through December, on `day` of the month. */
export function monthlyVests(afterDate: string, day: number, shares: number): RsuVest[] {
  const year = Number(afterDate.slice(0, 4));
  const vests: RsuVest[] = [];
  for (let m = 1; m <= 12; m++) {
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const date = `${year}-${String(m).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
    if (date > afterDate) vests.push({ date, shares });
  }
  return vests;
}
