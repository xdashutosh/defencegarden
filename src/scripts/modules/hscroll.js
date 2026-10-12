// [data-hscroll] (tall section) > [data-hscroll-sticky] (100vh, sticky) > [data-hscroll-track] (wide flex row).
// Desktop: vertical scroll drives the track horizontally (section height is set from the track width).
// Mobile / reduced motion: the track becomes a native horizontal scroller.
import { gsap, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

register({
  name: 'hscroll',
  selector: '[data-hscroll]',
  init(sec) {
    const track = sec.querySelector('[data-hscroll-track]');
    const bar = sec.querySelector('[data-hscroll-bar]');
    if (!track) return;
    const mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 861px) and (prefers-reduced-motion: no-preference)' }, () => {
      sec.classList.add('is-pinned');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const setH = () => { sec.style.height = `${dist() + window.innerHeight}px`; };
      setH();
      const tw = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', end: () => `+=${dist()}`, scrub: 0.6, invalidateOnRefresh: true, onRefreshInit: setH,
          onUpdate: (self) => { if (bar) bar.style.transform = `scaleX(${self.progress})`; } },
      });
      return () => { tw.scrollTrigger?.kill(); tw.kill(); sec.style.height = ''; sec.classList.remove('is-pinned'); gsap.set(track, { clearProps: 'transform' }); };
    });
    return () => mm.revert();
  },
});
