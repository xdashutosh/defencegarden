// <video data-video data-src> — loads and plays only while visible; loops between data-start/data-end if given.
// Reduced motion / Save-Data: never plays (poster stays).
import { register } from '../core/page.js';
import { reduced } from '../core/gsap.js';

register({
  name: 'video',
  selector: 'video[data-video]',
  init(v) {
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduced() || saveData) return;
    const start = parseFloat(v.dataset.start || '0'), end = parseFloat(v.dataset.end || '0');
    const load = () => { if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.load(); if (start) v.currentTime = start; } };
    const onTime = () => { if (end && v.currentTime >= end) v.currentTime = start || 0; };
    const onEnded = () => { v.currentTime = start || 0; v.play().catch(() => {}); };
    v.addEventListener('timeupdate', onTime); v.addEventListener('ended', onEnded);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { load(); v.play().catch(() => {}); } else v.pause();
    }, { rootMargin: '200px 0px' });
    io.observe(v);
    return () => { io.disconnect(); v.pause(); v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnded); };
  },
});
