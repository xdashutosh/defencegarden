// [data-parallax="0.15"] on an image inside an overflow:hidden frame → moves ±amount of its height while in view.
// [data-scale-in] → image scales 1.18 → 1 while entering. [data-rise="80"] → element rises by N px while scrolling past.
import { gsap, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

register({
  name: 'parallax',
  selector: '[data-parallax]',
  init(el) {
    if (reduced()) return;
    const a = parseFloat(el.dataset.parallax || '0.12') * 100;
    gsap.set(el, { scale: 1 + a / 50 });
    gsap.fromTo(el, { yPercent: -a }, { yPercent: a, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  },
});
register({
  name: 'scale-in',
  selector: '[data-scale-in]',
  init(el) {
    if (reduced()) return;
    gsap.fromTo(el, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'top 25%', scrub: true } });
  },
});
register({
  name: 'rise',
  selector: '[data-rise]',
  init(el) {
    if (reduced()) return;
    const d = parseFloat(el.dataset.rise || '80');
    gsap.fromTo(el, { y: d }, { y: -d, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  },
});
