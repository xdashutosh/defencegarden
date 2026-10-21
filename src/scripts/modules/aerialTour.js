// "From the air" (src/components/home/AerialTour.astro): a chapter index driving a framed window.
//   stills mode — each chapter's drone photograph wipes in (the previous one stays underneath until covered) and the
//                 chapters move on every 6.5 s until the visitor picks one, presses pause, or (always) reduced motion.
//   film mode   — the drone film plays (video.js loads / plays it while visible); its time picks the chapter, picking a
//                 chapter seeks the film, and the pause button keeps it paused (data-user-paused).
// The open chapter's hairline fills as it plays; the big outlined number and the caption swap with it. Tabs follow the
// WAI-ARIA tabs pattern (arrow keys / Home / End). Nothing runs while the section is off screen.
import { register } from '../core/page.js';
import { reduced } from '../core/gsap.js';

const STEP = 6500;

register({
  name: 'aerial-tour',
  selector: '[data-atr]',
  init(root) {
    const tabs = [...root.querySelectorAll('[data-atr-tab]')];
    if (!tabs.length) return;
    const panels = [...root.querySelectorAll('[data-atr-panel]')];
    const shots = [...root.querySelectorAll('[data-atr-shot]')];
    const index = root.querySelector('[role="tablist"]');
    const toggle = root.querySelector('[data-atr-toggle]');
    const cap = root.querySelector('[data-atr-cap]'), capBox = cap?.parentElement;
    const big = root.querySelector('[data-atr-big]');
    const saveData = navigator.connection && navigator.connection.saveData;
    const video = !reduced() && !saveData ? root.querySelector('video') : null;
    const film = Boolean(video && root.dataset.atrMode === 'film');
    if (!film) root.dataset.atrMode = 'stills';
    const chapters = tabs.map((t) => ({ start: parseFloat(t.dataset.start) || 0, end: parseFloat(t.dataset.end) || 0 }));
    const names = panels.map((p) => p.querySelector('.atr__go')?.textContent.replace(/^Explore\s+/, '').trim() || '');
    let active = 0, auto = !film && !reduced(), held = false, onScreen = false, raf = 0, since = 0, swapT = 0, leaveT = 0;

    const setP = (i, p) => tabs[i].style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4));
    const keepInView = (tab) => {
      if (index.scrollWidth <= index.clientWidth + 2) return; // only the phone chip row scrolls sideways
      index.scrollTo({ left: Math.max(0, tab.offsetLeft - parseFloat(getComputedStyle(index).paddingLeft || '0')), behavior: reduced() ? 'auto' : 'smooth' });
    };

    function show(i, { fromFilm = false } = {}) {
      if (i === active) { if (!fromFilm && film) seek(i); return; }
      const prev = active;
      active = i;
      tabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (!film) setP(k, 0); });
      panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
      // wipe: the new shot uncovers from the right over the previous one, which leaves once covered
      shots.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-leaving', k === prev); });
      clearTimeout(leaveT);
      leaveT = setTimeout(() => shots[prev]?.classList.remove('is-leaving'), 1300);
      clearTimeout(swapT);
      big?.classList.add('is-out'); capBox?.classList.add('is-out');
      swapT = setTimeout(() => {
        if (big) big.textContent = tabs[i].querySelector('.atr__n')?.textContent || '';
        if (cap) cap.textContent = `${names[i]} · Shamli`;
        big?.classList.remove('is-out'); capBox?.classList.remove('is-out');
      }, 280);
      keepInView(tabs[i]);
      since = performance.now();
      if (!fromFilm && film) seek(i);
    }
    function seek(i) {
      const t = chapters[i].start + 0.05;
      if (Math.abs(video.currentTime - t) > 0.3) video.currentTime = t;
      if (!held && video.paused && video.getAttribute('src')) video.play().catch(() => {});
    }
    const chapterAt = (t) => { for (let k = chapters.length - 1; k >= 0; k--) if (t >= chapters[k].start - 0.01) return k; return 0; };

    function frame() {
      raf = 0;
      if (!onScreen || document.hidden) return;
      if (film) {
        const t = video.currentTime, k = chapterAt(t);
        if (k !== active) show(k, { fromFilm: true });
        chapters.forEach((c, j) => setP(j, j === k ? (t - c.start) / Math.max(0.1, c.end - c.start) : 0));
        if (!video.paused) raf = requestAnimationFrame(frame);
      } else if (auto && !held) {
        const p = (performance.now() - since) / STEP;
        setP(active, p);
        if (p >= 1) show((active + 1) % tabs.length);
        raf = requestAnimationFrame(frame);
      }
    }
    const kick = () => { if (!raf && onScreen) raf = requestAnimationFrame(frame); };
    const takeOver = () => { if (auto) { auto = false; tabs.forEach((_, k) => setP(k, 0)); syncToggle(); } };

    const onClick = (e) => { const t = e.target.closest('[data-atr-tab]'); if (!t) return; takeOver(); show(+t.dataset.atrTab); kick(); };
    const onKey = (e) => {
      const i = tabs.indexOf(document.activeElement); if (i < 0) return;
      const n = tabs.length;
      const to = { ArrowDown: (i + 1) % n, ArrowRight: (i + 1) % n, ArrowUp: (i - 1 + n) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault(); takeOver(); tabs[to].focus({ preventScroll: true }); show(to); kick();
    };
    index.addEventListener('click', onClick); index.addEventListener('keydown', onKey);

    // play / pause (hidden when nothing can play)
    const syncToggle = () => {
      if (!toggle) return;
      const playing = film ? !held : auto && !held;
      toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      const ico = toggle.querySelector('.atr__ico');
      ico?.classList.toggle('atr__ico--pause', playing); ico?.classList.toggle('atr__ico--play', !playing);
      root.toggleAttribute('data-atr-held', !playing);
    };
    const onToggle = () => {
      if (film) {
        held = !held;
        if (held) { video.dataset.userPaused = ''; video.pause(); } else { delete video.dataset.userPaused; video.play().catch(() => {}); }
      } else if (auto) { held = !held; if (!held) since = performance.now() - (parseFloat(tabs[active].style.getPropertyValue('--p')) || 0) * STEP; }
      else { auto = true; held = false; since = performance.now(); } // stills the visitor had taken over: play again
      syncToggle(); kick();
    };
    if (toggle) { if (!film && reduced()) toggle.closest('.atr__badge')?.setAttribute('hidden', ''); else toggle.addEventListener('click', onToggle); }
    syncToggle();

    const onPlay = () => kick();
    if (film) { video.addEventListener('play', onPlay); video.addEventListener('seeked', onPlay); }
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) { since = performance.now() - (parseFloat(tabs[active].style.getPropertyValue('--p')) || 0) * STEP; kick(); }
    }, { threshold: 0.2 });
    io.observe(root);
    const onVis = () => { if (!document.hidden) { since = performance.now() - (parseFloat(tabs[active].style.getPropertyValue('--p')) || 0) * STEP; kick(); } };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      io.disconnect(); cancelAnimationFrame(raf); clearTimeout(swapT); clearTimeout(leaveT);
      index.removeEventListener('click', onClick); index.removeEventListener('keydown', onKey);
      toggle?.removeEventListener('click', onToggle); document.removeEventListener('visibilitychange', onVis);
      if (film) { video.removeEventListener('play', onPlay); video.removeEventListener('seeked', onPlay); }
    };
  },
});
