// Elements with data-header-tone="dark|light" set the fixed header's colour while they sit under it.
// Zones may nest/overlap (e.g. a hero whose lower half turns dark): the active zone that started last wins.
// The container's data-tone is the default at the very top of the page. The header also gets data-surface from the
// active zone (data-header-surface="media" over film/photo heroes, "green" over .t-green sections), where the logo's
// green "Defence" would lose contrast (Header.astro turns it ivory).
import { ScrollTrigger } from '../core/gsap.js';
import { register } from '../core/page.js';

const hdr = () => document.querySelector('[data-hdr]');
export function setTone(t) { const h = hdr(); if (h && t) h.dataset.tone = t; }
function setSurface(zone) {
  const h = hdr();
  if (!h) return;
  const s = zone ? zone.dataset.headerSurface || (zone.closest('.t-green') ? 'green' : '') : '';
  if (s) h.dataset.surface = s;
  else delete h.dataset.surface;
}

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
      setSurface(best ? best.trigger : null);
    };
    container.querySelectorAll('[data-header-tone]').forEach((zone) => {
      sts.push(ScrollTrigger.create({ trigger: zone, start: 'top 46px', end: 'bottom 46px', onToggle: pick, onRefresh: pick }));
    });
    pick();
  },
});
