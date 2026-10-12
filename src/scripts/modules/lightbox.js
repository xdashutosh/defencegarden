// [data-lightbox] container; every [data-lightbox-item] (an <a href="full image url"> wrapping a thumbnail,
// with data-caption) opens a full-screen viewer with prev/next, keyboard and swipe.
import { gsap } from '../core/gsap.js';
import { register } from '../core/page.js';
import { stopScroll, startScroll } from '../core/scroll.js';

function build() {
  const box = document.createElement('div');
  box.className = 'lbx';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Image viewer');
  box.innerHTML = `<div class="lbx__stage"><img class="lbx__img" alt="" /></div>
    <p class="lbx__cap"></p><p class="lbx__count eyebrow"></p>
    <button class="lbx__btn lbx__close" type="button" aria-label="Close">✕</button>
    <button class="lbx__btn lbx__prev" type="button" aria-label="Previous image">←</button>
    <button class="lbx__btn lbx__next" type="button" aria-label="Next image">→</button>`;
  document.body.append(box);
  return box;
}

register({
  name: 'lightbox',
  selector: '[data-lightbox]',
  init(root) {
    const items = () => [...root.querySelectorAll('[data-lightbox-item]')].filter((a) => a.offsetParent !== null);
    let box = null, list = [], i = 0, lastFocus = null, sx = 0;
    const show = (n) => {
      i = (n + list.length) % list.length;
      const a = list[i];
      const img = box.querySelector('.lbx__img');
      gsap.fromTo(img, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.6 });
      img.src = a.getAttribute('href'); img.alt = a.dataset.alt || '';
      box.querySelector('.lbx__cap').textContent = a.dataset.caption || '';
      box.querySelector('.lbx__count').textContent = `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
    };
    const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); };
    const close = () => {
      if (!box) return;
      const b = box; box = null;
      document.removeEventListener('keydown', key);
      gsap.to(b, { autoAlpha: 0, duration: 0.35, onComplete: () => b.remove() });
      startScroll(); lastFocus?.focus();
    };
    const open = (a) => {
      list = items(); lastFocus = a;
      box = build(); stopScroll();
      box.querySelector('.lbx__close').addEventListener('click', close);
      box.querySelector('.lbx__prev').addEventListener('click', () => show(i - 1));
      box.querySelector('.lbx__next').addEventListener('click', () => show(i + 1));
      box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lbx__stage')) close(); });
      box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
      document.addEventListener('keydown', key);
      gsap.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
      show(list.indexOf(a));
      box.querySelector('.lbx__close').focus();
    };
    const onClick = (e) => { const a = e.target.closest('[data-lightbox-item]'); if (!a || !root.contains(a)) return; e.preventDefault(); open(a); };
    root.addEventListener('click', onClick);
    return () => { root.removeEventListener('click', onClick); close(); };
  },
});
