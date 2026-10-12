// =============================================================================
// Plot map controller (functional spec §3) — loaded lazily by src/scripts/modules/plotmap.js for every
// [data-plotmap] section (src/components/booking/BookingMap.astro). The SVG is server-rendered; this file
// only reads the DOM + the read-only plot-status endpoint. No booking/payment POST exists on this site:
// "booking" is an enquiry (data-enquire → WhatsApp modal).
//
// mount(root) → destroy()   (Barba-safe: aborts the fetch, removes every listener, kills tweens)
// =============================================================================
import { gsap, reduced } from '../core/gsap.js';
import { getJSON, apiBase } from './api.js';
import { buildIndex, lookup, normStatus, searchKey, STATUS_LABEL } from './plots.js';
import { createViewport } from './viewport.js';
import { hm, plotSize, el as make } from './format.js';

const REFRESH_AFTER = 5 * 60 * 1000;
const SLOW_AFTER = 6000;
const MIN_PLOT_PX = 22;     // below this a tap zooms in first (mobile tap rule, §3.10)
const TARGET_PLOT_PX = 48;  // …to this on-screen size

export function mount(root) {
  const q = (s) => root.querySelector(s);
  const vpEl = q('[data-pm-viewport]');
  const svg = vpEl?.querySelector('svg');
  const layer = svg?.querySelector('.pm-plots');
  if (!vpEl || !svg || !layer) return () => {};

  const ds = root.dataset;
  const API = apiBase(root);
  const colony = ds.colony || '';
  const title = ds.title || colony;
  const endpoint = ds.endpoint || '/colony-maps/public/site-plots/1';
  const box = (ds.box || svg.getAttribute('viewBox') || '0 0 1460 1370').split(/[\s,]+/).map(Number);

  const tip = q('[data-pm-tip]');
  const hint = q('[data-pm-hint]');
  const statusEl = q('[data-pm-status]');
  const liveEl = q('[data-pm-live]');
  const note = q('[data-pm-note]');
  const panel = q('[data-pm-panel]');
  const card = q('[data-pm-card]');
  const empty = q('[data-pm-empty]');
  const searchForm = q('[data-pm-search]');
  const searchInput = searchForm?.querySelector('input');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobileMq = matchMedia('(max-width: 860px)');

  const ac = new AbortController();     // aborts the fetch + all listeners on destroy
  const sig = ac.signal;
  const on = (t, type, fn, opts) => t?.addEventListener(type, fn, { ...(opts || {}), signal: sig });
  const ctx = gsap.context(() => {}, root);
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  // ------------------------------------------------------------------ plots
  const plots = [...layer.querySelectorAll('.pm-plot[data-plot-id]')];
  const groupsById = new Map();
  for (const g of plots) {
    const id = g.dataset.plotId;
    if (!groupsById.has(id)) groupsById.set(id, []);
    groupsById.get(id).push(g);
  }
  const ids = [...groupsById.keys()];
  const labelOf = (g) => g.querySelector('.pm-plot__label')?.textContent?.trim() || g.dataset.plotId;
  const bboxCache = new Map();
  const bbox = (g) => {
    let b = bboxCache.get(g);
    if (!b) { const r = g.getBBox(); b = { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; bboxCache.set(g, b); }
    return b;
  };

  // ------------------------------------------------------------------ viewport
  let hintTimer = 0;
  const showHint = (text, ms = 1600) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = later(() => hint.classList.remove('is-on'), ms);
  };
  const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent);
  let wheelHintAt = 0;
  const vp = createViewport(vpEl, svg, {
    box, min: 1, max: 8,
    onChange: ({ s }) => {
      svg.dataset.zoomLevel = s < 2.5 ? 'far' : 'near';
      root.dataset.zoomed = s > 1.01 ? 'true' : 'false';
    },
    onPlainWheel: () => {
      const now = performance.now();
      if (now - wheelHintAt < 4000) return;
      wheelHintAt = now;
      showHint(isMac ? 'Hold ⌘ and scroll to zoom the map' : 'Hold Ctrl and scroll to zoom the map', 1800);
    },
  });
  let firstTouch = true;
  if (!finePointer && hint) { hint.textContent = 'Tap to zoom · pinch to explore'; hint.classList.add('is-on'); }
  const dismissTouchHint = () => { if (firstTouch && !finePointer) { firstTouch = false; hint?.classList.remove('is-on'); } };

  // ------------------------------------------------------------------ live status
  let live = 'loading';   // 'loading' | 'live' | 'offline'
  let index = null;
  let loadedAt = 0;
  let fetchCtrl = null;
  let selected = null;
  let focused = null;

  const statusOf = (id) => {
    if (live === 'loading') return { st: 'loading', row: null, raw: null };
    if (live !== 'live') return { st: 'unknown', row: null, raw: null };
    const row = lookup(index, id);
    const raw = row?.status || 'AVAILABLE';
    return { st: normStatus(raw), row, raw: String(raw).toUpperCase() };
  };

  function paint() {
    const counts = { available: 0, reserved: 0, sold: 0 };
    for (const [id, groups] of groupsById) {
      const { st } = statusOf(id);
      if (st in counts) counts[st]++;
      const word = st === 'loading' || st === 'unknown' ? '' : `, ${STATUS_LABEL[st].toLowerCase()}`;
      for (const g of groups) {
        g.dataset.status = st;
        g.setAttribute('aria-label', `Plot ${id}${word}`);
        let hatch = g.querySelector('.pm-plot__hatch');
        if (st === 'reserved' && !hatch) {
          const shape = g.querySelector('.pm-plot__shape');
          hatch = shape.cloneNode(false);
          hatch.setAttribute('class', 'pm-plot__hatch');
          hatch.setAttribute('aria-hidden', 'true');
          shape.after(hatch);
        } else if (st !== 'reserved' && hatch) hatch.remove();
      }
    }
    root.querySelectorAll('[data-pm-count]').forEach((n) => {
      n.textContent = live === 'live' ? String(counts[n.dataset.pmCount] ?? 0) : '—';
    });
    return counts;
  }

  function setLive(state, text) {
    live = state;
    root.dataset.live = state;
    if (liveEl) liveEl.textContent = text;
    if (note) note.hidden = state !== 'offline';
  }
  const announce = (text) => { if (statusEl) statusEl.textContent = text; };

  async function load() {
    fetchCtrl?.abort();
    const ctrl = (fetchCtrl = new AbortController());
    const stop = () => ctrl.abort();
    sig.addEventListener('abort', stop, { once: true });
    if (live !== 'live') { setLive('loading', 'Checking live availability…'); paint(); }
    const slow = later(() => { if (live === 'loading') setLive('loading', 'Waking up the booking service…'); }, SLOW_AFTER);
    try {
      const body = await getJSON(API, endpoint, { query: colony ? { colony_name: colony } : undefined, signal: ctrl.signal });
      if (body.success === false || !Array.isArray(body.plots)) throw new Error('bad payload');
      index = buildIndex(body.plots, colony);
      loadedAt = Date.now();
      setLive('live', `Live · updated ${hm()}`);
      const c = paint();
      announce(`Live availability loaded: ${c.available} available, ${c.reserved} reserved, ${c.sold} sold.`);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      index = null;
      setLive('offline', 'Live availability is being connected — enquire for the latest status');
      paint();
      announce('Live availability is being connected — enquire for the latest status.');
    } finally {
      clearTimeout(slow); timers.delete(slow);
      sig.removeEventListener('abort', stop);
      if (selected) renderCard();
    }
  }

  // ------------------------------------------------------------------ panel
  const enquireBtn = card?.querySelector('[data-pm-card-enquire]');
  const enquireLabel = card?.querySelector('[data-pm-card-enquire-label]');

  function renderCard() {
    if (!card) return;
    if (!selected) {
      card.hidden = true;
      if (empty) empty.hidden = false;
      root.dataset.selected = 'false';
      return;
    }
    const id = selected;
    const { st, row, raw } = statusOf(id);
    card.querySelector('[data-pm-card-id]').textContent = id;
    const pill = card.querySelector('[data-pm-card-pill]');
    pill.dataset.state = st;
    pill.textContent = st === 'unavailable' ? (raw || 'Unavailable') : STATUS_LABEL[st];

    const facts = card.querySelector('[data-pm-card-facts]');
    facts.replaceChildren();
    const size = plotSize(row);
    const add = (k, v) => { if (!v) return; const d = make('div', 'pm-fact'); d.append(make('dt', 'eyebrow', k), make('dd', null, v)); facts.append(d); };
    add('Dimensions', size.dims);
    add('Area', size.area && size.areaSqm ? `${size.area} · ${size.areaSqm}` : size.area || size.areaSqm);
    add('Facing', row?.facing);
    facts.hidden = !facts.children.length;

    const noteEl = card.querySelector('[data-pm-card-note]');
    let text = '';
    if (st === 'unknown') text = 'Live availability is being connected — enquire for the latest status.';
    else if (st === 'loading') text = 'Checking the live status of this plot…';
    else if (st === 'available') text = facts.hidden ? 'Size and price on request — our sales team will share the details.' : '';
    else text = 'Please choose another available plot on the map.';
    noteEl.textContent = text;
    noteEl.hidden = !text;

    if (enquireBtn) {
      enquireBtn.dataset.colony = `${title} · Plot ${id}`;
      enquireBtn.dataset.plot = id;
      if (enquireLabel) enquireLabel.textContent = `Enquire about plot ${id}`;
    }
    card.hidden = false;
    if (empty) empty.hidden = true;
    root.dataset.selected = 'true';
  }

  function select(id, { pan = true } = {}) {
    if (selected === id) { if (pan) reveal(id); return; }
    if (selected) groupsById.get(selected)?.forEach((g) => g.classList.remove('is-selected'));
    selected = id;
    if (id) groupsById.get(id)?.forEach((g) => g.classList.add('is-selected'));
    renderCard();
    if (id && card && !reduced()) {
      ctx.add(() => gsap.fromTo(card, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'dgOut', overwrite: true, clearProps: 'transform,opacity,visibility' }));
    }
    if (id && pan) requestAnimationFrame(() => reveal(id));
  }

  function clearSelection({ restoreFocus = false } = {}) {
    const prev = selected;
    select(null, { pan: false });
    vp.setInset(0);
    if (restoreFocus && prev) groupsById.get(prev)?.[0]?.focus({ preventScroll: true });
  }

  /** Bottom area of the viewport hidden by the mobile sheet (px). */
  const sheetInset = () => {
    if (!mobileMq.matches || !card || card.hidden) return 0;
    return Math.min(vpEl.clientHeight * 0.7, card.offsetHeight + 10);
  };

  /** Pan (minimal move) so every shape of the plot is visible, above the mobile sheet. */
  function reveal(id, { zoom = false } = {}) {
    const g = groupsById.get(id)?.[0];
    if (!g) return;
    const b = bbox(g);
    const inset = sheetInset();
    vp.setInset(inset, { duration: 0 });
    const st = vp.state();
    let S = st.s;
    if (zoom) S = Math.min(5, st.max, Math.max(st.s, (0.25 * st.ew) / (st.k0 * Math.max(b.w, 1))));
    const k = st.k0 * S;
    const vw = st.ew / k, vh = (st.eh - inset) / k;
    const m = 0.1;
    let { cx, cy } = st;
    if (zoom || S !== st.s) { cx = b.cx; cy = b.cy + inset / (2 * k); }
    else {
      const x0 = cx - st.ew / (2 * k), y0 = cy - st.eh / (2 * k);
      if (b.x < x0 + vw * m) cx -= x0 + vw * m - b.x;
      else if (b.x + b.w > x0 + vw * (1 - m)) cx += b.x + b.w - (x0 + vw * (1 - m));
      if (b.y < y0 + vh * m) cy -= y0 + vh * m - b.y;
      else if (b.y + b.h > y0 + vh * (1 - m)) cy += b.y + b.h - (y0 + vh * (1 - m));
    }
    if (cx !== st.cx || cy !== st.cy || S !== st.s) vp.to({ s: S, cx, cy }, { duration: zoom ? 0.9 : 0.5, ease: zoom ? 'dgInOut' : 'dgOut' });
  }

  // ------------------------------------------------------------------ pointer: hover tooltip + click
  const plotFromEvent = (e) => e.target?.closest?.('.pm-plot[data-plot-id]');
  let tipX = null, tipY = null;
  const tipText = (id) => {
    const { st, row, raw } = statusOf(id);
    const parts = [id, st === 'unavailable' ? raw : STATUS_LABEL[st]];
    const size = plotSize(row);
    if (size.dims) parts.push(size.dims);
    return parts.join(' · ');
  };
  if (tip && finePointer) {
    tipX = gsap.quickTo(tip, 'x', { duration: 0.3, ease: 'dgOut' });
    tipY = gsap.quickTo(tip, 'y', { duration: 0.3, ease: 'dgOut' });
    on(layer, 'pointerover', (e) => {
      const g = plotFromEvent(e);
      if (!g || e.pointerType !== 'mouse') return;
      tip.textContent = tipText(g.dataset.plotId);
      tip.hidden = false;
      tip.classList.add('is-on');
    });
    on(layer, 'pointerout', (e) => {
      const to = e.relatedTarget?.closest?.('.pm-plot');
      if (!to) tip.classList.remove('is-on');
    });
    on(vpEl, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = vpEl.getBoundingClientRect();
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      if (x + w > r.width - 8) x = e.clientX - r.left - w - 14;
      if (y + h > r.height - 8) y = e.clientY - r.top - h - 14;
      tipX(x); tipY(y);
    });
    on(vpEl, 'pointerleave', () => tip.classList.remove('is-on'));
    on(vpEl, 'pointerdown', () => tip.classList.remove('is-on'));
  }

  on(vpEl, 'click', (e) => {
    if (vp.moved) return;
    dismissTouchHint();
    const g = plotFromEvent(e);
    const st = vp.state();
    // Tap rule: on touch, a tap at a scale where plots are tiny zooms in (centred on the tap) first.
    if (vp.pointerType !== 'mouse' && st.k * 40 < MIN_PLOT_PX) {
      const r = vpEl.getBoundingClientRect();
      const [ux, uy] = vp.toSvg(e.clientX - r.left, e.clientY - r.top);
      vp.to({ s: TARGET_PLOT_PX / (st.k0 * 40), cx: ux, cy: uy }, { duration: 0.8, ease: 'dgInOut' });
      return;
    }
    if (g) select(g.dataset.plotId);
  });

  // ------------------------------------------------------------------ keyboard
  const centreOf = (g) => bbox(g);
  function nearest(from, dir) {
    const a = centreOf(from);
    const [dx, dy] = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[dir];
    let best = null, score = Infinity;
    for (const g of plots) {
      if (g === from) continue;
      const b = centreOf(g);
      const vx = b.cx - a.cx, vy = b.cy - a.cy;
      const along = vx * dx + vy * dy;
      if (along <= 1) continue;
      const across = Math.abs(vx * dy - vy * dx);
      if (across > along) continue; // ±45° cone
      const sc = along + across * 2;
      if (sc < score) { score = sc; best = g; }
    }
    return best;
  }
  function plotNearCentre() {
    const st = vp.state();
    let best = null, d = Infinity;
    for (const g of plots) { const b = centreOf(g); const dd = Math.hypot(b.cx - st.cx, b.cy - st.cy); if (dd < d) { d = dd; best = g; } }
    return best;
  }
  function focusPlot(g) {
    if (!g) return;
    if (focused && focused !== g) focused.classList.remove('is-focus');
    focused = g;
    g.classList.add('is-focus');
    g.focus({ preventScroll: true });
    reveal(g.dataset.plotId);
  }
  on(layer, 'focusout', (e) => { if (e.target === focused && !layer.contains(e.relatedTarget)) focused.classList.remove('is-focus'); });

  on(vpEl, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === '+' || k === '=' || k === '-' || k === '_') {
      e.preventDefault();
      const f = k === '+' || k === '=' ? 1.6 : 1 / 1.6;
      // zoom about the focused (or selected) plot so it stays in view
      const g = document.activeElement?.closest?.('.pm-plot') || (selected && groupsById.get(selected)?.[0]);
      if (g && layer.contains(g)) {
        const b = bbox(g), st = vp.state();
        vp.zoomAt((b.cx - st.cx) * st.k + st.ew / 2, (b.cy - st.cy) * st.k + st.eh / 2, st.s * f, { duration: 0.45 });
      } else vp.zoomBy(f, { duration: 0.45 });
      return;
    }
    if (k === '0') { e.preventDefault(); vp.fit(); return; }
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (e.shiftKey) {
        const d = 80;
        vp.panBy(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0);
        return;
      }
      const cur = document.activeElement?.closest?.('.pm-plot');
      focusPlot(cur && layer.contains(cur) ? nearest(cur, k) || cur : (selected && groupsById.get(selected)?.[0]) || plotNearCentre());
      return;
    }
    if (k === 'Enter' || k === ' ') {
      const cur = document.activeElement?.closest?.('.pm-plot');
      if (cur && layer.contains(cur)) { e.preventDefault(); select(cur.dataset.plotId); }
      return;
    }
    if (k === 'Escape' && selected) { e.preventDefault(); clearSelection({ restoreFocus: true }); }
  });
  on(card, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); clearSelection({ restoreFocus: true }); } });

  // ------------------------------------------------------------------ controls
  root.querySelectorAll('[data-pm-zoom]').forEach((b) => on(b, 'click', () => {
    dismissTouchHint();
    const z = b.dataset.pmZoom;
    if (z === 'in') vp.zoomBy(1.6, { duration: 0.5 });
    else if (z === 'out') vp.zoomBy(1 / 1.6, { duration: 0.5 });
    else vp.fit();
  }));
  root.querySelectorAll('[data-pm-close]').forEach((b) => on(b, 'click', () => clearSelection({ restoreFocus: false })));
  root.querySelectorAll('[data-pm-retry]').forEach((b) => on(b, 'click', () => load()));

  // Search: exact id/label match first, then the first plot that starts with the query.
  const keys = plots.map((g) => ({ id: g.dataset.plotId, keys: [searchKey(g.dataset.plotId), searchKey(labelOf(g))] }));
  function find(qs) {
    const k = searchKey(qs);
    if (!k) return null;
    const exact = keys.find((p) => p.keys.includes(k));
    if (exact) return exact.id;
    const starts = keys.filter((p) => p.keys.some((x) => x.startsWith(k)));
    starts.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    return starts[0]?.id || null;
  }
  function runSearch() {
    const qs = searchInput?.value || '';
    if (!qs.trim()) return;
    const id = find(qs);
    if (!id) {
      announce(`No plot ${qs.trim().toUpperCase()} on this map.`);
      searchForm?.classList.add('is-miss');
      later(() => searchForm?.classList.remove('is-miss'), 1600);
      const msg = searchForm?.querySelector('[data-pm-search-msg]');
      if (msg) { msg.textContent = `No plot ${qs.trim().toUpperCase()} on this map`; msg.hidden = false; later(() => { msg.hidden = true; }, 2600); }
      return;
    }
    dismissTouchHint();
    select(id, { pan: false });
    requestAnimationFrame(() => reveal(id, { zoom: true }));
    if (focused) focused.classList.remove('is-focus');
    focused = groupsById.get(id)[0];
    announce(`Plot ${id} selected.`);
  }
  on(searchForm, 'submit', (e) => { e.preventDefault(); runSearch(); searchInput?.blur(); });
  // picking a datalist suggestion fires 'input' with inputType 'insertReplacementText' (or none)
  on(searchInput, 'input', (e) => { if ((!e.inputType || e.inputType === 'insertReplacementText') && searchInput.value) runSearch(); });

  // Enquiry modal prefill: the global modal only preselects a colony whose option text matches exactly.
  // When "<title> · Plot X" has no option, fall back to the colony option + a short message naming the plot.
  on(enquireBtn, 'click', () => {
    const id = enquireBtn.dataset.plot;
    const tries = { n: 0 };
    const fill = () => {
      const form = document.querySelector('[data-enquiry-form]');
      const modal = document.querySelector('[data-enquiry]');
      if (!form || !modal) return;
      if (modal.hidden) { if (++tries.n < 20) later(fill, 30); return; }
      const sel = form.elements.colony;
      const want = enquireBtn.dataset.colony;
      if (sel && sel.selectedOptions?.[0]?.text !== want) {
        const opt = [...sel.options].find((o) => o.text === title);
        if (opt) sel.value = opt.value;
        const msg = form.elements.message;
        if (msg && (!msg.value.trim() || msg.dataset.pmPrefill === msg.value)) {
          msg.value = `I'm interested in Plot ${id} at ${title}.`;
          msg.dataset.pmPrefill = msg.value;
        }
      }
    };
    later(fill, 0);
  });

  // ------------------------------------------------------------------ lifecycle
  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible' && live === 'live' && Date.now() - loadedAt > REFRESH_AFTER) load();
  });

  // first time the map enters the viewport: soft plot reveal (no motion with reduced-motion)
  let io = null;
  if (!reduced() && 'IntersectionObserver' in window) {
    const shapes = plots.map((g) => g.querySelector('.pm-plot__shape')).filter(Boolean);
    ctx.add(() => gsap.set(shapes, { opacity: 0.25 }));
    io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect(); io = null;
      ctx.add(() => gsap.to(shapes, { opacity: 1, duration: 0.9, ease: 'dgOut', stagger: { amount: 0.8, from: 'random' }, clearProps: 'opacity' }));
    }, { threshold: 0.15 });
    io.observe(vpEl);
  }

  paint();
  load();
  root.classList.add('is-ready');

  return function destroy() {
    ac.abort();
    fetchCtrl?.abort();
    io?.disconnect();
    timers.forEach(clearTimeout); timers.clear();
    vp.destroy();
    ctx.revert();
    root.classList.remove('is-ready');
  };
}
