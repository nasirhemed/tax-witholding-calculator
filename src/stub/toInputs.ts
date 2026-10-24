import type { RegularPaycheck, TaxYear, YearToDate } from '../engine';
import type { Amounts, ParsedStub } from './parse';

const SUPPLEMENTAL = /bonus|stock unit|\bgsu\b|\brsu\b|gross\W*up|award/i;
const RSU = /stock unit|\bgsu\b|\brsu\b/i;

export interface StubReading {
  ytd: YearToDate;
  /** Everything but checksRemaining, which depends on today's date. */
  paycheck: Omit<RegularPaycheck, 'checksRemaining'>;
  /** RSU and bonus income on this stub's own pay date, already in the YTD figures. */
  current: { rsu: number; otherSupplemental: number };
  ytdRsu: number;
  ytdOtherSupplemental: number;
  /** Things the stub didn't show, so the numbers are estimates or zero. */
  warnings: string[];
}

const sumWhere = (rows: Record<string, Amounts>, re: RegExp, pick: 'current' | 'ytd', not?: RegExp) =>
  Object.entries(rows)
    .filter(([label]) => re.test(label) && !(not && not.test(label)))
    .reduce((t, [, a]) => t + a[pick], 0);

/** Medicare wages from the Medicare tax, undoing the extra 0.9% above $200k. */
function medicareWagesFromTax(tax: number, year: TaxYear): number {
  const { medicareRate, additionalMedicareRate, additionalMedicareThreshold } = year.fica;
  const atThreshold = additionalMedicareThreshold * medicareRate;
  if (tax <= atThreshold) return tax / medicareRate;
  return additionalMedicareThreshold + (tax - atThreshold) / (medicareRate + additionalMedicareRate);
}

/**
 * Turns a parsed stub into the engine's inputs. When the stub's own period includes a vest
 * or bonus, that pay's flat-rate withholding is taken back out so the per-paycheck numbers
 * reflect a normal paycheck.
 */
export function readStub(stub: ParsedStub, year: TaxYear, rsuFederalRate: number): StubReading {
  const warnings: string[] = [];
  const { taxes, summary, earnings, deductions } = stub;
  const fed = year.federal.withholding.supplementalRate;
  const caRate = year.california.supplementalBonusAndStockRate;

  if (!stub.payDate) warnings.push('No pay date found; using today.');
  else if (!stub.payDate.startsWith(String(year.year))) warnings.push(`This stub is from ${stub.payDate.slice(0, 4)}, not ${year.year}.`);
  if (stub.payFrequency && stub.payFrequency !== 'biweekly') warnings.push(`Pay frequency is ${stub.payFrequency}; paychecks left assume biweekly.`);
  if (!summary.ytd) warnings.push('No Pay Summary YTD row found, so federal wages are estimated from earnings.');
  for (const [k, name] of [['federal', 'Federal Income Tax'], ['california', 'CA State Income Tax'], ['medicare', 'Medicare'], ['socialSecurity', 'Social Security']] as const) {
    if (!taxes[k]) warnings.push(`No ${name} row found; treated as $0.`);
  }

  const rsuYtd = sumWhere(earnings, RSU, 'ytd');
  const rsuCur = sumWhere(earnings, RSU, 'current');
  const suppYtd = sumWhere(earnings, SUPPLEMENTAL, 'ytd');
  const suppCur = sumWhere(earnings, SUPPLEMENTAL, 'current');
  const bonus401kCur = sumWhere(deductions, /bonus.*401k|401k.*bonus/i, 'current');
  const regular401kCur = sumWhere(deductions, /401k/i, 'current', /bonus|roth|after/i);
  const hsaCur = sumWhere(deductions, /\bhsa\b/i, 'current');
  const hsaYtd = sumWhere(deductions, /\bhsa\b/i, 'ytd');

  const totalEarningsYtd = Object.values(earnings).reduce((t, a) => t + a.ytd, 0);
  const totalEarningsCur = Object.values(earnings).reduce((t, a) => t + a.current, 0);
  const fitYtd = summary.ytd?.fitTaxableWages ?? totalEarningsYtd;
  const ssTaxYtd = taxes.socialSecurity?.ytd ?? 0;

  const ytd: YearToDate = {
    asOf: stub.payDate ?? new Date().toISOString().slice(0, 10),
    federalTaxableWages: fitYtd,
    // California taxes HSA money that federal excludes.
    californiaTaxableWages: fitYtd + hsaYtd,
    socialSecurityWages: Math.min(ssTaxYtd / year.fica.socialSecurityRate, year.fica.socialSecurityWageBase),
    medicareWages: medicareWagesFromTax(taxes.medicare?.ytd ?? 0, year),
    supplementalWages: suppYtd,
    federalIncomeTaxWithheld: taxes.federal?.ytd ?? 0,
    californiaIncomeTaxWithheld: taxes.california?.ytd ?? 0,
    socialSecurityWithheld: ssTaxYtd,
    medicareWithheld: taxes.medicare?.ytd ?? 0,
    sdiWithheld: taxes.caDisability?.ytd ?? 0,
  };

  // This period's regular pay = everything minus the vest/bonus part.
  const suppTaxableCur = Math.max(0, suppCur - bonus401kCur);
  const rsuShare = suppCur > 0 ? rsuCur / suppCur : 0;
  const grossCur = summary.current?.gross ?? totalEarningsCur;
  const fitCur = taxes.federal?.basedOn ?? summary.current?.fitTaxableWages ?? grossCur;
  const regularGross = Math.max(0, grossCur - suppCur);
  const regularFit = Math.max(0, fitCur - suppTaxableCur);
  const suppFedWithheld = suppTaxableCur * (rsuShare * rsuFederalRate + (1 - rsuShare) * fed);
  const suppCaWithheld = suppTaxableCur * caRate;

  return {
    ytd,
    paycheck: {
      gross: regularGross,
      pretax401k: regular401kCur,
      hsa: hsaCur,
      // Whatever else lowers federal wages (medical, dental, vision and similar).
      section125: Math.max(0, regularGross - regular401kCur - hsaCur - regularFit),
      federalWithholding: Math.max(0, (taxes.federal?.current ?? 0) - suppFedWithheld),
      californiaWithholding: Math.max(0, (taxes.california?.current ?? 0) - suppCaWithheld),
    },
    current: { rsu: rsuCur, otherSupplemental: suppCur - rsuCur },
    ytdRsu: rsuYtd,
    ytdOtherSupplemental: suppYtd - rsuYtd,
    warnings,
  };
}
