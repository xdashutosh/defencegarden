// Realevate-style hero: a giant marquee line with a small framed image/video in it; on scroll the frame expands to
// full screen (era.estate full-bleed), then an overlay title rises.
// Markup inside <section data-frame-hero> (tall section, sticky inner):
//   [data-fh-probe]   invisible box at the frame's place/size (CSS --fh-w/--fh-h/--fh-y) — the single source of geometry
//   [data-fh-media]   full-screen media layer clipped to the probe rect (contains <img>/<video>), [data-fh-shade] inside
//   [data-fh-ui]      wrapper faded out on scroll; [data-fh-line] marquee words, [data-fh-sub], [data-fh-note], [data-fh-fade]
//   [data-fh-overlay] title shown once the frame is full screen
//   [data-fh-beat="a,b"] (instead of the overlay) story beats over a scroll-scrubbed film, each visible between
//                     fractions a and b of the section's scroll; [data-fh-expand] = fraction used to grow the frame
//   [data-fh-inner]   optional wrapper scaled 1.3 → 1 (poster + scrubbed <video>, see scrubVideo.js)
// First visit: the preloader (src/scripts/chrome/preloader.js) morphs its last image onto the probe rect and hands
// over, so the intro here does not reopen the frame. Barba arrivals open the frame from its centre instead.
import { gsap, ScrollTrigger, SplitText, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';
import { whenIntro } from '../core/intro.js';
import { lockTone, unlockTone } from './headerTone.js';

/** clip-path inset() that shows only `probe`'s rectangle of `media` */
export function probeInset(media, probe) {
  const m = media.getBoundingClientRect();
  const p = probe.getBoundingClientRect();
  return `inset(${p.top - m.top}px ${m.right - p.right}px ${m.bottom - p.bottom}px ${p.left - m.left}px)`;
}

register({
  name: 'frame-hero',
  selector: '[data-frame-hero]',
  init(sec) {
    const media = sec.querySelector('[data-fh-media]');
    const probe = sec.querySelector('[data-fh-probe]');
    const inner = media?.querySelector('[data-fh-inner]') || media?.querySelector('img, video');
    const beats = [...sec.querySelectorAll('[data-fh-beat]')];
    const exp = Math.min(1, Math.max(0.05, parseFloat(sec.dataset.fhExpand || '1') || 1));
    const shade = sec.querySelector('[data-fh-shade]');
    const ui = sec.querySelector('[data-fh-ui]');
    const overlay = sec.querySelector('[data-fh-overlay]');
    const lines = sec.querySelectorAll('[data-fh-line]');
    const sub = sec.querySelector('[data-fh-sub]');
    const note = sec.querySelector('[data-fh-note] span');
    const fade = sec.querySelectorAll('[data-fh-fade]');
    if (!media || !probe) return;
    const frameInset = () => probeInset(media, probe);

    if (reduced()) { gsap.set(media, { clipPath: frameInset() }); return; }

    const handedOver = document.documentElement.classList.contains('pre-run') && sec === document.querySelector('[data-frame-hero]');

    // scroll: frame → full screen, shade + overlay in, UI out
    // header colours follow the film's actual top edge (it lags the scroll by the scrub, so a fixed zone flipped too
    // early going down and too late going up): dark/ivory once the film covers the logo's mid-line. The static zone
    // stays for reduced motion only.
    const zone = sec.querySelector('.fh__zone');
    zone?.removeAttribute('data-header-tone');
    let covered = null;
    const syncHeader = () => {
      // only while the hero spans the header line (scrub catch-up can still render after a jump past it)
      const r = sec.getBoundingClientRect();
      if (r.top > 46 || r.bottom <= 46) { if (covered !== null) { covered = null; unlockTone(); } return; }
      const m = (media.style.clipPath || '').match(/inset\(\s*(-?[\d.]+)px/);
      const top = m ? parseFloat(m[1]) : Infinity;
      const hb = document.querySelector('.hdr__bar');
      const now = top <= (hb ? hb.offsetHeight : 80) * 0.55;
      if (now === covered) return;
      covered = now;
      if (now) lockTone('dark', 'media');
      else unlockTone();
    };

    const tl = gsap.timeline({
      onUpdate: syncHeader,
      scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true },
      defaults: { ease: 'none' },
    });
    // timeline length is 1 = the whole section; the frame grows over the first `exp` of it
    tl.to({}, { duration: 1 }, 0);
    tl.fromTo(media, { clipPath: () => frameInset() }, { clipPath: 'inset(0px 0px 0px 0px)', duration: exp }, 0);
    if (inner) tl.fromTo(inner, { scale: 1.3 }, { scale: 1, duration: exp }, 0);
    if (shade) tl.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.5 * exp }, 0.3 * exp);
    if (ui) tl.fromTo(ui, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 * exp }, 0.05 * exp);
    if (overlay) tl.fromTo(overlay, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 * exp }, 0.7 * exp);
    // story beats: rise in at a, drift out by b (a beat ending at 1 stays up to the end)
    beats.forEach((b) => {
      const [a, z] = (b.dataset.fhBeat || '0,1').split(',').map(Number);
      const span = Math.max(0.04, z - a), io = Math.min(0.07, span * 0.3);
      gsap.set(b, { autoAlpha: 0 });
      tl.fromTo(b, { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: io, ease: 'power2.out' }, a);
      if (z < 0.999) tl.fromTo(b, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -48, duration: io, ease: 'power2.in', immediateRender: false }, z - io);
    });

    // the header-tone module mounts after this one and picks the section's zone tone: re-apply ours next frame
    requestAnimationFrame(() => { covered = null; syncHeader(); });
    // release the lock once the hero has fully left the header (its bottom passes the header line), and re-take it
    // when scrolling back into the hero; past that point the page's own zones decide again
    const release = () => { covered = null; unlockTone(); };
    const lockSt = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom 46px', onLeave: release, onLeaveBack: release, onEnterBack: () => { covered = null; syncHeader(); } });

    // intro (realevate order): marquee rises, subtitle lines unmask, label box draws, small labels fade
    let split = null;
    const intro = gsap.timeline({ paused: true });
    const t0 = handedOver ? 0.55 : 0.35;
    if (!handedOver) {
      // explicit 4-value ends: browsers shorten symmetric inset() values, which breaks string interpolation
      const pointInset = () => {
        const r = frameInset().match(/-?[\d.]+/g).map(Number); // top right bottom left
        const cy = r[0] + (media.clientHeight - r[0] - r[2]) / 2, cx = r[3] + (media.clientWidth - r[1] - r[3]) / 2;
        return `inset(${cy}px ${media.clientWidth - cx}px ${media.clientHeight - cy}px ${cx}px)`;
      };
      intro.fromTo(media, { clipPath: pointInset }, { clipPath: () => frameInset(), duration: 1.5, ease: 'power4.out' }, 0);
    }
    intro.from(lines, { yPercent: 110, duration: 1.2, ease: 'power4.out' }, t0);
    if (note) intro.from(note, { clipPath: 'inset(0 100% 0 0)', duration: 0.9, ease: 'power3.out' }, t0 + 0.55);
    intro.from(fade, { autoAlpha: 0, y: 14, duration: 0.9, stagger: 0.06, ease: 'power3.out' }, t0 + 0.35);
    if (sub) {
      gsap.set(sub, { autoAlpha: 0 });
      document.fonts.ready.then(() => {
        gsap.set(sub, { autoAlpha: 1 });
        if (intro.progress() === 1) return; // intro already fast-forwarded (page restored mid-scroll)
        split = SplitText.create(sub, { type: 'lines', mask: 'lines' });
        intro.from(split.lines, { yPercent: 105, duration: 1, stagger: 0.08, ease: 'power4.out' }, t0 + 0.15);
      });
    }
    whenIntro().then(() => {
      if (window.scrollY > 10) { intro.progress(1); return; }
      document.fonts.ready.then(() => intro.play());
    });
    return () => { intro.kill(); split?.revert(); lockSt.kill(); unlockTone(); };
  },
});
