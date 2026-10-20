// "From the air" (src/components/home/AerialTour.astro): a step's pins pop in the first time it scrolls into view
// (.is-seen), their pulse runs only while the step is on screen (.is-on), and pointing at a highlight lights up its
// pin on the photo, and the other way round (.is-hot).
import { register } from '../core/page.js';

register({
  name: 'aerial-tour',
  selector: '[data-atr]',
  init(root) {
    const steps = [...root.querySelectorAll('[data-atr-step]')];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      e.target.classList.toggle('is-on', e.isIntersecting);
      if (e.isIntersecting) e.target.classList.add('is-seen');
    }), { rootMargin: '-12% 0px -12% 0px' });
    steps.forEach((s) => io.observe(s));

    const offs = [];
    steps.forEach((step) => {
      const pins = step.querySelectorAll('[data-atr-pin]');
      const rows = step.querySelectorAll('[data-atr-hl]');
      const set = (k, on) => { pins[k]?.classList.toggle('is-hot', on); rows[k]?.classList.toggle('is-hot', on); };
      [...pins, ...rows].forEach((el) => {
        const k = Number(el.dataset.atrPin ?? el.dataset.atrHl);
        const on = () => set(k, true), off = () => set(k, false);
        el.addEventListener('pointerenter', on);
        el.addEventListener('pointerleave', off);
        offs.push(() => { el.removeEventListener('pointerenter', on); el.removeEventListener('pointerleave', off); });
      });
    });
    return () => { io.disconnect(); offs.forEach((off) => off()); };
  },
});
