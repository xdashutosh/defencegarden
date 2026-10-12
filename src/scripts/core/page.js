// Page module registry: each module = { name, selector, init(el, ctx) → cleanup? }.
// mountPage(container) runs every module on matching elements inside a gsap.context; unmountPage() reverts it all.
import { gsap, ScrollTrigger } from './gsap.js';

const modules = [];
let current = null;

export function register(mod) { modules.push(mod); }

export function mountPage(container) {
  const cleanups = [];
  const ctx = gsap.context(() => {
    for (const m of modules) {
      const els = m.selector ? container.querySelectorAll(m.selector) : [container];
      els.forEach((el) => {
        try {
          const c = m.init(el, { container });
          if (typeof c === 'function') cleanups.push(c);
        } catch (err) {
          console.error(`[dg] module ${m.name} failed`, err);
        }
      });
    }
  }, container);
  current = { container, ctx, cleanups };
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export function unmountPage() {
  if (!current) return;
  current.cleanups.forEach((c) => { try { c(); } catch (e) { console.error(e); } });
  current.ctx.revert();
  ScrollTrigger.getAll().forEach((st) => st.kill());
  current = null;
}

/** Run fn inside the current page context (for tweens created later, e.g. on click). */
export function inPage(fn) { return current ? current.ctx.add(fn) : fn(); }
