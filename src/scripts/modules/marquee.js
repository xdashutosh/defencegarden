// [data-marquee] > [data-marquee-track] (content duplicated twice). Infinite loop; scroll velocity nudges speed.
// data-marquee-speed (px/s, default 60), data-marquee-dir="-1" to reverse.
import { gsap, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';
import { onScroll } from '../core/scroll.js';

register({
  name: 'marquee',
  selector: '[data-marquee]',
  init(el) {
    const track = el.querySelector('[data-marquee-track]');
    if (!track || reduced()) return;
    const speed = parseFloat(el.dataset.marqueeSpeed || '60');
    const dir = parseFloat(el.dataset.marqueeDir || '1');
    let x = 0, boost = 0, half = 0, visible = true;
    const measure = () => { half = track.scrollWidth / 2; };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(track);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(el);
    const off = onScroll((e) => { boost = Math.min(6, Math.abs(e.velocity || 0) * 0.35); });
    const tick = (_t, dt) => {
      if (!visible || !half) return;
      x -= dir * (speed * (1 + boost)) * (dt / 1000);
      boost *= 0.92;
      if (dir > 0 && x <= -half) x += half;
      if (dir < 0 && x >= 0) x -= half;
      track.style.transform = `translate3d(${x}px,0,0)`;
    };
    if (dir < 0) x = -half;
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); ro.disconnect(); io.disconnect(); off(); };
  },
});
