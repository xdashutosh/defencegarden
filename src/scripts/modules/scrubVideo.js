// Scroll-scrubbed video — scroll drives the film's time, so the camera moves only as the visitor scrolls (and
// plays backwards on the way up). Technique adapted from the scroll-world skill's scrub engine:
//  · the clip is fetched as a Blob and played from an object URL — always fully seekable, independent of the
//    host's HTTP range support;
//  · scroll progress → target time, eased toward it every frame (rAF via gsap.ticker);
//  · seeks are coalesced: no new currentTime while the decoder is still `seeking` (fast flicks can't pile up
//    and freeze the frame);
//  · portrait screens load the native 9:16 file (data-src-mobile, lighter and denser in keyframes) — the same
//    `(orientation: portrait)` rule as the poster's <source>, so poster and film always match; rotating swaps it;
//  · the video is primed (muted play→pause) once it has data, and again on the first touch if that was blocked —
//    iOS only paints seeked frames of a video that has played once;
//  · the poster image stays underneath until the first seeked frame has painted (no blank flash);
//  · prefers-reduced-motion: the clip is never loaded, the poster stays.
// Markup: <video data-scrub data-src data-src-mobile muted playsinline preload="none"> inside a scroll root
// [data-scrub-root] (or the closest <section>); progress 'top top' → 'bottom bottom' of the root maps to the
// clip's 0 → duration, optionally restricted with data-scrub-from / data-scrub-to (0..1 of the root).
import { gsap, ScrollTrigger, reduced } from '../core/gsap.js';
import { register } from '../core/page.js';

export const SCRUB_PORTRAIT = '(orientation: portrait)';
const coarse = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
const clamp = (x) => Math.min(1, Math.max(0, x));

register({
  name: 'scrub-video',
  selector: 'video[data-scrub]',
  init(v) {
    if (reduced()) return;
    const root = v.closest('[data-scrub-root]') || v.closest('section') || v.parentElement;
    const from = parseFloat(v.dataset.scrubFrom || '0');
    const to = parseFloat(v.dataset.scrubTo || '1');
    const portrait = matchMedia(SCRUB_PORTRAIT);
    const pick = () => (portrait.matches && v.dataset.srcMobile ? v.dataset.srcMobile : v.dataset.src);
    const eps = coarse() ? 0.02 : 0.008; // coarser seek step on touch devices = fewer decodes
    if (!pick()) return;

    let objectUrl = null, loadedSrc = null, ctrl = null;
    let ready = false, painted = false, primed = false, dead = false, cur = 0, target = 0;
    v.muted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');

    function load() {
      const src = pick();
      if (!src || src === loadedSrc) return;
      loadedSrc = src;
      ctrl?.abort();
      ctrl = new AbortController();
      ready = false; painted = false; primed = false;
      v.classList.remove('is-painted');
      // low priority: the poster and the preloader's images go first
      fetch(src, { signal: ctrl.signal, priority: 'low' })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => {
          if (dead) return;
          const prev = objectUrl;
          objectUrl = URL.createObjectURL(blob);
          v.src = objectUrl;
          v.load();
          if (prev) URL.revokeObjectURL(prev);
        })
        .catch(() => {}); // keep the poster
    }

    function seekTo(p, force) {
      const t = Math.min(0.999, Math.max(0, p)) * (v.duration || 1);
      if (force || Math.abs(v.currentTime - t) > eps) { try { v.currentTime = t; } catch (e) {} }
    }
    const prime = () => {
      if (primed || !ready) return;
      try {
        const p = v.play();
        if (p && p.then) p.then(() => { primed = true; try { v.pause(); } catch (e) {} seekTo(cur, true); }).catch(() => {});
      } catch (e) {}
    };
    const onMeta = () => { ready = true; try { v.pause(); } catch (e) {} cur = target; seekTo(cur, true); };
    const onData = () => prime(); // muted inline play is allowed without a gesture (not in iOS Low Power Mode)
    const onSeeked = () => { if (!painted) { painted = true; v.classList.add('is-painted'); } };
    const onGesture = () => { prime(); };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('loadeddata', onData);
    v.addEventListener('seeked', onSeeked);
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('touchstart', onGesture, { passive: true });
    portrait.addEventListener('change', load);

    const progress = (self) => { target = clamp((self.progress - from) / Math.max(0.0001, to - from)); };
    const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: progress, onRefresh: progress });

    const tick = () => {
      if (!ready || v.seeking) return; // coalesce seeks
      const d = target - cur;
      cur = Math.abs(d) < 0.0004 ? target : cur + d * 0.16;
      seekTo(cur);
    };
    gsap.ticker.add(tick);
    load();

    return () => {
      dead = true;
      ctrl?.abort();
      gsap.ticker.remove(tick);
      st.kill();
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('loadeddata', onData);
      v.removeEventListener('seeked', onSeeked);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('touchstart', onGesture);
      portrait.removeEventListener('change', load);
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  },
});
