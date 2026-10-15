// Real-sky band (src/components/chrome/Sky.astro). Base.astro renders it first in <main>; here it moves into the
// page's first section, behind that section's content (the host becomes an isolated stacking context and the sky
// sits at z-index -1, so text, images and the hero frame all paint above the clouds). Dark first sections get the
// moonlit treatment (.sky--dark). The looping time-lapse loads after the intro (preloader) and plays only while
// the band is on screen; phones in portrait load the lighter portrait crop. Reduced motion keeps the still frame.
import { reduced } from '../core/gsap.js';
import { register } from '../core/page.js';
import { whenIntro } from '../core/intro.js';

const portrait = () => matchMedia('(orientation: portrait)').matches;

register({
  name: 'sky',
  selector: '[data-sky]',
  init(sky) {
    let host = sky.nextElementSibling;
    while (host && (host.tagName === 'SCRIPT' || host.tagName === 'STYLE' || !host.offsetHeight)) host = host.nextElementSibling;
    if (!host) return;
    host.prepend(sky);
    host.classList.add('has-sky');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (host.dataset.headerTone === 'dark') sky.classList.add('sky--dark');
    requestAnimationFrame(() => sky.classList.add('is-on'));
    if (reduced()) return;

    const v = sky.querySelector('video');
    let started = false, visible = true, dead = false;
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const onPlaying = () => v.classList.add('is-playing');
    const start = () => {
      if (dead || started) return;
      started = true;
      v.src = portrait() && v.dataset.srcMobile ? v.dataset.srcMobile : v.dataset.src;
      v.addEventListener('playing', onPlaying, { once: true });
      if (visible) play();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!started) return;
      if (visible) play(); else v.pause();
    });
    io.observe(sky);
    // after the preloader / page intro, when the main thread is idle
    whenIntro().then(() => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(start, { timeout: 1500 }));

    return () => {
      dead = true;
      io.disconnect();
      v.removeEventListener('playing', onPlaying);
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    };
  },
});
