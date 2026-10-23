/** A bracket starts at `over` and taxes every dollar above it at `rate` (until the next bracket). */
export interface Bracket {
  over: number;
  rate: number;
}

export interface TaxYear {
  year: number;
  federal: {
    standardDeduction: number;
    brackets: Bracket[];
    /** Taxable-income tops of the 0% and 15% long-term capital gains bands. */
    capitalGains: { zeroRateTop: number; fifteenRateTop: number };
    niit: { rate: number; threshold: number };
    withholding: {
      line1gAdjustment: number;
      supplementalRate: number;
      supplementalOverMillionRate: number;
    };
  };
  fica: {
    socialSecurityRate: number;
    socialSecurityWageBase: number;
    medicareRate: number;
    additionalMedicareRate: number;
    additionalMedicareThreshold: number;
  };
  california: {
    standardDeduction: number;
    brackets: Bracket[];
    mentalHealthTax: { rate: number; threshold: number };
    exemptionCredit: { amount: number; phaseoutStart: number; reductionPer2500: number };
    sdiRate: number;
    supplementalBonusAndStockRate: number;
  };
  safeHarbor: {
    priorYearHighIncomeAgi: number;
    federalPenaltyFloor: number;
    californiaPenaltyFloor: number;
    californiaNoPriorYearAgi: number;
  };
}

/** Year-to-date figures, as printed on the latest pay stub. */
export interface YearToDate {
  /** Pay date of the stub these figures come from (YYYY-MM-DD). */
  asOf: string;
  federalTaxableWages: number;
  californiaTaxableWages: number;
  socialSecurityWages: number;
  medicareWages: number;
  /** RSU and bonus income so far; drives the $1M federal supplemental threshold. */
  supplementalWages: number;
  federalIncomeTaxWithheld: number;
  californiaIncomeTaxWithheld: number;
  socialSecurityWithheld: number;
  /** Includes any additional 0.9% Medicare already withheld. */
  medicareWithheld: number;
  sdiWithheld: number;
}

/** One regular paycheck going forward, taken from the current stub's "this period" column. */
export interface RegularPaycheck {
  checksRemaining: number;
  gross: number;
  /** Traditional 401(k): lowers federal and CA wages, not FICA. */
  pretax401k: number;
  /** Section 125 (medical, dental, vision premiums): lowers federal, CA and FICA wages. */
  section125: number;
  /** HSA through payroll: lowers federal and FICA wages, but California taxes it. */
  hsa: number;
  /** Already includes any W-4 Step 4(c) extra. */
  federalWithholding: number;
  /** Already includes any DE 4 additional amount. */
  californiaWithholding: number;
}

export interface RsuVest {
  date: string;
  shares: number;
}

export interface Bonus {
  date: string;
  amount: number;
}

export interface OtherIncome {
  /** Total ordinary dividends (box 1a), including the qualified part. */
  ordinaryDividends: number;
  /** Qualified dividends (box 1b), a subset of ordinaryDividends. */
  qualifiedDividends: number;
  /** Gains from shares held a year or less. For RSU shares: sale price minus price at vest. */
  shortTermGains: number;
  longTermGains: number;
  /** Anything else that's ordinary income (side work, prizes). Not investment income. */
  otherOrdinary: number;
}

export interface PriorYear {
  federalTotalTax: number;
  federalAgi: number;
  californiaTotalTax: number;
  californiaAgi: number;
}

export interface ProjectionInput {
  year: TaxYear;
  ytd: YearToDate;
  paycheck: RegularPaycheck;
  vests: RsuVest[];
  /** Assumed share price at each remaining vest. */
  sharePrice: number;
  bonuses: Bonus[];
  other: OtherIncome;
  /** Federal rate elected on RSU income up to $1M of supplemental pay. Defaults to the flat 22%. */
  rsuFederalElectedRate?: number;
  priorYear?: PriorYear;
}
