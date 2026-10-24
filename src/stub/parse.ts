/**
 * Reads a Google (Workday) "Pay Statement" from its text, whether it came out of the PDF or
 * was copied from the Workday page. Nothing here keeps the text: callers get numbers back.
 */

export interface Amounts {
  current: number;
  ytd: number;
}

export interface TaxRow extends Amounts {
  /** Taxable wages this period ("Based On"), when the row shows it. */
  basedOn?: number;
}

export interface ParsedStub {
  payDate?: string;
  periodEnd?: string;
  payFrequency?: string;
  /** Earnings rows by their printed label. */
  earnings: Record<string, Amounts>;
  /** Employee side of each deduction row. */
  deductions: Record<string, Amounts>;
  taxes: {
    federal?: TaxRow;
    medicare?: TaxRow;
    socialSecurity?: TaxRow;
    california?: TaxRow;
    /** SDI, or Google's CA Voluntary Plan that replaces it. */
    caDisability?: TaxRow;
  };
  summary: {
    current?: SummaryRow;
    ytd?: SummaryRow;
  };
}

export interface SummaryRow {
  gross: number;
  fitTaxableWages: number;
  taxes: number;
  deductions: number;
  netPay: number;
}

type Section = 'none' | 'earnings' | 'deductions' | 'earnings+deductions' | 'taxes' | 'summary' | 'other';

// Money has exactly two decimals; hours print six ("80.000000") and are skipped.
const MONEY = /(?<![\d.])\(?-?\$?\d[\d,]*\.\d{2}(?![\d])\)?/g;
const DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

function toNumber(s: string): number {
  const negative = s.includes('(') || s.includes('-');
  const n = Number(s.replace(/[^\d.]/g, ''));
  return negative ? -n : n;
}

function isoDate(m: RegExpMatchArray): string {
  return `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

/** Splits a line into [label, numbers] runs: "A 1.00 2.00 B 3.00" → [A,[1,2]], [B,[3]]. */
function segments(line: string): { label: string; nums: number[] }[] {
  const out: { label: string; nums: number[] }[] = [];
  let last = 0;
  let current: { label: string; nums: number[] } | null = null;
  for (const m of line.matchAll(MONEY)) {
    const between = line.slice(last, m.index).replace(/\b\d+\.\d{3,}\b/g, '').replace(/\$/g, '').trim();
    if (between || !current) {
      current = { label: between, nums: [] };
      out.push(current);
    }
    current.nums.push(toNumber(m[0]));
    last = m.index! + m[0].length;
  }
  const tail = line.slice(last).replace(/\b\d+\.\d{3,}\b/g, '').trim();
  if (tail && out.length) out.push({ label: tail, nums: [] });
  return out.filter((s) => s.label);
}

function sectionOf(line: string): Section | null {
  const t = line.trim();
  if (/^Earnings\b.*\bDeductions\b/i.test(t)) return 'earnings+deductions';
  if (/^Earnings$/i.test(t)) return 'earnings';
  if (/^Deductions$/i.test(t)) return 'deductions';
  if (/^Taxes$/i.test(t)) return 'taxes';
  if (/^Pay Summary$/i.test(t)) return 'summary';
  if (/^(Paid Time Off|Net Pay Distribution)\b/i.test(t)) return 'other';
  return null;
}

const DEDUCTION_HINT = /401k|dental|vision|medical|legal|offset|hsa|fsa|insurance|ee$/i;

function taxKey(label: string): keyof ParsedStub['taxes'] | null {
  if (/federal income/i.test(label)) return 'federal';
  if (/medicare/i.test(label)) return 'medicare';
  if (/social security|oasdi/i.test(label)) return 'socialSecurity';
  if (/state income/i.test(label)) return 'california';
  if (/voluntary plan|\bSDI\b|disability/i.test(label)) return 'caDisability';
  return null;
}

function amounts(nums: number[]): Amounts {
  if (nums.length >= 2) return { current: nums[0]!, ytd: nums[1]! };
  return { current: 0, ytd: nums[0] ?? 0 };
}

export function parseStub(text: string): ParsedStub {
  const stub: ParsedStub = { earnings: {}, deductions: {}, taxes: {}, summary: {} };
  let section: Section = 'none';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const next = sectionOf(line);
    if (next) {
      section = next;
      continue;
    }

    const payDate = /Pay Date\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(line);
    if (payDate) stub.payDate = isoDate(payDate[1]!.match(DATE)!);
    const periodEnd = /Period End Date\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(line);
    if (periodEnd) stub.periodEnd = isoDate(periodEnd[1]!.match(DATE)!);
    const freq = /Pay Frequency\s*(Biweekly|Semi-?monthly|Weekly|Monthly)/i.exec(line);
    if (freq) stub.payFrequency = freq[1]!.toLowerCase();

    const segs = segments(line);
    if (!segs.length) continue;

    if (section === 'summary') {
      const s = segs[0]!;
      const which = /^current/i.test(s.label) ? 'current' : /^ytd/i.test(s.label) ? 'ytd' : null;
      if (which && s.nums.length >= 5) {
        const [gross, fitTaxableWages, taxes, deductions, netPay] = s.nums as [number, number, number, number, number];
        stub.summary[which] = { gross, fitTaxableWages, taxes, deductions, netPay };
      }
      continue;
    }

    if (section === 'taxes') {
      for (const s of segs) {
        const key = taxKey(s.label);
        if (!key) continue;
        const n = s.nums;
        stub.taxes[key] = n.length >= 3 ? { basedOn: n[0], current: n[1]!, ytd: n[2]! } : amounts(n);
      }
      continue;
    }

    if (section === 'earnings' || section === 'deductions' || section === 'earnings+deductions') {
      segs.forEach((s, i) => {
        if (!s.nums.length) return;
        let isDeduction = section === 'deductions';
        if (section === 'earnings+deductions') {
          // Side by side: the first run on a line is Earnings, a second one is Deductions.
          isDeduction = segs.length > 1 ? i > 0 : DEDUCTION_HINT.test(s.label);
        }
        if (isDeduction) {
          // Employee current/YTD come first, then employer current/YTD.
          stub.deductions[s.label] = amounts(s.nums);
        } else {
          // Hours and pay rate come before current/YTD, so take the last two.
          stub.earnings[s.label] = amounts(s.nums.slice(-2));
        }
      });
    }
  }
  return stub;
}
