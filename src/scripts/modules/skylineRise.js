// "From colonies to skylines" scene (src/components/home/SkylineRise.astro). While the stage is pinned, scroll plays a
// staged entrance (scrubbed, so it reverses on the way back up):
//   1. the palms spring up from below with a bounce and an elastic wobble, then keep swaying in the wind;
//   2. the homes rise one after another and settle;
//   3. the buildings rise behind the homes: the far towers, then the towers under construction;
//   4. a slow camera push to finish (homes come closer, palms part).
// Story beats [data-skyline-beat] fade in at their data-at fraction and out where the next one starts. The wind runs
// on the palm images (so it composes with the scroll transforms on the layers) and only while the scene is on
// screen. On desktop the pointer adds a gentle depth parallax on each layer's inner box (data-depth).
// Reduced motion: nothing runs; CSS shows the finished scene.
import { gsap, ScrollTrigger, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

register({
  name: 'skyline-rise',
  selector: '[data-skyline]', // (not data-rise: parallax.js already uses that for its own effect)
  init(sec) {
    if (reduced()) return;
    const q = (s) => sec.querySelector(s);
    const far = q('.rise__far'), build = q('.rise__build');
    const homes = [q('.rise__villa'), q('.rise__contemporary'), q('.rise__modern')].filter(Boolean);
    const palms = [q('.rise__palm-l'), q('.rise__palm-r')].filter(Boolean);
    const beats = [...sec.querySelectorAll('[data-skyline-beat]')];
    const vw = (v) => () => (innerWidth * v) / 100;
    const vh = (v) => () => (innerHeight * v) / 100;

    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true } });
    tl.to({}, { duration: 1 }, 0); // timeline length = 1 = the whole section

    // 1. palms: spring up from below the frame (bounce), the trunk wobbling as it lands
    palms.forEach((p, i) => {
      const side = i ? 1 : -1, at = 0.02 + i * 0.05;
      tl.fromTo(p, { x: vw(10 * side), y: vh(80), scale: 0.8 }, { x: 0, y: 0, scale: 1, duration: 0.2, ease: 'back.out(2.2)' }, at);
      tl.fromTo(p, { rotation: 9 * side }, { rotation: 0, duration: 0.24, ease: 'elastic.out(1, 0.45)' }, at);
    });

    // 2. homes: rise one after another and settle
    homes.forEach((h, i) => {
      tl.fromTo(h, { y: vh(52), autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.15, ease: 'back.out(1.35)' }, 0.2 + i * 0.07);
    });

    // 3. buildings: rise behind the homes
    if (far) tl.fromTo(far, { y: vh(46), autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, 0.46);
    if (build) tl.fromTo(build, { y: vh(80), scale: 0.95 }, { y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.15)' }, 0.53);

    // 4. a slow camera push to finish
    tl.to(homes, { scale: 1.04, duration: 0.13, ease: 'none' }, 0.87);
    palms.forEach((p, i) => tl.to(p, { x: vw(i ? 4 : -4), scale: 1.07, duration: 0.13, ease: 'none' }, 0.87));

    // story beats
    beats.forEach((b, i) => {
      const a = parseFloat(b.dataset.at || '0'), z = i < beats.length - 1 ? parseFloat(beats[i + 1].dataset.at) : 1.01;
      tl.fromTo(b, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, a);
      if (z <= 1) tl.to(b, { autoAlpha: 0, y: -14, duration: 0.06, ease: 'power2.in' }, z - 0.07);
    });

    // wind: a slow sway with the odd gust, bending from the base of each palm image
    const wind = palms.map((p, i) => {
      const img = p.querySelector('img');
      if (!img) return null;
      gsap.set(img, { transformOrigin: '50% 100%' });
      const dir = i ? -1 : 1, period = i ? 2.7 : 3.2;
      return gsap.timeline({ repeat: -1, paused: true, defaults: { ease: 'sine.inOut' } })
        .to(img, { rotation: 1.6 * dir, skewX: -1.1 * dir, duration: period })
        .to(img, { rotation: -1.1 * dir, skewX: 0.8 * dir, duration: period })
        .to(img, { rotation: 2.6 * dir, skewX: -1.8 * dir, duration: period * 0.7, ease: 'power1.inOut' }) // gust
        .to(img, { rotation: 0, skewX: 0, duration: period * 1.3 });
    }).filter(Boolean);
    const onScreen = ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: (s) => wind.forEach((w) => (s.isActive ? w.play() : w.pause())) });
    if (onScreen.isActive) wind.forEach((w) => w.play());

    // pointer depth parallax on the inner boxes (fine pointers only), so it never fights the scroll transforms
    let off = null;
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const movers = [...sec.querySelectorAll('[data-layer]')].map((l) => {
        const inner = l.firstElementChild || l;
        return { d: parseFloat(l.dataset.depth || '0.5'), x: gsap.quickTo(inner, 'x', { duration: 1.4, ease: 'power3.out' }), y: gsap.quickTo(inner, 'y', { duration: 1.4, ease: 'power3.out' }) };
      });
      const onMove = (e) => {
        const kx = (e.clientX / innerWidth - 0.5) * 2, ky = (e.clientY / innerHeight - 0.5) * 2;
        movers.forEach((m) => { m.x(-kx * 26 * m.d); m.y(-ky * 10 * m.d); });
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      off = () => window.removeEventListener('pointermove', onMove);
    }
    return () => { off?.(); onScreen.kill(); wind.forEach((w) => w.kill()); };
  },
});
