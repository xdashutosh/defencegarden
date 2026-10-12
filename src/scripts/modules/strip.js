// [data-strip] > [data-strip-track] (overflow-x scroller of slides) + [data-strip-prev]/[data-strip-next] buttons
// + optional [data-strip-count]. Mouse drag on desktop; native swipe on touch.
import { register } from '../core/page.js';

register({
  name: 'strip',
  selector: '[data-strip]',
  init(el) {
    const track = el.querySelector('[data-strip-track]');
    if (!track) return;
    const prev = el.querySelector('[data-strip-prev]');
    const next = el.querySelector('[data-strip-next]');
    const count = el.querySelector('[data-strip-count]');
    const slides = [...track.children];
    const step = () => (slides[0]?.getBoundingClientRect().width || 300) + parseFloat(getComputedStyle(track).columnGap || '16');
    const go = (d) => track.scrollBy({ left: d * step(), behavior: 'smooth' });
    const onPrev = () => go(-1), onNext = () => go(1);
    prev?.addEventListener('click', onPrev); next?.addEventListener('click', onNext);
    const update = () => {
      const i = Math.round(track.scrollLeft / step());
      if (count) count.textContent = `${String(Math.min(slides.length, i + 1)).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4;
    };
    track.addEventListener('scroll', update, { passive: true }); update();
    // drag to scroll (mouse only)
    let down = false, sx = 0, sl = 0, moved = false;
    const md = (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.classList.add('is-drag'); };
    const mv = (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; track.scrollLeft = sl - dx; };
    const mu = () => { down = false; track.classList.remove('is-drag'); };
    const clk = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
    track.addEventListener('pointerdown', md); window.addEventListener('pointermove', mv); window.addEventListener('pointerup', mu); track.addEventListener('click', clk, true);
    return () => {
      prev?.removeEventListener('click', onPrev); next?.removeEventListener('click', onNext); track.removeEventListener('scroll', update);
      track.removeEventListener('pointerdown', md); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', mu); track.removeEventListener('click', clk, true);
    };
  },
});
