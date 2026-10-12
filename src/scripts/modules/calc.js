// [data-calc] — simple compound-growth illustration: inputs [name=amount] [name=years] [name=rate];
// outputs [data-calc-out="value|gain|multiple"]. Purely illustrative (the page states it is not a promise).
import { register } from '../core/page.js';

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

register({
  name: 'calc',
  selector: '[data-calc]',
  init(root) {
    const f = (n) => root.querySelector(`[name="${n}"]`);
    const out = (k) => root.querySelector(`[data-calc-out="${k}"]`);
    const run = () => {
      const a = parseFloat(f('amount')?.value || '0'), y = parseFloat(f('years')?.value || '0'), r = parseFloat(f('rate')?.value || '0');
      const v = a * Math.pow(1 + r / 100, y);
      root.querySelectorAll('[data-calc-show]').forEach((el) => { const n = el.dataset.calcShow; const x = f(n); if (x) el.textContent = n === 'amount' ? inr(x.value) : x.value; });
      if (out('value')) out('value').textContent = inr(v);
      if (out('gain')) out('gain').textContent = inr(v - a);
      if (out('multiple')) out('multiple').textContent = (a ? v / a : 0).toFixed(2) + '×';
    };
    root.addEventListener('input', run); run();
    return () => root.removeEventListener('input', run);
  },
});
