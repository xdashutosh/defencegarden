// =============================================================================
// viewBox pan / zoom controller for the inline plot-map SVG (functional spec §3.10).
//
// State { s, cx, cy }: zoom factor s ∈ [min, max] relative to "fit" and the view centre in SVG units.
// The viewBox always has the element's aspect ratio, so 1 SVG unit = k px with k = k0·s (k0 = fit scale);
// the vector stays crisp at every zoom level. The view is clamped to the content box.
//
// Input: pointer drag (mouse always, touch only when zoomed in), two-finger pinch, ctrl/⌘ + wheel
// (trackpad pinch) about the pointer, double-click. Plain wheel is never hijacked — onPlainWheel() lets the
// map show a hint instead. touch-action is 'pan-y' at fit (the page still scrolls) and 'none' when zoomed.
// =============================================================================
import { gsap, reduced } from '../core/gsap.js';

export function createViewport(el, svg, { box, min = 1, max = 8, onChange, onPlainWheel } = {}) {
  const [bx, by, bw, bh] = box;
  let s = 1, cx = bx + bw / 2, cy = by + bh / 2;
  let ew = el.clientWidth || 1, eh = el.clientHeight || 1;
  let tween = null;
  let moved = false;          // last gesture moved (suppresses the click that follows a drag)
  let lastPointerType = 'mouse';

  const clampS = (v) => Math.min(max, Math.max(min, v));
  const k0 = () => Math.min(ew / bw, eh / bh);
  const k = () => k0() * s;

  let insetBottom = 0;       // px hidden by an overlay at the bottom (mobile plot sheet): the view may scroll past the content by that much
  function clampCentre(S, X, Y) {
    const kk = k0() * S, vw = ew / kk, vh = eh / kk, ib = insetBottom / kk;
    const x = vw >= bw ? bx + bw / 2 : Math.min(Math.max(X, bx + vw / 2), bx + bw - vw / 2);
    const y = vh - ib >= bh ? by + bh / 2 + ib / 2 : Math.min(Math.max(Y, by + vh / 2), by + bh - vh / 2 + ib);
    return [x, y];
  }

  function apply() {
    [cx, cy] = clampCentre(s, cx, cy);
    const kk = k(), vw = ew / kk, vh = eh / kk;
    svg.setAttribute('viewBox', `${(cx - vw / 2).toFixed(2)} ${(cy - vh / 2).toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
    el.style.touchAction = s > min + 0.01 ? 'none' : 'pan-y';
    el.classList.toggle('is-zoomed', s > min + 0.01);
    onChange?.(state());
  }

  const state = () => ({ s, cx, cy, k: k(), k0: k0(), ew, eh, min, max });

  /** Animate (or jump) to { s, cx, cy } (any subset). */
  function to(target, { duration = 0.6, ease = 'dgOut' } = {}) {
    tween?.kill(); tween = null;
    const S = clampS(target.s ?? s);
    const [X, Y] = clampCentre(S, target.cx ?? cx, target.cy ?? cy);
    if (!duration || reduced()) { s = S; cx = X; cy = Y; apply(); return; }
    const st = { s, cx, cy };
    tween = gsap.to(st, {
      s: S, cx: X, cy: Y, duration, ease, overwrite: true,
      onUpdate: () => { s = st.s; cx = st.cx; cy = st.cy; apply(); },
      onComplete: () => { tween = null; },
    });
  }

  /** Element px (relative to el) → SVG units. */
  function toSvg(px, py) {
    const kk = k();
    return [cx - ew / (2 * kk) + px / kk, cy - eh / (2 * kk) + py / kk];
  }
  /** Zoom to S keeping the SVG point under element px (px, py) fixed. */
  function zoomAt(px, py, S, opts) {
    S = clampS(S);
    const [ux, uy] = toSvg(px, py);
    const k2 = k0() * S;
    to({ s: S, cx: ux - px / k2 + ew / (2 * k2), cy: uy - py / k2 + eh / (2 * k2) }, opts);
  }
  const local = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // ---------------------------------------------------------------- pointers
  const pts = new Map();
  let drag = null, pinch = null;

  function startPinch() {
    const [a, b] = [...pts.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const [ux, uy] = toSvg(mx, my);
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, ux, uy };
  }

  function onDown(e) {
    lastPointerType = e.pointerType || 'mouse';
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const [x, y] = local(e);
    pts.set(e.pointerId, { x, y });
    if (pts.size === 1) {
      moved = false;
      drag = { id: e.pointerId, x, y, cx, cy, active: false };
    } else if (pts.size === 2) {
      tween?.kill(); tween = null;
      drag = null; moved = true;
      try { for (const id of pts.keys()) el.setPointerCapture(id); } catch {}
      startPinch();
    }
  }

  function onMove(e) {
    const p = pts.get(e.pointerId);
    if (!p) return;
    [p.x, p.y] = local(e);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      s = clampS(pinch.s0 * (d / pinch.d0));
      const kk = k();
      cx = pinch.ux - mx / kk + ew / (2 * kk);
      cy = pinch.uy - my / kk + eh / (2 * kk);
      apply();
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = p.x - drag.x, dy = p.y - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 6) return;
      // at fit, a one-finger touch drag belongs to the page scroll
      if (e.pointerType !== 'mouse' && s <= min + 0.01) { drag = null; return; }
      drag.active = true; moved = true;
      tween?.kill(); tween = null;
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('is-dragging');
    }
    const kk = k();
    cx = drag.cx - dx / kk;
    cy = drag.cy - dy / kk;
    apply();
  }

  function onUp(e) {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1 && moved) {
      // one finger left after a pinch: continue as a pan from here
      const [id, p] = [...pts.entries()][0];
      drag = { id, x: p.x, y: p.y, cx, cy, active: true };
    } else if (!pts.size) {
      drag = null;
      el.classList.remove('is-dragging');
    }
  }

  function onWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation(); // keep Lenis from also scrolling the page on ⌘ + wheel
      const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0022;
      const [x, y] = local(e);
      zoomAt(x, y, s * Math.exp(-e.deltaY * unit), { duration: 0 });
    } else onPlainWheel?.(e);
  }

  function onDbl(e) {
    if (lastPointerType !== 'mouse') return;
    const [x, y] = local(e);
    if (s >= max / 2) to({ s: min }, { duration: 0.8, ease: 'dgInOut' });
    else zoomAt(x, y, s * 2, { duration: 0.6 });
  }

  const ro = new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || (w === ew && h === eh)) return;
    ew = w; eh = h; apply();
  });

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('lostpointercapture', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('dblclick', onDbl);
  ro.observe(el);
  apply();

  return {
    state,
    to,
    zoomAt,
    toSvg,
    zoomBy(f, opts) { zoomAt(ew / 2, eh / 2, s * f, opts); },
    fit(opts = { duration: 0.8, ease: 'dgInOut' }) { to({ s: min, cx: bx + bw / 2, cy: by + bh / 2 }, opts); },
    panBy(dxPx, dyPx, opts = { duration: 0.35 }) { const kk = k(); to({ cx: cx + dxPx / kk, cy: cy + dyPx / kk }, opts); },
    /** Bottom overlay height in px (0 = none). Re-clamps with a short tween. */
    setInset(px = 0, opts = { duration: 0.45 }) {
      px = Math.max(0, Math.min(eh * 0.8, px || 0));
      if (Math.abs(px - insetBottom) < 1) return;
      insetBottom = px;
      to({}, opts);
    },
    get moved() { return moved; },
    get pointerType() { return lastPointerType; },
    destroy() {
      tween?.kill();
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDbl);
    },
  };
}
