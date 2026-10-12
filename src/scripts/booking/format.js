// Small formatting helpers shared by the plot map, tracker, verifier and PDF receipt (en-IN conventions).

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
export { num };

/** 150000 → '₹1,50,000' (up to 2 decimals). null/invalid → '—'. */
export function inr(v) {
  const n = num(v);
  return n == null ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** 1000 → '1,000.00' (PDF receipt). */
export function inr2(v) {
  const n = num(v) ?? 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const toDate = (v) => {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** '2026-01-01' → '1 Jan 2026'. */
export function dateShort(v, fallback = '—') {
  const d = toDate(v);
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : fallback;
}

/** '2026-01-01' → '01 January 2026'. */
export function dateLong(v, fallback = '—') {
  const d = toDate(v);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : fallback;
}

/** now → '12 Oct 2026, 09:28 am'. */
export function dateTime(v = new Date()) {
  const d = toDate(v) || new Date();
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

/** 24 h 'HH:MM' (status line). */
export function hm(v = new Date()) {
  const d = toDate(v) || new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Plot size facts from a backend row: dimensions '30*60' and area_sqft '1800.00'. */
export function plotSize(row) {
  if (!row) return { dims: null, area: null, areaSqm: null };
  let dims = null;
  if (row.dimensions && String(row.dimensions).trim()) {
    const raw = String(row.dimensions).trim();
    const m = raw.match(/^(\d+(?:\.\d+)?)\s*[*x×X]\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const a = num(row.area_sqft);
      const product = parseFloat(m[1]) * parseFloat(m[2]);
      // Only call it feet when the backend's own square-foot area confirms it.
      const feet = a != null && Math.abs(product - a) / a < 0.01;
      dims = `${m[1]} × ${m[2]}${feet ? ' ft' : ''}`;
    } else dims = raw;
  }
  const a = num(row.area_sqft);
  const sqm = num(row.area_sqm);
  return {
    dims,
    area: a ? `${a.toLocaleString('en-IN', { maximumFractionDigits: 2 })} sq ft` : null,
    areaSqm: sqm ? `${sqm.toLocaleString('en-IN', { maximumFractionDigits: 2 })} m²` : null,
  };
}

/** Create an element with text (never innerHTML for API data). */
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}
