// =============================================================================
// src/lib/head-sync.js — CLIENT helper for Barba navigations (tiny, no data imports).
//
// Contract (written by src/layouts/Base.astro on every page):
//   1. <head> contains the page-specific tags (description, canonical, robots, og:*, twitter:*, referrer,
//      and <script type="application/ld+json">), each carrying the attribute `data-page-head`.
//   2. The Barba container's FIRST child is
//        <script type="application/json" data-head>{ "v":1, "title", "lang", "tags":[{tag,attrs}], "jsonLd" }</script>
//      describing exactly those tags for that page.
//
// Usage in src/scripts/core/transitions.js (afterEnter, or right after the new container is inserted):
//   import { syncHead } from '../../lib/head-sync.js';
//   afterEnter({ next }) { syncHead(next.container); }
//
// syncHead(containerOrData) sets document.title and <html lang>, removes every [data-page-head] node from
// <head> and appends the new ones (meta/link + one ld+json script). Returns true when data was found.
// readHeadData(root) returns the parsed HeadData of a container (or null).
// =============================================================================

export function readHeadData(root = document) {
  const el = root && root.querySelector ? root.querySelector('script[type="application/json"][data-head]') : null;
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || 'null');
  } catch {
    return null;
  }
}

export function syncHead(source) {
  const data = source && typeof source.querySelector === 'function' ? readHeadData(source) : source;
  if (!data || typeof data !== 'object') return false;
  const doc = document;
  if (data.title) doc.title = data.title;
  if (data.lang) doc.documentElement.lang = data.lang;

  doc.head.querySelectorAll('[data-page-head]').forEach((n) => n.remove());
  const frag = doc.createDocumentFragment();
  for (const t of Array.isArray(data.tags) ? data.tags : []) {
    if (!t || (t.tag !== 'meta' && t.tag !== 'link')) continue;
    const el = doc.createElement(t.tag);
    for (const [k, v] of Object.entries(t.attrs || {})) if (v != null) el.setAttribute(k, String(v));
    el.setAttribute('data-page-head', '');
    frag.append(el);
  }
  if (data.jsonLd) {
    const s = doc.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-page-head', '');
    s.textContent = JSON.stringify(data.jsonLd);
    frag.append(s);
  }
  doc.head.append(frag);
  return true;
}
