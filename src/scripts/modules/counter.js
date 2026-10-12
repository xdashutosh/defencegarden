// [data-counter="2006"] counts up from data-counter-from (default 0) when visible. Keeps prefix/suffix spans.
import { gsap, ScrollTrigger, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

register({
  name: 'counter',
  selector: '[data-counter]',
  init(el) {
    const to = parseFloat(el.dataset.counter);
    const from = parseFloat(el.dataset.counterFrom || '0');
    const pad = el.dataset.counterPad ? parseInt(el.dataset.counterPad, 10) : 0;
    const fmt = (v) => String(Math.round(v)).padStart(pad, '0');
    if (reduced() || Number.isNaN(to)) { el.textContent = fmt(to); return; }
    const o = { v: from };
    el.textContent = fmt(from);
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2.2, ease: 'power2.out', onUpdate: () => (el.textContent = fmt(o.v)) }) });
  },
});
