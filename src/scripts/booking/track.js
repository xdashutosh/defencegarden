// =============================================================================
// Booking tracker /booking/track/:id (functional spec §5) — mounted on [data-booking-track] by
// src/scripts/modules/plotmap.js. Read-only: GET /bookings/track/:id. The old screenshot upload (a POST) is
// not offered on this site; customers send payment proof on WhatsApp instead.
// API strings are rendered with textContent only.
// =============================================================================
import { getJSON, apiBase } from './api.js';
import { inr, dateShort, plotSize, el as make, num } from './format.js';

const STATUS = {
  PENDING_APPROVAL: { label: 'Pending Verification', message: 'Your booking is being reviewed by our team.', tone: 'pending' },
  ACTIVE: { label: 'Confirmed & Active', message: 'Your booking has been confirmed!', tone: 'active' },
  COMPLETED: { label: 'Sold', message: 'Your plot purchase is complete.', tone: 'done' },
  CANCELLED: { label: 'Cancelled', message: 'This booking has been cancelled.', tone: 'cancelled' },
  TRANSFERRED: { label: 'Transferred', message: 'Booking is being processed.', tone: 'transferred' },
};
const STEPS = ['PENDING_APPROVAL', 'ACTIVE', 'COMPLETED'];
const SLOW_AFTER = 6000;

/** '/booking/track/abc-123' → 'abc-123' (null when missing/invalid). */
export const bookingIdFrom = (path = location.pathname) => (path.match(/^\/booking\/track\/([A-Za-z0-9_-]+)\/?$/) || [])[1] || null;

function parseShots(v) {
  let list = v;
  if (typeof v === 'string') { try { list = JSON.parse(v); } catch { list = []; } }
  if (!Array.isArray(list)) return [];
  return list.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim())).map((u) => u.trim());
}

export function mount(root) {
  const q = (s) => root.querySelector(s);
  const API = apiBase(root);
  const id = bookingIdFrom();
  const ac = new AbortController();
  const on = (t, type, fn) => t?.addEventListener(type, fn, { signal: ac.signal });
  let slowTimer = 0;
  let booking = null;

  const show = (name) => root.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== name; });
  root.querySelectorAll('[data-trk-id]').forEach((n) => { n.textContent = id || '—'; });

  function notFound(title, msg) {
    q('[data-trk-nf-title]').textContent = title;
    q('[data-trk-nf-msg]').textContent = msg;
    show('notfound');
    root.dataset.state = 'notfound';
  }

  function render(b) {
    booking = b;
    const status = String(b.status || '').toUpperCase();
    const info = STATUS[status] || { label: STATUS.PENDING_APPROVAL.label, message: 'Booking is being processed.', tone: 'pending' };
    q('[data-trk-colony]').textContent = b.colony_name || 'River Green Colony';
    q('[data-trk-plot]').textContent = b.plot_number ? `Plot ${b.plot_number}` : 'Your booking';
    const card = q('[data-trk-status]');
    card.dataset.tone = info.tone;
    q('[data-trk-status-label]').textContent = info.label;
    q('[data-trk-status-msg]').textContent = info.message;

    // 3-step progress: Submitted → Verified → Sold (none done when cancelled / transferred)
    const cur = STEPS.indexOf(status);
    const blocked = status === 'CANCELLED' || status === 'TRANSFERRED';
    STEPS.forEach((s, i) => {
      const step = q(`[data-trk-step="${s}"]`);
      if (!step) return;
      const done = !blocked && cur >= 0 && i <= cur;
      step.classList.toggle('is-done', done);
      step.classList.toggle('is-current', s === status);
      step.setAttribute('aria-current', s === status ? 'step' : 'false');
      const conn = q(`[data-trk-conn="${i}"]`);
      if (conn) conn.classList.toggle('is-filled', done && i + 1 <= cur);
    });
    q('[data-trk-steps]').dataset.blocked = blocked ? 'true' : 'false';

    // details
    const dl = q('[data-trk-details]');
    dl.replaceChildren();
    const row = (label, value, cls) => {
      if (value == null || value === '') return;
      const d = make('div', 'trk-row' + (cls ? ` ${cls}` : ''));
      d.append(make('dt', 'eyebrow', label), make('dd', null, value));
      dl.append(d);
    };
    const gap = () => dl.append(make('div', 'trk-gap'));
    const size = plotSize(b);
    row('Plot', b.plot_number || '—');
    row('Block', b.block);
    row('Colony', b.colony_name || 'River Green Colony');
    row('Area', num(b.area_sqft) ? `${num(b.area_sqft).toLocaleString('en-IN', { maximumFractionDigits: 2 })} sq ft` : null);
    row('Dimensions', size.dims);
    row('Facing', b.facing);
    gap();
    row('Customer', b.client_name || '—');
    row('Phone', b.client_phone || '—');
    gap();
    row('Booking Amount', inr(b.booking_amount ?? 0));
    row('Total Paid', inr(b.total_paid ?? 0));
    row('Transaction ID', b.razorpay_payment_id, 'trk-row--mono');
    row('Payment Date', dateShort(b.payment_date));
    row('Booking Date', dateShort(b.booking_date || b.created_at));

    // payment proof (read-only)
    const shots = parseShots(b.screenshot_urls);
    const grid = q('[data-trk-proof]');
    grid.replaceChildren();
    shots.forEach((u, i) => {
      const a = make('a', 'trk-shot');
      a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const img = make('img');
      img.src = u; img.alt = `Payment screenshot ${i + 1}`; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      a.append(img);
      grid.append(a);
    });
    q('[data-trk-proof-count]').textContent = String(shots.length);
    q('[data-trk-proof-empty]').hidden = shots.length > 0;
    const wa = q('[data-trk-wa]');
    if (wa) {
      const lines = ['*Payment proof — Defence Garden booking*', '', `*Booking ID:* ${id}`];
      if (b.plot_number) lines.push(`*Plot:* ${b.plot_number}`);
      if (b.colony_name) lines.push(`*Colony:* ${b.colony_name}`);
      wa.href = `https://wa.me/${wa.dataset.wa}?text=${encodeURIComponent(lines.join('\n'))}`;
    }

    show('loaded');
    root.dataset.state = 'loaded';
  }

  async function load() {
    clearTimeout(slowTimer);
    if (!id) { notFound('Booking Not Found', 'The booking link is invalid or has expired.'); return; }
    show('loading');
    root.dataset.state = 'loading';
    const slowEl = q('[data-trk-slow]');
    if (slowEl) slowEl.hidden = true;
    slowTimer = setTimeout(() => { if (slowEl) slowEl.hidden = false; }, SLOW_AFTER);
    try {
      const body = await getJSON(API, `/bookings/track/${encodeURIComponent(id)}`, { signal: ac.signal });
      if (body.success === false || !body.booking) { notFound('Booking Not Found', body.message || 'Booking not found'); return; }
      render(body.booking);
    } catch (err) {
      if (ac.signal.aborted) return;
      if (err.kind === 'http') notFound('Booking Not Found', 'Booking not found or invalid link.');
      else { show('unreachable'); root.dataset.state = 'unreachable'; }
    } finally {
      clearTimeout(slowTimer);
    }
  }

  on(q('[data-trk-retry]'), 'click', () => load());
  on(q('[data-trk-print]'), 'click', () => window.print());

  // Signed PDF receipt (§4) — jspdf/qrcode are loaded only on click.
  const rBtn = q('[data-trk-receipt]');
  const rLabel = rBtn?.querySelector('[data-trk-receipt-label]');
  const rErr = q('[data-trk-receipt-error]');
  let busy = false;
  on(rBtn, 'click', async () => {
    if (busy || !id) return;
    busy = true;
    const idle = rLabel?.textContent;
    rBtn.disabled = true;
    if (rLabel) rLabel.textContent = 'Preparing receipt…';
    if (rErr) rErr.hidden = true;
    try {
      const m = await import('./receipt-pdf.js');
      await m.downloadPublicBookingReceipt(id, { api: API, signal: ac.signal, signatoryName: rBtn.dataset.signatory || 'RiverGreen Sales' });
    } catch (err) {
      if (ac.signal.aborted) return;
      if (rErr) {
        rErr.textContent = err?.kind === 'network' || err?.kind === 'timeout'
          ? 'We couldn’t reach the booking service. Please try again.'
          : (err?.message || 'Could not download receipt');
        rErr.hidden = false;
      }
    } finally {
      busy = false;
      rBtn.disabled = false;
      if (rLabel && idle) rLabel.textContent = idle;
    }
  });

  load();
  return () => { ac.abort(); clearTimeout(slowTimer); };
}
