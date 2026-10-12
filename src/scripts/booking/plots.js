// Plot-status lookup (functional spec §3.5). The backend returns rows for EVERY colony of site 1 unless asked
// with colony_name, so rows are also filtered by row.colony_name (fixes the old River Green cross-colony bug).

const norm = (s) => String(s ?? '').replace(/[()]/g, '').trim().toUpperCase();
const dashless = (s) => s.replace(/[.\-]/g, '');
const dashed = (s) => s.replace(/^([A-Z]{1,2})(\d)/, '$1-$2');

/** rows → Map(normalised plot number → row), keeping only rows of `colonyName`. */
export function buildIndex(rows, colonyName) {
  const idx = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.plot_number) continue;
    if (r.colony_name && colonyName && r.colony_name !== colonyName) continue;
    const n = norm(r.plot_number);
    for (const k of [n, dashless(n), dashed(n)]) if (!idx.has(k)) idx.set(k, r);
  }
  return idx;
}

/** Row for a map plot id ('C-12', 'B-29b' …) or null (= not in the database → available). */
export function lookup(idx, id) {
  if (!idx) return null;
  const r = norm(id);
  return idx.get(r) || idx.get(dashless(r)) || idx.get(dashed(r)) || null;
}

/** Raw backend status → 'available' | 'reserved' | 'sold' | 'unavailable'. */
export function normStatus(raw) {
  const s = String(raw || 'AVAILABLE').trim().toUpperCase();
  if (s === 'AVAILABLE') return 'available';
  if (s === 'SOLD') return 'sold';
  if (s === 'RESERVED' || s === 'BOOKED') return 'reserved';
  return 'unavailable';
}

export const STATUS_LABEL = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  unavailable: 'Unavailable',
  unknown: 'Status on request',
  loading: 'Checking status',
};

/** Normalise what the user types in the plot search: ' c12 ' → 'C12'. */
export const searchKey = (s) => dashless(norm(s)).replace(/\s+/g, '');
