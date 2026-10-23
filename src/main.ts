import './styles.css';
import { projectYear, type Projection, TAX_YEAR_2026 } from './engine';
import { button, dateField, h, money, numberField, pct } from './ui/dom';
import { type AppState, biweeklyChecksLeft, initialState, monthlyVests, toInput } from './ui/state';

const state: AppState = initialState();
const app = document.getElementById('app')!;
const results = h('section', { class: 'results', 'aria-live': 'polite' });

function recompute(): void {
  results.replaceChildren(...renderResults(projectYear(toInput(state))));
}

function section(title: string, intro: string | null, ...body: (HTMLElement | null)[]): HTMLElement {
  return h('fieldset', { class: 'card' }, h('legend', {}, title), intro ? h('p', { class: 'intro' }, intro) : null, ...body);
}

const grid = (...fields: HTMLElement[]) => h('div', { class: 'grid' }, ...fields);

// Every input edits `state` and refreshes the results. Lists re-render their own block.
const num = (label: string, get: () => number, set: (v: number) => void, hint?: string) =>
  numberField(label, get, (v) => { set(v); recompute(); }, { hint });

function ytdSection(): HTMLElement {
  const y = state.ytd;
  return section(
    'Year to date',
    'Copy these from the YTD column of your latest pay stub.',
    grid(
      dateField('Pay date of that stub', () => y.asOf, (v) => { y.asOf = v; recompute(); }),
      num('Federal taxable wages', () => y.federalTaxableWages, (v) => (y.federalTaxableWages = v)),
      num('California taxable wages', () => y.californiaTaxableWages, (v) => (y.californiaTaxableWages = v)),
      num('Social Security wages', () => y.socialSecurityWages, (v) => (y.socialSecurityWages = v)),
      num('Medicare wages', () => y.medicareWages, (v) => (y.medicareWages = v)),
      num('RSU + bonus income so far', () => y.supplementalWages, (v) => (y.supplementalWages = v), 'Sets when the 37% rate kicks in above $1M'),
      num('Federal income tax withheld', () => y.federalIncomeTaxWithheld, (v) => (y.federalIncomeTaxWithheld = v)),
      num('California income tax withheld', () => y.californiaIncomeTaxWithheld, (v) => (y.californiaIncomeTaxWithheld = v)),
      num('Medicare withheld', () => y.medicareWithheld, (v) => (y.medicareWithheld = v)),
      num('SDI withheld', () => y.sdiWithheld, (v) => (y.sdiWithheld = v)),
    ),
  );
}

function paycheckSection(): HTMLElement {
  const p = state.paycheck;
  const checks = numberField('Paychecks left this year', () => p.checksRemaining, (v) => { p.checksRemaining = v; recompute(); }, {
    step: 1,
    hint: 'Biweekly count after the stub date. Edit if a payday falls differently.',
  });
  const refill = button('Recount from stub date', () => {
    p.checksRemaining = biweeklyChecksLeft(state.ytd.asOf);
    rerenderForm();
  }, 'btn btn-quiet');
  return section(
    'Each regular paycheck from here on',
    'Use the "this period" column of a normal paycheck (one with no vest or bonus on it).',
    grid(
      checks,
      num('Gross pay', () => p.gross, (v) => (p.gross = v)),
      num('401(k) pre-tax', () => p.pretax401k, (v) => (p.pretax401k = v)),
      num('Medical, dental, vision (pre-tax)', () => p.section125, (v) => (p.section125 = v)),
      num('HSA (pre-tax)', () => p.hsa, (v) => (p.hsa = v)),
      num('Federal income tax withheld', () => p.federalWithholding, (v) => (p.federalWithholding = v)),
      num('California income tax withheld', () => p.californiaWithholding, (v) => (p.californiaWithholding = v)),
    ),
    refill,
  );
}

function vestsSection(): HTMLElement {
  let fillShares = 0;
  let fillDay = 25;
  const rows = state.vests.map((v, i) =>
    h(
      'div',
      { class: 'row' },
      dateField('Vest date', () => v.date, (d) => { v.date = d; recompute(); }),
      num('Shares', () => v.shares, (n) => (v.shares = n)),
      button('Remove', () => { state.vests.splice(i, 1); rerenderForm(); }, 'btn btn-quiet'),
    ),
  );
  return section(
    'RSU vests still to come',
    'Only vests after the stub date count. Earlier ones are already in the YTD numbers.',
    grid(
      num('Assumed GOOG price at vest', () => state.sharePrice, (v) => (state.sharePrice = v)),
      numberField('Federal withholding rate on RSUs', () => state.rsuElectedRatePct, (v) => { state.rsuElectedRatePct = v; recompute(); }, {
        suffix: '%',
        hint: '22% unless you elected a higher rate',
      }),
    ),
    h(
      'div',
      { class: 'fill' },
      numberField('Shares per monthly vest', () => fillShares, (v) => (fillShares = v), { step: 1 }),
      numberField('Day of month', () => fillDay, (v) => (fillDay = v), { step: 1 }),
      button('Fill monthly vests', () => {
        state.vests = monthlyVests(state.ytd.asOf, fillDay, fillShares);
        rerenderForm();
      }),
    ),
    h('div', { class: 'rows' }, ...rows),
    button('Add a vest', () => { state.vests.push({ date: state.ytd.asOf, shares: 0 }); rerenderForm(); }, 'btn btn-quiet'),
  );
}

function bonusSection(): HTMLElement {
  const rows = state.bonuses.map((b, i) =>
    h(
      'div',
      { class: 'row' },
      dateField('Pay date', () => b.date, (d) => { b.date = d; recompute(); }),
      num('Amount', () => b.amount, (n) => (b.amount = n)),
      button('Remove', () => { state.bonuses.splice(i, 1); rerenderForm(); }, 'btn btn-quiet'),
    ),
  );
  return section(
    'Bonus still to come',
    rows.length ? null : 'Leave empty if this year\'s bonus is already paid.',
    h('div', { class: 'rows' }, ...rows),
    button('Add a bonus', () => { state.bonuses.push({ date: state.ytd.asOf, amount: 0 }); rerenderForm(); }, 'btn btn-quiet'),
  );
}

function otherSection(): HTMLElement {
  const o = state.other;
  return section(
    'Other income this year',
    'For RSU shares you sold, the gain is the sale price minus the price at vest.',
    grid(
      num('Short-term gains (held ≤ 1 year)', () => o.shortTermGains, (v) => (o.shortTermGains = v), 'Use a negative number for a loss'),
      num('Long-term gains', () => o.longTermGains, (v) => (o.longTermGains = v)),
      num('Ordinary dividends (total)', () => o.ordinaryDividends, (v) => (o.ordinaryDividends = v)),
      num('Qualified dividends (part of the total)', () => o.qualifiedDividends, (v) => (o.qualifiedDividends = v)),
      num('Other ordinary income', () => o.otherOrdinary, (v) => (o.otherOrdinary = v)),
    ),
  );
}

function priorSection(): HTMLElement {
  const p = state.prior;
  const toggle = h('input', { type: 'checkbox', checked: state.usePriorYear }) as HTMLInputElement;
  toggle.addEventListener('change', () => { state.usePriorYear = toggle.checked; rerenderForm(); });
  return section(
    'Last year (for the penalty check)',
    null,
    h('label', { class: 'check' }, toggle, ' Use last year\'s return'),
    state.usePriorYear
      ? grid(
          num('Federal total tax (1040 line 24)', () => p.federalTotalTax, (v) => (p.federalTotalTax = v)),
          num('Federal AGI (1040 line 11)', () => p.federalAgi, (v) => (p.federalAgi = v)),
          num('California total tax (540 line 64)', () => p.californiaTotalTax, (v) => (p.californiaTotalTax = v)),
          num('California AGI (540 line 17)', () => p.californiaAgi, (v) => (p.californiaAgi = v)),
        )
      : h('p', { class: 'intro' }, 'Without it, the check uses 90% of this year\'s tax.'),
  );
}

const form = h('form', { class: 'inputs', autocomplete: 'off' });
form.addEventListener('submit', (e) => e.preventDefault());

function rerenderForm(): void {
  form.replaceChildren(ytdSection(), paycheckSection(), vestsSection(), bonusSection(), otherSection(), priorSection());
  recompute();
}

function renderTax(
  name: string,
  t: Projection['federal'] | Projection['california'],
  supplementalRate: { rsu: number; bonus: number },
  futureRsu: number,
  futureBonus: number,
): HTMLElement {
  const owe = t.balanceDue > 0.5;
  const w = t.withheld;
  const rsuShort = futureRsu * t.marginalRate - w.rsus;
  const bonusShort = futureBonus * t.marginalRate - w.bonus;
  const sh = t.safeHarbor;
  const rows: [string, number, string?][] = [
    ['Total tax for the year', t.totalTax],
    ['Withheld so far', w.yearToDate],
    ['From remaining paychecks', w.regularPay],
    ['From RSU vests', w.rsus],
    ['From bonus', w.bonus],
  ];
  if (w.additionalMedicare) rows.push(['Extra 0.9% Medicare (counts as federal tax paid)', w.additionalMedicare]);
  return h(
    'article',
    { class: `tax ${owe ? 'owe' : 'refund'}` },
    h('h2', {}, name),
    h('p', { class: 'headline' }, owe ? `You'd owe ${money(t.balanceDue)}` : `Refund of ${money(-t.balanceDue)}`),
    h('p', { class: 'sub' }, `Top rate on wages: ${pct(t.marginalRate)}`),
    h(
      'table',
      {},
      h('tbody', {}, ...rows.map(([label, v]) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, money(v))))),
    ),
    futureRsu > 0 && rsuShort > 0.5
      ? h('p', { class: 'note' }, `RSUs still to vest are withheld at ${pct(supplementalRate.rsu)}, about ${money(rsuShort)} short of your ${pct(t.marginalRate)} rate.`)
      : null,
    futureBonus > 0 && bonusShort > 0.5
      ? h('p', { class: 'note' }, `The bonus is withheld at ${pct(supplementalRate.bonus)}, about ${money(bonusShort)} short.`)
      : null,
    h(
      'p',
      { class: `badge ${sh.met ? 'ok' : 'warn'}` },
      sh.met
        ? 'No underpayment penalty expected'
        : `Penalty risk: withhold ${money(sh.shortfall)} more by December to be safe`,
    ),
  );
}

function renderResults(p: Projection): HTMLElement[] {
  const y = TAX_YEAR_2026;
  return [
    renderTax('Federal', p.federal, { rsu: state.rsuElectedRatePct / 100, bonus: y.federal.withholding.supplementalRate }, p.income.futureRsuIncome, p.income.futureBonusIncome),
    renderTax('California', p.california, { rsu: y.california.supplementalBonusAndStockRate, bonus: y.california.supplementalBonusAndStockRate }, p.income.futureRsuIncome, p.income.futureBonusIncome),
    h(
      'p',
      { class: 'fine' },
      `Full-year wages: ${money(p.income.federalWages)} federal, ${money(p.income.californiaWages)} California. `,
      `Estimate for ${y.year}, single filer, standard deduction. Not tax advice.`,
    ),
  ];
}

app.append(
  h(
    'header',
    { class: 'top' },
    h('h1', {}, 'Withholding Calculator'),
    h('p', {}, `Tax year ${TAX_YEAR_2026.year} · California · Single. Everything stays in this tab; closing it clears your numbers.`),
  ),
  h('main', { class: 'layout' }, form, results),
);
rerenderForm();
