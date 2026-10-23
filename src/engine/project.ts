import { marginalRate } from './brackets';
import { californiaIncomeTax } from './california';
import { additionalMedicareTax, federalIncomeTax, niit } from './federal';
import { californiaSafeHarbor, federalSafeHarbor, type SafeHarborResult } from './safeHarbor';
import type { ProjectionInput } from './types';
import { federalSupplementalWithholding } from './withholding';

/** Withholding split by where it came from. */
export interface WithheldBySource {
  yearToDate: number;
  regularPay: number;
  rsus: number;
  bonus: number;
  /** Federal only: the extra 0.9% Medicare, which counts as a federal tax payment. */
  additionalMedicare: number;
  total: number;
}

export interface Projection {
  income: {
    federalWages: number;
    californiaWages: number;
    medicareWages: number;
    socialSecurityWages: number;
    futureRegularWages: number;
    futureRsuIncome: number;
    futureBonusIncome: number;
  };
  federal: {
    agi: number;
    taxableIncome: number;
    marginalRate: number;
    incomeTax: number;
    niit: number;
    additionalMedicare: number;
    totalTax: number;
    withheld: WithheldBySource;
    /** Positive = owe in April, negative = refund. */
    balanceDue: number;
    safeHarbor: SafeHarborResult;
  };
  california: {
    agi: number;
    taxableIncome: number;
    marginalRate: number;
    totalTax: number;
    withheld: WithheldBySource;
    balanceDue: number;
    safeHarbor: SafeHarborResult;
  };
  payroll: {
    socialSecurity: number;
    medicare: number;
    sdi: number;
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Projects full-year tax and withholding from year-to-date figures plus what's still to come. */
export function projectYear(input: ProjectionInput): Projection {
  const { year, ytd, paycheck: pc, other } = input;
  const after = (d: string) => d > ytd.asOf;

  // Future income
  const futureRegularGross = pc.checksRemaining * pc.gross;
  const futureFederalRegular = pc.checksRemaining * (pc.gross - pc.pretax401k - pc.section125 - pc.hsa);
  const futureCaliforniaRegular = pc.checksRemaining * (pc.gross - pc.pretax401k - pc.section125);
  const futureFicaRegular = pc.checksRemaining * (pc.gross - pc.section125 - pc.hsa);

  const events = [
    ...input.vests.filter((v) => after(v.date)).map((v) => ({ date: v.date, kind: 'rsu' as const, amount: v.shares * input.sharePrice })),
    ...input.bonuses.filter((b) => after(b.date)).map((b) => ({ date: b.date, kind: 'bonus' as const, amount: b.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const futureRsu = sum(events.filter((e) => e.kind === 'rsu').map((e) => e.amount));
  const futureBonus = sum(events.filter((e) => e.kind === 'bonus').map((e) => e.amount));
  const futureSupplemental = futureRsu + futureBonus;

  const federalWages = ytd.federalTaxableWages + futureFederalRegular + futureSupplemental;
  const californiaWages = ytd.californiaTaxableWages + futureCaliforniaRegular + futureSupplemental;
  const medicareWages = ytd.medicareWages + futureFicaRegular + futureSupplemental;
  const socialSecurityWages = Math.min(
    ytd.socialSecurityWages + futureFicaRegular + futureSupplemental,
    year.fica.socialSecurityWageBase,
  );

  // Other income. Net capital losses offset at most $3,000 of other income.
  const netGains = other.shortTermGains + other.longTermGains;
  const capitalAdjustment = netGains >= 0 ? netGains : Math.max(-3_000, netGains);
  const otherIncome = other.ordinaryDividends + other.otherOrdinary + capitalAdjustment;
  const preferential = other.qualifiedDividends + Math.max(0, Math.min(other.longTermGains, netGains));
  const investmentIncome = other.ordinaryDividends + Math.max(0, netGains);

  // Federal tax
  const federalAgi = federalWages + otherIncome;
  const federalTaxable = Math.max(0, federalAgi - year.federal.standardDeduction);
  const federalIncome = federalIncomeTax(federalTaxable, preferential, year);
  const federalNiit = niit(investmentIncome, federalAgi, year);
  const addlMedicare = additionalMedicareTax(medicareWages, year);
  const federalTotal = federalIncome + federalNiit + addlMedicare;

  // Federal withholding
  const rsuRate = input.rsuFederalElectedRate ?? year.federal.withholding.supplementalRate;
  let supplementalSoFar = ytd.supplementalWages;
  let rsuWithheld = 0;
  let bonusWithheld = 0;
  for (const e of events) {
    if (e.kind === 'rsu') rsuWithheld += federalSupplementalWithholding(e.amount, supplementalSoFar, year, rsuRate);
    else bonusWithheld += federalSupplementalWithholding(e.amount, supplementalSoFar, year);
    supplementalSoFar += e.amount;
  }
  const regularFederalWithheld = pc.checksRemaining * pc.federalWithholding;
  // Employers withhold the extra 0.9% on Medicare wages over $200k. For a single filer with
  // one employer, that matches what's owed.
  const addlMedicareWithheld = addlMedicare;
  const federalWithheld: WithheldBySource = {
    yearToDate: ytd.federalIncomeTaxWithheld,
    regularPay: regularFederalWithheld,
    rsus: rsuWithheld,
    bonus: bonusWithheld,
    additionalMedicare: addlMedicareWithheld,
    total: ytd.federalIncomeTaxWithheld + regularFederalWithheld + rsuWithheld + bonusWithheld + addlMedicareWithheld,
  };

  // California tax. CA taxes capital gains as ordinary income and taxes payroll HSA money.
  const californiaAgi = californiaWages + otherIncome;
  const californiaTaxable = Math.max(0, californiaAgi - year.california.standardDeduction);
  const californiaTotal = californiaIncomeTax(californiaTaxable, federalAgi, year);

  const caRate = year.california.supplementalBonusAndStockRate;
  const californiaWithheld: WithheldBySource = {
    yearToDate: ytd.californiaIncomeTaxWithheld,
    regularPay: pc.checksRemaining * pc.californiaWithholding,
    rsus: futureRsu * caRate,
    bonus: futureBonus * caRate,
    additionalMedicare: 0,
    total: 0,
  };
  californiaWithheld.total =
    californiaWithheld.yearToDate + californiaWithheld.regularPay + californiaWithheld.rsus + californiaWithheld.bonus;

  const prior = input.priorYear;
  return {
    income: {
      federalWages,
      californiaWages,
      medicareWages,
      socialSecurityWages,
      futureRegularWages: futureRegularGross,
      futureRsuIncome: futureRsu,
      futureBonusIncome: futureBonus,
    },
    federal: {
      agi: federalAgi,
      taxableIncome: federalTaxable,
      marginalRate: marginalRate(federalTaxable - preferential, year.federal.brackets),
      incomeTax: federalIncome,
      niit: federalNiit,
      additionalMedicare: addlMedicare,
      totalTax: federalTotal,
      withheld: federalWithheld,
      balanceDue: federalTotal - federalWithheld.total,
      safeHarbor: federalSafeHarbor(
        federalTotal,
        federalWithheld.total,
        prior && { totalTax: prior.federalTotalTax, agi: prior.federalAgi },
        year,
      ),
    },
    california: {
      agi: californiaAgi,
      taxableIncome: californiaTaxable,
      marginalRate: marginalRate(californiaTaxable, year.california.brackets),
      totalTax: californiaTotal,
      withheld: californiaWithheld,
      balanceDue: californiaTotal - californiaWithheld.total,
      safeHarbor: californiaSafeHarbor(
        californiaTotal,
        californiaWithheld.total,
        californiaAgi,
        prior && { totalTax: prior.californiaTotalTax, agi: prior.californiaAgi },
        year,
      ),
    },
    payroll: {
      socialSecurity: socialSecurityWages * year.fica.socialSecurityRate,
      medicare: medicareWages * year.fica.medicareRate + addlMedicare,
      // SDI wages: gross minus Section 125 (401(k) money is still subject to SDI).
      sdi:
        ytd.sdiWithheld +
        (pc.checksRemaining * (pc.gross - pc.section125) + futureSupplemental) * year.california.sdiRate,
    },
  };
}
