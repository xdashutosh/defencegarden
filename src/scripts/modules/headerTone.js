// Elements with data-header-tone="dark|light" set the fixed header's colour while they sit under it.
// Zones may nest/overlap (e.g. a hero whose lower half turns dark): the active zone that started last wins.
// The container's data-tone is the default at the very top of the page.
import { ScrollTrigger } from '../core/gsap.js';
import { register } from '../core/page.js';

const hdr = () => document.querySelector('[data-hdr]');
export function setTone(t) { const h = hdr(); if (h && t) h.dataset.tone = t; }

register({
  name: 'header-tone',
  selector: null,
  init(_el, { container }) {
    const fallback = container.dataset.tone || 'dark';
    setTone(fallback);
    const sts = [];
    const pick = () => {
      let best = null;
      for (const st of sts) if (st.isActive && (!best || st.start >= best.start)) best = st;
      setTone(best ? best.trigger.dataset.headerTone : fallback);
    };
    container.querySelectorAll('[data-header-tone]').forEach((zone) => {
      sts.push(ScrollTrigger.create({ trigger: zone, start: 'top 46px', end: 'bottom 46px', onToggle: pick, onRefresh: pick }));
    });
    pick();
  },
});
