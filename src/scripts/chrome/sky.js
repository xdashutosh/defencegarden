// Real sky behind the whole site (src/components/chrome/Sky.astro): one fixed layer outside the Barba container, so
// it keeps playing across page transitions. The looping time-lapse starts after the first intro (the home preloader)
// once the main thread is idle; portrait screens load the 9:16 crop (swapped on rotation); a hidden tab pauses it;
// reduced motion keeps the still frame.
import { reduced } from '../core/gsap.js';
import { whenIntro } from '../core/intro.js';

export function initSky() {
  const v = document.querySelector('[data-sky] video');
  if (!v || reduced()) return;
  const portrait = matchMedia('(orientation: portrait)');
  const pick = () => (portrait.matches && v.dataset.srcMobile ? v.dataset.srcMobile : v.dataset.src);
  const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const load = () => {
    const src = pick();
    if (v.getAttribute('src') === src) return;
    v.classList.remove('is-playing');
    v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
    v.src = src;
    if (!document.hidden) play();
  };
  whenIntro().then(() => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(load, { timeout: 2000 }));
  portrait.addEventListener('change', () => { if (v.getAttribute('src')) load(); });
  document.addEventListener('visibilitychange', () => {
    if (!v.getAttribute('src')) return;
    if (document.hidden) v.pause();
    else play();
  });
}
