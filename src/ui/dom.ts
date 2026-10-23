type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/** Tiny element builder. Strings become text nodes, so user text is never parsed as HTML. */
export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export interface NumberFieldOptions {
  hint?: string;
  step?: number;
  suffix?: string;
}

/** A labelled number input that calls `set` on every keystroke. Empty counts as 0. */
export function numberField(
  label: string,
  get: () => number,
  set: (v: number) => void,
  opts: NumberFieldOptions = {},
): HTMLElement {
  const input = h('input', {
    type: 'number',
    inputmode: 'decimal',
    step: opts.step ?? 'any',
    value: get() || '',
    placeholder: '0',
  }) as HTMLInputElement;
  input.addEventListener('input', () => {
    const v = Number(input.value.replace(/,/g, ''));
    set(Number.isFinite(v) ? v : 0);
  });
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label),
    h('span', { class: 'field-input' }, input, opts.suffix ? h('span', { class: 'suffix' }, opts.suffix) : null),
    opts.hint ? h('span', { class: 'field-hint' }, opts.hint) : null,
  );
}

export function dateField(label: string, get: () => string, set: (v: string) => void, hint?: string): HTMLElement {
  const input = h('input', { type: 'date', value: get() }) as HTMLInputElement;
  input.addEventListener('input', () => set(input.value));
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label),
    h('span', { class: 'field-input' }, input),
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  );
}

export function button(text: string, onClick: () => void, cls = 'btn'): HTMLElement {
  const b = h('button', { type: 'button', class: cls }, text);
  b.addEventListener('click', onClick);
  return b;
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function money(n: number): string {
  return usd0.format(Math.round(n) === 0 ? 0 : n);
}

export function pct(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
}
