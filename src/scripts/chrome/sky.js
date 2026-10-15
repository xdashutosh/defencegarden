// Real sky behind the whole site (src/components/chrome/Sky.astro): one fixed layer outside the Barba container, so
// it keeps playing across page transitions. The looping time-lapse starts after the first intro (the home preloader)
// once the main thread is idle; portrait screens load the 9:16 crop (swapped on rotation); reduced motion keeps the
// still frame. To save decoding and compositing it only plays while it can actually be seen: holdSky(key, on) pauses
// it while any hold is set — a hidden tab, a page where no see-through section is on screen ('page', below), or the
// home film covering the whole screen ('hero', frameHero.js).
import { reduced } from '../core/gsap.js';
import { whenIntro } from '../core/intro.js';
import { register } from '../core/page.js';

const holds = new Set();
let video = null;
let ready = false;

const play = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
function apply() {
  if (!video || !ready) return;
  if (holds.size) { if (!video.paused) video.pause(); }
  else if (video.paused) play();
}

/** Pause the sky while `on` for this key (several keys may hold it at once). */
export function holdSky(key, on) {
  if (on) holds.add(key); else holds.delete(key);
  apply();
}

export function initSky() {
  const v = document.querySelector('[data-sky] video');
  if (!v || reduced()) return;
  video = v;
  const portrait = matchMedia('(orientation: portrait)');
  const pick = () => (portrait.matches && v.dataset.srcMobile ? v.dataset.srcMobile : v.dataset.src);
  const load = () => {
    const src = pick();
    if (v.getAttribute('src') === src) return;
    v.classList.remove('is-playing');
    v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
    v.src = src;
    ready = true;
    if (holds.size) v.pause(); else play();
  };
  whenIntro().then(() => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(load, { timeout: 2000 }));
  portrait.addEventListener('change', () => { if (v.getAttribute('src')) load(); });
  const onVis = () => holdSky('tab', document.hidden);
  document.addEventListener('visibilitychange', onVis);
  onVis();
}

/** Alpha of a computed background colour: rgb()/rgba() (comma or space syntax), color(srgb … / a), transparent. */
function bgAlpha(c) {
  if (!c || c === 'transparent') return 0;
  const slash = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(c);
  if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = /^rgba\(([^)]+)\)$/.exec(c);
  if (rgba) return parseFloat(rgba[1].split(',')[3] ?? '1');
  return 1;
}

// per page: hold the sky while none of the page's see-through sections (translucent or transparent background) is
// on screen — e.g. inside the navy statement, the footer or a solid dark block
register({
  name: 'sky-visibility',
  selector: null,
  init(_el, { container }) {
    if (!video) return;
    const seeThrough = [...container.querySelectorAll('section')].filter((s) => {
      const cs = getComputedStyle(s);
      return bgAlpha(cs.backgroundColor) < 0.99 || cs.backgroundImage !== 'none';
    });
    if (!seeThrough.length) { holdSky('page', true); return () => holdSky('page', false); }
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      holdSky('page', visible.size === 0);
    });
    seeThrough.forEach((s) => io.observe(s));
    return () => { io.disconnect(); holdSky('page', false); };
  },
});
