import type { Bracket } from './types';

/** Tax on `income` using progressive brackets. */
export function bracketTax(income: number, brackets: Bracket[]): number {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i]!;
    const next = brackets[i + 1];
    if (income <= b.over) break;
    const top = next ? Math.min(income, next.over) : income;
    tax += (top - b.over) * b.rate;
  }
  return tax;
}

/** Rate on the next dollar of `income`. */
export function marginalRate(income: number, brackets: Bracket[]): number {
  let rate = 0;
  for (const b of brackets) {
    if (income >= b.over) rate = b.rate;
  }
  return rate;
}
