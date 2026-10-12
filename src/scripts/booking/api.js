// =============================================================================
// Read-only client for the RiverGreen sales backend (functional spec §2).
//
// The public website only READS from the backend: plot statuses, booking status, receipt tokens and
// receipt verification. It never sends POST/PUT/PATCH/DELETE (online booking is an enquiry via WhatsApp).
//
// Request rules (§2.3): fetch with credentials 'omit', cache 'no-store' and NO custom headers, so every call
// is a CORS "simple" GET (no preflight). 15 s timeout, one retry after 2 s on network errors only.
// Errors are normalised to ApiError { kind: 'network'|'timeout'|'http'|'parse'|'aborted', status, message, body }.
//
// CORS (§2.4): today the backend only allows http://localhost:5173, so from defencegarden.com every call
// fails as a 'network' error. Callers must degrade gracefully.
// =============================================================================

export const DEFAULT_API = 'https://rivergreenbackend.onrender.com/api';

export class ApiError extends Error {
  constructor(kind, status = 0, message = '', body = null) {
    super(message || kind);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new ApiError('aborted')); }, { once: true });
});

/** Base URL from a [data-api] attribute (falls back to the production backend). */
export function apiBase(el) {
  const v = el?.closest?.('[data-api]')?.dataset.api || el?.dataset?.api || DEFAULT_API;
  return String(v).replace(/\/+$/, '');
}

async function once(url, { signal, timeout }) {
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) throw new ApiError('aborted');
    signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeout);
  try {
    let res;
    try {
      res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctrl.signal });
    } catch (err) {
      if (signal?.aborted) throw new ApiError('aborted');
      if (timedOut) throw new ApiError('timeout', 0, 'The service took too long to answer.');
      throw new ApiError('network', 0, 'The service could not be reached.');
    }
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (signal?.aborted) throw new ApiError('aborted');
    if (!res.ok) throw new ApiError('http', res.status, (body && typeof body.message === 'string' && body.message) || `HTTP ${res.status}`, body);
    if (body == null || typeof body !== 'object') throw new ApiError('parse', res.status, 'Unexpected response from the service.');
    return body;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * GET {base}{path}?{query} → parsed JSON object.
 * @param {string} base  API base, e.g. https://rivergreenbackend.onrender.com/api
 * @param {string} path  e.g. /colony-maps/public/site-plots/1
 * @param {{ query?: Record<string,string>, signal?: AbortSignal, timeout?: number, retry?: number }} [opts]
 */
export async function getJSON(base, path, { query, signal, timeout = 15000, retry = 1 } = {}) {
  const url = new URL(String(base).replace(/\/+$/, '') + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    try {
      return await once(url.href, { signal, timeout });
    } catch (err) {
      if (err?.kind === 'network' && attempt < retry && !signal?.aborted) { await sleep(2000, signal); continue; }
      throw err;
    }
  }
}
