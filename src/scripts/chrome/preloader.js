// Every full load of the home page: a faithful rebuild of realevate.agency's opening (timings/eases from its source):
//   t = 0          counter enters (yPercent 100 → 0, 0.85 s power4.out) showing 27
//   t = i × 0.5    frame i opens from its centre: clip inset(50%) → inset(0) + image scale 1.5 → 1 (1.5 s power4.out);
//                  counter rolls to 42 / 68 / 92 (odometer digits, 0.6 s expo.out)
//   t = R = 2.0    final frame (the hero film's first frame on a full-screen layer) opens the same way; counter → 99
//                  and rolls out (0.95 s power3.in)
//   t = A = R+0.5  navy wipes off bottom-to-top (clip, 1.2 s, cubic-bezier .73,.15,.15,.99); page intro starts
//   t = A+0.1      the final frame glides onto the hero frame (0.8 s power2.inOut); header and dock drop in
// Resolves when the page may play its intro (at A).
import { gsap, CustomEase } from '../core/gsap.js';
import { stopScroll, startScroll } from '../core/scroll.js';

const T = { imageDelay: 0.5, reveal: 1.5, counterEnter: 0.85, counterTick: 0.6, counterExit: 0.95, exitRevealDelay: 0.5, wipe: 1.2, morphDelay: 0.1, morph: 0.8 };
const STEPS = [27, 42, 68, 92, 99];

const rectInset = (r) => `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`;

function loaded(imgs, timeout = 6000) {
  return Promise.race([
    Promise.all([...imgs].map((im) => (im.complete && im.naturalWidth ? Promise.resolve() : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })))),
    new Promise((r) => setTimeout(r, timeout)),
  ]);
}

export function runPreloader() {
  const el = document.querySelector('[data-preloader]');
  const html = document.documentElement;
  if (!el || !html.classList.contains('pre-run')) { el?.remove(); html.classList.remove('pre-run'); return Promise.resolve(); }
  stopScroll();

  const bg = el.querySelector('[data-pre-bg]');
  const box = el.querySelector('[data-pre-frames]');
  const frames = [...el.querySelectorAll('[data-pre-frame]')];
  const final = el.querySelector('[data-pre-final]');
  const finalImg = final.querySelector('img');
  const digits = el.querySelector('[data-pre-digits]');
  const mask = el.querySelector('[data-pre-mask]');
  const tens = el.querySelector('[data-pre-tens]');
  const ones = el.querySelector('[data-pre-ones]');
  const heroMedia = document.querySelector('[data-frame-hero] [data-fh-media]');
  const probe = document.querySelector('[data-frame-hero] [data-fh-probe]');
  const hdr = document.querySelector('.hdr__bar');
  const dock = document.querySelector('[data-dock]');
  const wipeEase = CustomEase.create('dgWipe', '0.73,0.15,0.15,0.99');

  const setCount = (v, animate = true) => {
    const t = Math.floor(Math.min(99, v) / 10), o = Math.min(99, v) % 10;
    gsap.to(tens, { yPercent: -10 * t, duration: animate ? T.counterTick : 0, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(ones, { yPercent: -10 * o, duration: animate ? T.counterTick : 0, ease: 'expo.out', overwrite: 'auto' });
  };

  if (heroMedia) gsap.set(heroMedia, { autoAlpha: 0 });
  setCount(STEPS[0], false);

  return new Promise((resolve) => {
    loaded([frames[0]?.querySelector('img'), finalImg].filter(Boolean)).then(() => {
      const square = box.getBoundingClientRect();
      const R = frames.length * T.imageDelay, A = R + T.exitRevealDelay, K = A + T.morphDelay;
      const tl = gsap.timeline({
        onComplete: () => {
          if (heroMedia) gsap.set(heroMedia, { autoAlpha: 1 });
          el.remove();
          html.classList.remove('pre-run');
          startScroll();
        },
      });
      tl.fromTo(digits, { y: 0, yPercent: 100 }, { y: 0, yPercent: 0, duration: T.counterEnter, ease: 'power4.out' }, 0);
      frames.forEach((f, i) => {
        const at = i * T.imageDelay;
        tl.fromTo(f, { clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: T.reveal, ease: 'power4.out' }, at)
          .fromTo(f.querySelector('img'), { scale: 1.5 }, { scale: 1, duration: T.reveal, ease: 'power4.out' }, at);
        if (i > 0) tl.call(() => setCount(STEPS[Math.min(i, STEPS.length - 1)]), null, at);
      });
      // final frame: full-screen layer clipped to the square, opening from its centre like the others, then gliding
      // onto the hero frame. The glide starts while the opening is still easing out, so both drive ONE clip rect
      // (two clipPath tweens would fight: the opening, which ends later, snapped the frame back to the square).
      const clip = { open: 0, glide: 0 };
      let target = null;
      const drawFinal = () => {
        const hw = (square.width / 2) * clip.open, hh = (square.height / 2) * clip.open;
        const cx = square.left + square.width / 2, cy = square.top + square.height / 2;
        let l = cx - hw, t = cy - hh, r = cx + hw, b = cy + hh;
        if (target && clip.glide > 0) {
          const g = clip.glide;
          l += (target.left - l) * g; t += (target.top - t) * g; r += (target.right - r) * g; b += (target.bottom - b) * g;
        }
        final.style.clipPath = rectInset({ left: l, top: t, right: r, bottom: b }); // explicit 4 values, see below
      };
      tl.fromTo(clip, { open: 0 }, { open: 1, duration: T.reveal, ease: 'power4.out', onUpdate: drawFinal }, R)
        .fromTo(finalImg, { scale: 1.3 * 1.5 }, { scale: 1.3, duration: T.reveal, ease: 'power4.out' }, R)
        .call(() => setCount(STEPS[STEPS.length - 1]), null, R)
        .to(digits, { yPercent: -100, duration: T.counterExit, ease: 'power3.in' }, R)
        .fromTo(mask, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(100% 0% 0% 0%)', duration: T.counterExit, ease: 'power3.in' }, R)
        // exit: navy wipes away bottom-to-top, page intro starts, frame glides onto the hero frame
        .fromTo(bg, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: T.wipe, ease: wipeEase, immediateRender: false }, A)
        .call(() => resolve(), null, A)
        .set(box, { autoAlpha: 0 }, K);
      // glide: blends the (still opening) square toward the hero frame's rect, read when the glide starts
      if (probe) {
        tl.fromTo(clip, { glide: 0 }, {
          glide: 1, duration: T.morph, ease: 'power2.inOut', immediateRender: false,
          onStart: () => { target = probe.getBoundingClientRect(); }, onUpdate: drawFinal,
        }, K);
      }
      if (hdr) tl.fromTo(hdr, { yPercent: -120, visibility: 'visible' }, { yPercent: 0, duration: 1, ease: 'power3.out', clearProps: 'transform' }, A + 0.45);
      if (dock) tl.fromTo(dock, { y: 30, autoAlpha: 0, visibility: 'visible' }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }, A + 0.5);
    });
  });
}
