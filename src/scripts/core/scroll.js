import Lenis from 'lenis';
import { gsap, ScrollTrigger, reduced } from './gsap.js';

let lenis = null;
const listeners = new Set();

export function initScroll() {
  if (reduced()) {
    window.addEventListener('scroll', () => listeners.forEach((fn) => fn({ scroll: scrollY, direction: 0, velocity: 0 })), { passive: true });
    return null;
  }
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, touchMultiplier: 1.6 });
  lenis.on('scroll', (e) => { ScrollTrigger.update(); listeners.forEach((fn) => fn(e)); });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  if (import.meta.env.DEV) window.__lenis = lenis;
  return lenis;
}
export const getLenis = () => lenis;
export function onScroll(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function stopScroll() { lenis?.stop(); document.documentElement.classList.add('scroll-locked'); }
export function startScroll() { lenis?.start(); document.documentElement.classList.remove('scroll-locked'); }
export function toTop() { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0); }
export function scrollToEl(el, offset = 0) { if (lenis) lenis.scrollTo(el, { offset }); else el.scrollIntoView({ behavior: 'smooth' }); }
