import { gsap } from '../core/gsap.js';
import { stopScroll, startScroll } from '../core/scroll.js';

let open = false, tl = null;
const $ = (s) => document.querySelector(s);

export function closeMenu(instant = false) {
  if (!open) return Promise.resolve();
  open = false;
  const menu = $('[data-menu]');
  document.documentElement.classList.remove('menu-open');
  $('[data-menu-open]')?.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true');
  startScroll();
  return new Promise((res) => {
    tl?.kill();
    if (instant) { gsap.set(menu, { clipPath: 'inset(0 0 100% 0)', visibility: 'hidden' }); return res(); }
    gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'dgInOut', onComplete: () => { gsap.set(menu, { visibility: 'hidden' }); res(); } });
  });
}

function openMenu() {
  const menu = $('[data-menu]');
  open = true;
  document.documentElement.classList.add('menu-open');
  $('[data-menu-open]')?.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-hidden', 'false');
  stopScroll();
  tl?.kill();
  tl = gsap.timeline();
  tl.set(menu, { visibility: 'visible' })
    .fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'dgInOut' })
    .fromTo(menu.querySelectorAll('.menu__item'), { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.9, stagger: 0.05 }, 0.35)
    .fromTo(menu.querySelectorAll('.menu__foot > *'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05 }, 0.6);
  menu.querySelector('[data-menu-link]')?.focus({ preventScroll: true });
  setFrame(0);
}

function setFrame(i) {
  document.querySelectorAll('[data-menu-frame]').forEach((f) => f.classList.toggle('is-on', f.dataset.menuFrame === String(i)));
}

export function initMenu() {
  const btn = $('[data-menu-open]');
  btn?.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  document.querySelectorAll('[data-menu-link]').forEach((a) => {
    a.addEventListener('mouseenter', () => setFrame(a.dataset.menuIndex));
    a.addEventListener('focus', () => setFrame(a.dataset.menuIndex));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { closeMenu(); btn?.focus(); } });
  gsap.set('[data-menu]', { clipPath: 'inset(0 0 100% 0)' });
}

export const isMenuOpen = () => open;
