import barba from '@barba/core';
import { gsap } from '../core/gsap.js';
import { mountPage, unmountPage } from '../core/page.js';
import { toTop } from '../core/scroll.js';
import { resetIntro, releaseIntro } from '../core/intro.js';
import { syncHead } from '../../lib/head-sync.js';
import { closeMenu } from './menu.js';
import { markCurrentNav } from './header.js';


// Astro emits per-page CSS (<style> in dev, <link rel="stylesheet"> / inlined <style> in production) in <head>.
// Barba only swaps the container, so copy any stylesheet the next page needs before it is shown.
function styleKey(n) {
  return n.tagName === 'LINK' ? n.href : (n.getAttribute('data-vite-dev-id') || n.textContent);
}
async function syncStyles(html) {
  if (!html) return;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const have = new Set([...document.head.querySelectorAll('link[rel="stylesheet"], style')].map(styleKey));
  const loads = [];
  for (const n of doc.head.querySelectorAll('link[rel="stylesheet"], style')) {
    if (have.has(styleKey(n))) continue;
    const c = document.importNode(n, true);
    if (c.tagName === 'LINK') loads.push(new Promise((r) => { c.onload = c.onerror = r; setTimeout(r, 4000); }));
    document.head.append(c);
  }
  await Promise.all(loads);
}

const curtain = () => document.querySelector('[data-curtain]');

function curtainIn() {
  const c = curtain();
  return gsap.timeline()
    .set(c, { y: 0, yPercent: 100, autoAlpha: 1 })
    .to(c, { yPercent: 0, duration: 0.85, ease: 'dgInOut' })
    .to(c.querySelector('.curtain__logo'), { autoAlpha: 1, duration: 0.3 }, '-=0.3');
}
function curtainOut() {
  const c = curtain();
  return gsap.timeline()
    .to(c.querySelector('.curtain__logo'), { autoAlpha: 0, duration: 0.2 })
    .to(c, { yPercent: -100, duration: 0.95, ease: 'dgInOut' });
}

export function initTransitions() {
  barba.init({
    preventRunning: true,
    timeout: 12000,
    prevent: ({ el, href }) => {
      if (!el || el.hasAttribute('data-no-barba') || el.target === '_blank' || el.hasAttribute('download')) return true;
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return true;
      if (/^\/(booking|verify-receipt)/.test(u.pathname)) return true;
      if (/\.(pdf|jpe?g|png|webp|mp4|xml|txt)$/i.test(u.pathname)) return true;
      return false;
    },
    transitions: [{
      name: 'curtain',
      async leave() {
        await closeMenu(true);
        await curtainIn();
        unmountPage();
      },
      async enter({ current, next }) {
        // Barba (async mode) only removes the old container after enter resolves — drop it now so the new
        // page starts at the top under the curtain.
        await syncStyles(next.html);
        current?.container?.remove();
        syncHead(next.container);
        toTop();
        markCurrentNav(new URL(next.url.href).pathname);
        resetIntro(false);
        mountPage(next.container);
        next.container.focus({ preventScroll: true });
        await curtainOut();
        releaseIntro();
      },
    }],
  });
}
