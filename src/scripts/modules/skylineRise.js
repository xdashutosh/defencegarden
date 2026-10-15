// "From colonies to skylines" scene (src/components/home/SkylineRise.astro). While the stage is pinned, scroll drives
// a camera move through the layered cut-outs: foreground trees part sideways and grow, homes settle and come closer,
// the construction and the residential towers rise behind them, the far skyline lifts a little. Each layer carries
// its own start/end values (data-x0/x1 in vw, data-y0/y1 in vh, data-s0/s1 scale). Story beats [data-skyline-beat]
// cross-fade at their data-at fraction. On desktop the pointer adds a gentle depth parallax (data-depth).
// Reduced motion: nothing runs; CSS shows the finished skyline.
import { gsap, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

register({
  name: 'skyline-rise',
  selector: '[data-skyline]', // (not data-rise: parallax.js already uses that for its own effect)
  init(sec) {
    if (reduced()) return;
    const layers = [...sec.querySelectorAll('[data-layer]')];
    const beats = [...sec.querySelectorAll('[data-skyline-beat]')];
    const num = (el, k, d) => (el.dataset[k] != null && el.dataset[k] !== '' ? parseFloat(el.dataset[k]) : d);
    const vw = (v) => () => (innerWidth * v) / 100;
    const vh = (v) => () => (innerHeight * v) / 100;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
      defaults: { ease: 'power1.inOut' },
    });
    tl.to({}, { duration: 1 }, 0); // timeline length = 1 = the whole section
    layers.forEach((l) => {
      tl.fromTo(l,
        { x: vw(num(l, 'x0', 0)), y: vh(num(l, 'y0', 0)), scale: num(l, 's0', 1) },
        { x: vw(num(l, 'x1', 0)), y: vh(num(l, 'y1', 0)), scale: num(l, 's1', 1), duration: 1 }, 0);
    });
    // story beats: each visible from its data-at to the next beat's
    beats.forEach((b, i) => {
      const a = num(b, 'at', i / beats.length), z = i < beats.length - 1 ? num(beats[i + 1], 'at', 1) : 1.01;
      if (i > 0) tl.fromTo(b, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, a);
      if (z <= 1) tl.to(b, { autoAlpha: 0, y: -14, duration: 0.1, ease: 'power2.in' }, z - 0.1);
    });

    // pointer depth parallax on the inner images (fine pointers only), so it never fights the scroll transforms
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const movers = layers.map((l) => {
      const inner = l.firstElementChild || l;
      return { d: num(l, 'depth', 0.5), x: gsap.quickTo(inner, 'x', { duration: 1.4, ease: 'power3.out' }), y: gsap.quickTo(inner, 'y', { duration: 1.4, ease: 'power3.out' }) };
    });
    const onMove = (e) => {
      const kx = (e.clientX / innerWidth - 0.5) * 2, ky = (e.clientY / innerHeight - 0.5) * 2;
      movers.forEach((m) => { m.x(-kx * 26 * m.d); m.y(-ky * 10 * m.d); });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  },
});
