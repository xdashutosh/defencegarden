// =============================================================================
// Receipt verifier /verify-receipt?token=… (functional spec §6) — printed QR codes point here, so the path
// and the `token` parameter must never change. Mounted on [data-verify-receipt] by modules/plotmap.js.
// Read-only: GET /payments/verify-receipt?token=…  API strings are rendered with textContent only.
// =============================================================================
import { getJSON, apiBase } from './api.js';
import { dateLong, dateTime } from './format.js';

const TYPES = {
  FRM: { title: 'Farmer Payment Receipt', prefix: 'FPR', party: 'Paid To (Farmer)', dir: 'OUT' },
  VND: { title: 'Vendor Payment Receipt', prefix: 'VPR', party: 'Paid To (Vendor)', dir: 'OUT' },
  PLT: { title: 'Plot Payment Receipt', prefix: 'PLT', party: 'Received From', dir: 'IN' },
  CMN: { title: 'Commission Receipt', prefix: 'CMN', party: 'Paid To (Agent)', dir: 'OUT' },
  EXP: { title: 'Expense / Voucher Receipt', prefix: 'EXP', party: 'Paid To / Received From', dir: 'OUT' },
  DBK: { title: 'DayBook Transaction Receipt', prefix: 'DBK', party: 'Party', dir: 'OUT' },
  IMP: { title: 'Imprest Receipt', prefix: 'IMP', party: 'Paid To', dir: 'OUT' },
  NOC: { title: 'Registry NOC Certificate', prefix: 'NOC', party: 'Issued To (Purchaser)', dir: 'IN' },
};

/** Compact receipt payload (t, i, fn|pn, …) → readable record. */
export function mapReceipt(a = {}) {
  return {
    type: a.t || 'FRM',
    id: a.i ?? a.id,
    party_name: a.fn ?? a.pn ?? a.farmer_name ?? null,
    party_label: a.pl || null,
    amount: a.a ?? a.amount,
    direction: a.dr || null,
    date: a.d ?? a.date,
    payment_mode: a.pm ?? a.payment_mode,
    site_name: a.sn ?? a.site_name,
    site_city: a.sy ?? a.site_city,
    site_state: a.ss ?? a.site_state,
    reference: a.rf || null,
  };
}

export function receiptNo(r, t = TYPES[r.type] || TYPES.FRM) {
  return typeof r.id === 'string' && r.id.includes('_') ? r.id.toUpperCase() : `${t.prefix}-${String(r.id ?? '').padStart(4, '0')}`;
}

export function mount(root) {
  const q = (s) => root.querySelector(s);
  const set = (s, v) => { const n = q(s); if (n) n.textContent = v == null || v === '' ? '—' : String(v); };
  const API = apiBase(root);
  const ac = new AbortController();
  let slowTimer = 0;

  const show = (name) => {
    root.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== name; });
    root.dataset.state = name;
  };

  function invalid(message, { retry = false } = {}) {
    set('[data-vr-msg]', message);
    const r = q('[data-vr-retry]');
    if (r) r.hidden = !retry;
    show('invalid');
  }

  function valid(r) {
    const t = TYPES[r.type] || TYPES.FRM;
    const no = receiptNo(r, t);
    set('[data-vr-type]', t.title);
    set('[data-vr-no]', no);
    set('[data-vr-amount-label]', (r.direction || t.dir) === 'IN' ? 'Amount Received' : 'Amount Paid');
    const amt = parseFloat(r.amount || 0);
    set('[data-vr-amount]', (Number.isFinite(amt) ? amt : 0).toLocaleString('en-IN', { minimumFractionDigits: 0 }));
    set('[data-vr-site]', r.site_name || '—');
    const addr = [r.site_city, r.site_state].filter(Boolean).join(', ');
    const addrEl = q('[data-vr-address]');
    if (addrEl) { addrEl.textContent = addr; addrEl.hidden = !addr; }
    set('[data-vr-party-label]', r.party_label || t.party);
    set('[data-vr-party]', r.party_name || '—');
    set('[data-vr-date]', dateLong(r.date));
    set('[data-vr-mode]', r.payment_mode ? String(r.payment_mode).toUpperCase() : '—');
    set('[data-vr-id]', no);
    const refRow = q('[data-vr-ref-row]');
    if (refRow) { refRow.hidden = !r.reference; set('[data-vr-ref]', r.reference); }
    set('[data-vr-verified-on]', `Verified on ${dateTime(new Date())}`);
    show('valid');
  }

  async function run() {
    clearTimeout(slowTimer);
    const token = new URLSearchParams(location.search).get('token');
    if (!token) { invalid('No verification token provided.'); return; }
    show('loading');
    const slowEl = q('[data-vr-slow]');
    if (slowEl) slowEl.hidden = true;
    slowTimer = setTimeout(() => { if (slowEl) slowEl.hidden = false; }, 6000);
    try {
      const body = await getJSON(API, '/payments/verify-receipt', { query: { token }, signal: ac.signal });
      if (body.valid && body.receipt) valid(mapReceipt(body.receipt));
      else invalid(body.message || 'This receipt could not be verified.');
    } catch (err) {
      if (ac.signal.aborted) return;
      if (err.kind === 'http' || err.kind === 'parse') invalid((err.body && err.body.message) || 'This receipt could not be verified.');
      else invalid('Unable to reach the verification service. Please try again.', { retry: true });
    } finally {
      clearTimeout(slowTimer);
    }
  }

  const retry = q('[data-vr-retry]');
  const onRetry = () => run();
  retry?.addEventListener('click', onRetry);
  run();
  return () => { ac.abort(); clearTimeout(slowTimer); retry?.removeEventListener('click', onRetry); };
}
