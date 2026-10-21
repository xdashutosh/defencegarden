// <video data-video data-src> — loads and plays only while visible (data-eager: loads at once); loops between
// data-start/data-end if given. File choice by the element's box: data-src-portrait (9:16 crop) when the box is
// portrait, data-src-small when the box needs ≤ 1280 device pixels across, else data-src. The choice waits until the
// element has a box (none while display:none / 0×0) and is made again when the screen turns (orientation change, as
// in src/scripts/chrome/sky.js): a different file is swapped in at the same time and play state.
// Reduced motion / Save-Data: never loads or plays (poster stays).
import { register } from '../core/page.js';
import { reduced } from '../core/gsap.js';

function pick(v) {
  const d = v.dataset;
  if (d.srcPortrait && v.clientHeight > v.clientWidth) return d.srcPortrait;
  if (d.srcSmall && v.clientWidth * (window.devicePixelRatio || 1) <= 1280) return d.srcSmall;
  return d.src;
}

register({
  name: 'video',
  selector: 'video[data-video]',
  init(v) {
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduced() || saveData) return;
    const start = parseFloat(v.dataset.start || '0'), end = parseFloat(v.dataset.end || '0');
    const sized = () => v.clientWidth > 0 && v.clientHeight > 0;
    const play = () => { if (v.getAttribute('src') && !('userPaused' in v.dataset)) v.play().catch(() => {}); }; // a viewer's pause (data-user-paused, set by players such as aerialTour.js) is kept
    let wanted = false, near = false;
    // a load asked for before the element has a box is retried by the ResizeObserver once it has one
    const ro = new ResizeObserver(() => { if (wanted) { load(); if (near) play(); } });
    const load = () => {
      wanted = true;
      if (v.getAttribute('src') || !v.dataset.src || !sized()) return;
      ro.disconnect();
      v.src = pick(v); v.load(); if (start) v.currentTime = start;
    };
    ro.observe(v);
    const portrait = matchMedia('(orientation: portrait)');
    const turn = () => {
      const cur = v.getAttribute('src'), next = cur && sized() ? pick(v) : cur;
      if (next === cur) return;
      const t = v.currentTime, playing = !v.paused;
      v.src = next; v.load(); v.currentTime = t;
      if (playing) play();
    };
    portrait.addEventListener('change', turn);
    const onTime = () => { if (end && v.currentTime >= end) v.currentTime = start || 0; };
    const onEnded = () => { v.currentTime = start || 0; v.play().catch(() => {}); };
    v.addEventListener('timeupdate', onTime); v.addEventListener('ended', onEnded);
    if (v.dataset.eager !== undefined) load();
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting;
      if (near) { load(); play(); } else v.pause();
    }, { rootMargin: '200px 0px' });
    io.observe(v);
    return () => {
      io.disconnect(); ro.disconnect(); portrait.removeEventListener('change', turn); v.pause();
      v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnded);
    };
  },
});
