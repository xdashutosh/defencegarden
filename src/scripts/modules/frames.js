// Photo frames (global.css "Photo frames"): a frame's lines draw in when it enters the viewport, an offset outline
// with data-drift moves at its own pace while scrolling (the photo and its frame separate in depth), and [data-tilt]
// leans toward the pointer with a soft sheen (fine pointers only). Reduced motion: lines shown, nothing moves.
import { gsap, ScrollTrigger, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

register({
  name: 'frame',
  selector: '.frame',
  init(fr) {
    if (reduced()) { fr.classList.add('is-drawn'); return; }
    const st = ScrollTrigger.create({ trigger: fr, start: 'top 88%', once: true, onEnter: () => fr.classList.add('is-drawn') });
    const line = fr.querySelector(':scope > .frame__line[data-drift]');
    if (line) {
      const d = parseFloat(line.dataset.drift || '40');
      gsap.fromTo(line, { y: d }, { y: -d * 0.5, ease: 'none', scrollTrigger: { trigger: fr, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    return () => st.kill();
  },
});

register({
  name: 'tilt',
  selector: '[data-tilt]',
  init(el) {
    if (reduced() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const max = parseFloat(el.dataset.tilt || '6');
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 2 * max);
      rx(-(y - 0.5) * 2 * max);
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    const leave = () => { rx(0); ry(0); };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  },
});
