// [data-reveal="lines"] — masked line rise (SplitText). [data-reveal="fade"|"clip"] — class toggles (CSS transitions).
// Add data-reveal-intro to play once the page intro is released (above-the-fold), else on scroll (once).
// data-reveal-delay="0.2" adds a delay.
import { gsap, SplitText, ScrollTrigger, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';
import { whenIntro } from '../core/intro.js';

register({
  name: 'reveal-lines',
  selector: '[data-reveal="lines"]',
  init(el) {
    if (reduced()) { el.classList.add('is-split', 'is-in'); return; }
    const delay = parseFloat(el.dataset.revealDelay || '0');
    const intro = el.hasAttribute('data-reveal-intro');
    let split;
    const run = () => {
      split = SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'rl-line', autoSplit: true,
        onSplit(self) {
          el.classList.add('is-split');
          const tw = gsap.from(self.lines, { yPercent: 108, duration: 1.25, stagger: 0.09, delay, ease: 'dgOut', paused: true });
          if (intro) whenIntro().then(() => tw.play());
          else ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tw.play() });
          return tw;
        },
      });
    };
    document.fonts.ready.then(run);
    return () => split?.revert();
  },
});

register({
  name: 'reveal-class',
  selector: '[data-reveal="fade"], [data-reveal="clip"]',
  init(el) {
    if (reduced()) { el.classList.add('is-in'); return; }
    const delay = parseFloat(el.dataset.revealDelay || '0');
    if (delay) el.style.transitionDelay = `${delay}s`;
    if (el.hasAttribute('data-reveal-intro')) { whenIntro().then(() => requestAnimationFrame(() => el.classList.add('is-in'))); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  },
});
