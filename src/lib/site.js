// =============================================================================
// src/lib/site.js — accessors over src/data/site.json + projects.json (build-time; Astro frontmatter).
// Client scripts should not import this file (it inlines both JSON files): render the values you need
// into data-* attributes instead (e.g. data-whatsapp={site.contact.whatsapp.number}).
//
// Exports
//   site, projectsData, sharedProjectData       raw data (read-only by convention)
//   SITE_URL, BRAND, THEME_COLOR
//   projects                                     the 10 projects in the old display order (1,5,2,3,4,6,7,8,9,10)
//   getProject(idOrSlug)                         project | null   (accepts 5, '5', 'defence-garden-phase-2')
//   projectUrl(p)                                '/project/{id}'
//   displayTitle(p)                              unique title: 'Defence Garden, Budhana' / 'Defence Garden, Meerut',
//                                                plain title otherwise (other-pages §16.2)
//   projectNumber(p)                             '01' … '10' (zero-padded id, card "№01")
//   phones.office / phones.sales, phone(which)   { id, display, tel, e164, spaced }   (both are the owner's single
//                                                number since 2026-10-15; the two ids stay so either can change alone)
//   contactPhones()                              distinct numbers for contact lists ('Call' when office = sales)
//   formatPhone(idOrNumber, { spaced=true })     '+91 95210 18879' (spaced) | '+91 9521018879'
//   telHref(idOrNumber)                          'tel:+919521018879'
//   whatsappNumber, whatsappUrl(message?)        WhatsApp number, wa.me deep link with ?text= (D26)
//   email, office (main office address), hours
//   nav                                          desktop (D09), mobile (D10), footer link lists
//   normalizePath(p), isCurrentPath(href, path), absoluteUrl(p), canonicalFor(p)
//   seoFor(pathname, overrides)                  resolved SEO for a route (see the JSDoc below)
//   copyright(year?)                             '© 2026 Defence Garden. All rights reserved.'
// =============================================================================

import siteJson from '../data/site.json';
import projectsJson from '../data/projects.json';

export const site = siteJson;
export const projectsData = projectsJson;
export const sharedProjectData = projectsJson.shared;

export const SITE_URL = String(site.brand.officialDomain || 'https://defencegarden.com').replace(/\/+$/, '');
export const BRAND = site.brand.name; // 'Defence Garden'
/** <meta name="theme-color">: the plum brand surface (preloader, footer, menu). site.json still has the old #0b0906. */
export const THEME_COLOR = '#061a3a';

// ---------------------------------------------------------------------------------------------- projects
const ORDER = projectsJson.displayOrder || projectsJson.projects.map((p) => p.id);
const rank = (id) => {
  const i = ORDER.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};
/** The 10 projects in the old site's display order. */
export const projects = [...projectsJson.projects].sort((a, b) => rank(a.id) - rank(b.id));

const BY_ID = new Map(projects.map((p) => [String(p.id), p]));
const BY_SLUG = new Map(projects.map((p) => [p.slug, p]));
const TITLE_COUNT = projects.reduce((m, p) => m.set(p.title, (m.get(p.title) || 0) + 1), new Map());

/** Project by id (number or string) or slug; null when unknown. Objects are passed through. */
export function getProject(idOrSlug) {
  if (idOrSlug == null) return null;
  if (typeof idOrSlug === 'object') return idOrSlug.id != null ? getProject(idOrSlug.id) : null;
  const k = String(idOrSlug).trim();
  return BY_ID.get(k) || BY_SLUG.get(k) || null;
}

function requireProject(p, fn) {
  const proj = typeof p === 'object' && p ? p : getProject(p);
  if (!proj) throw new Error(`${fn}(): unknown project ${JSON.stringify(p)}`);
  return proj;
}

/** Unique, human title (other-pages §16.2): "Defence Garden, Budhana" / "Defence Garden, Meerut". */
export function displayTitle(p) {
  const proj = requireProject(p, 'displayTitle');
  return TITLE_COUNT.get(proj.title) > 1 ? `${proj.title}, ${proj.city}` : proj.title;
}

export function projectUrl(p) {
  return `/project/${requireProject(p, 'projectUrl').id}`;
}

/** '01' … '10' */
export function projectNumber(p) {
  return String(requireProject(p, 'projectNumber').id).padStart(2, '0');
}

// ---------------------------------------------------------------------------------------------- contact
function spacedIndian(e164) {
  const d = String(e164).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return String(e164);
}

function phoneRecord(p) {
  return { id: p.id, display: p.display, tel: p.tel, e164: p.e164, spaced: spacedIndian(p.e164) };
}

/** phones.office (About CTA, contact lists) and phones.sales (calls from CTAs, modal, legal) — both +91 95210 18879. */
export const phones = Object.freeze(Object.fromEntries(site.contact.phones.map((p) => [p.id, phoneRecord(p)])));

/** phone('office' | 'sales') → { id, display (verbatim site.json), tel, e164, spaced } */
export function phone(which = 'sales') {
  const p = phones[which];
  if (!p) throw new Error(`phone(): unknown phone '${which}' (expected ${Object.keys(phones).join(' | ')})`);
  return p;
}

/**
 * Phone numbers for contact lists, one entry per distinct number: [{ ...record, label }] with label 'Sales' /
 * 'Office', or a single 'Call' entry while both ids hold the same number (avoids listing it twice).
 */
export function contactPhones() {
  const list = [];
  for (const [id, label] of [['sales', 'Sales'], ['office', 'Office']]) {
    const p = phones[id];
    if (!p) continue;
    const same = list.find((q) => q.e164.replace(/\D/g, '') === p.e164.replace(/\D/g, ''));
    if (same) same.label = 'Call';
    else list.push({ ...p, label });
  }
  return list;
}

/** formatPhone('office') → '+91 95210 18879'; formatPhone('+919521018879', { spaced: false }) → '+91 9521018879' */
export function formatPhone(idOrNumber, { spaced = true } = {}) {
  const e164 = phones[idOrNumber]?.e164 ?? String(idOrNumber);
  if (spaced) return spacedIndian(e164);
  const d = e164.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2)}` : e164;
}

/** telHref('sales') → 'tel:+919521018879' */
export function telHref(idOrNumber) {
  if (phones[idOrNumber]) return phones[idOrNumber].tel;
  const d = String(idOrNumber).replace(/[^\d+]/g, '');
  return `tel:${d.startsWith('+') ? d : d.length === 10 ? '+91' + d : '+' + d}`;
}

/** WhatsApp number (D26). */
export const whatsappNumber = site.contact.whatsapp.number; // '919521018879'

/** https://wa.me/919521018879 (+ ?text=<encoded message>) */
export function whatsappUrl(message) {
  const base = `https://wa.me/${whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(String(message))}` : base;
}

export const email = site.contact.email; // { address, href }
export const office = site.contact.addresses[0]; // main office (the only address)
export const hours = site.contact.hours; // { label, display, … }

/** '© {year} Defence Garden. All rights reserved.' */
export function copyright(year = new Date().getFullYear()) {
  return String(site.legal.copyright || site.footer.copyright).replace('{year}', String(year));
}

// ---------------------------------------------------------------------------------------------- navigation
const label = (href, fallback) =>
  [...site.nav.desktop.left, ...site.nav.desktop.right, ...site.nav.mobile.drawer.items].find((i) => i.href === href)?.label ?? fallback;

/** Modal id of the "Book a visit" CTA modal (data-modal-cta-btn / data-modal-cta, other-pages §15). */
export const BOOK_A_VISIT = 'book-a-visit';

export const nav = Object.freeze({
  /** D09: H6 two-line underlined link, then L2 items (u-4 apart). Home is reached through the logo badge. */
  desktop: {
    primary: { lines: ['Explore', 'our Colonies'], label: 'Explore our Colonies', href: '/ourproject' },
    items: [
      { label: 'Book a visit', modal: BOOK_A_VISIT },
      { label: label('/about', 'About'), href: '/about' },
      { label: label('/gallery', 'Gallery'), href: '/gallery' },
      { label: label('/investment', 'Investments'), href: '/investment' },
      { label: label('/contact', 'Contact'), href: '/contact' },
    ],
  },
  /** D10: title "The / MENU", 7 H6 links, bottom emblem + L2 footnote. */
  mobile: {
    eyebrow: site.nav.mobile.drawer.wordmark?.eyebrow || 'The',
    title: 'Menu',
    items: [
      { label: label('/', 'Home'), href: '/' },
      { label: label('/ourproject', 'Colonies'), href: '/ourproject' },
      { label: label('/about', 'About'), href: '/about' },
      { label: label('/gallery', 'Gallery'), href: '/gallery' },
      { label: label('/investment', 'Investments'), href: '/investment' },
      { label: 'Book a visit', modal: BOOK_A_VISIT },
      { label: label('/contact', 'Contact'), href: '/contact' },
    ],
    footnote: site.nav.mobile.drawer.footnote || site.brand.mobileMenuFootnote,
  },
  /** Footer link lists (verbatim site.json). */
  footer: { explore: site.footer.explore, legal: site.footer.legalLinks },
});

// ---------------------------------------------------------------------------------------------- paths & urls
/** '/about/' | 'about' | 'https://defencegarden.com/about?x#y' | '/about/index.html' → '/about'; '' → '/' */
export function normalizePath(p = '/') {
  let s = String(p || '/').trim();
  try {
    if (/^[a-z]+:\/\//i.test(s)) s = new URL(s).pathname;
  } catch {}
  s = s.replace(/[?#].*$/, '').replace(/\/{2,}/g, '/');
  s = s.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '');
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}

/** Nav "current" state: exact match, or a section prefix ('/about' is current on '/about/leadership' only when exact=false). */
export function isCurrentPath(href, pathname, { exact = false } = {}) {
  if (!href || /^[a-z]+:/i.test(href)) return false;
  const a = normalizePath(href), b = normalizePath(pathname);
  if (a === '/' || exact) return a === b;
  return b === a || b.startsWith(a + '/');
}

/** Absolute https://defencegarden.com URL for a path (absolute URLs pass through). */
export function absoluteUrl(pathOrUrl = '/') {
  return new URL(String(pathOrUrl), SITE_URL + '/').href;
}

/** Canonical rule (site.json seo.defaults.canonicalRule): origin + path without trailing slash, '/' for home. */
export function canonicalFor(pathname) {
  const p = normalizePath(pathname);
  return SITE_URL + (p === '/' ? '/' : p);
}

// ---------------------------------------------------------------------------------------------- SEO
const SEO = site.seo;
const D = SEO.defaults;
const UTIL = SEO.pages.privateUtility;
const NF = SEO.pages.fallback404;
const isUtilityPath = (p) => p === '/verify-receipt' || p === '/booking' || p.startsWith('/booking/');

/**
 * seoFor(pathname, overrides?) → {
 *   path, kind ('page'|'project'|'utility'|'notfound'|'dev'|'generic'), lang, siteName, title, description,
 *   canonical (string|null), robots, noindex, keywords, author, ogType, ogLocale, ogImage (absolute URL),
 *   ogImageWidth, ogImageHeight, ogImageAlt, twitterCard, themeColor, schemaType, heading, summary,
 *   about ('owner'|null), mainEntity ('owner'|null), faq (bool), project (project|null)
 * }
 * Sources: site.json seo.pages (runtimeTitle wins over title, as on the old site), '/project/:id' →
 * '{displayTitle} | Defence Garden' + the project's desc (other-pages §16.5), '/verify-receipt' and
 * '/booking/*' → privateUtility (noindex, nofollow, no canonical), '/404' → 'Page Not Found | Defence Garden'
 * (noindex, follow, no canonical), '/dev/*' → noindex, nofollow.
 * overrides: { title, description, robots, noindex, canonical (string|false), ogType, ogImage, ogImageWidth,
 *   ogImageHeight, ogImageAlt, schemaType, heading }
 */
export function seoFor(pathname = '/', overrides = {}) {
  const path = normalizePath(pathname);
  let kind = 'generic';
  let page = null;
  let project = null;
  let canonical = canonicalFor(path);

  if (SEO.pages[path] && path !== '/project/:id') {
    kind = 'page';
    page = SEO.pages[path];
  } else if (/^\/project\/[^/]+$/.test(path) && (project = getProject(path.split('/')[2]))) {
    kind = 'project';
    const tpl = SEO.pages['/project/:id'];
    page = { ...tpl, title: `${displayTitle(project)} | ${BRAND}`, description: project.desc, heading: displayTitle(project) };
  } else if (isUtilityPath(path)) {
    kind = 'utility';
    page = UTIL;
    canonical = null;
  } else if (path === '/404' || path === '/500' || /^\/project\//.test(path)) {
    kind = 'notfound';
    page = { ...NF, title: `Page Not Found | ${BRAND}` }; // heading from pages/notfound.json
    canonical = null;
  } else if (path === '/dev' || path.startsWith('/dev/')) {
    kind = 'dev';
    page = { title: `Dev · ${path} | ${BRAND}`, description: D.siteName, robots: 'noindex, nofollow' };
    canonical = null;
  } else {
    page = { title: BRAND, description: site.brand.description };
  }

  const o = overrides || {};
  let robots = o.robots || page.robots || D.robots;
  if (o.noindex && !/noindex/i.test(robots)) robots = 'noindex, nofollow';
  if (o.canonical === false) canonical = null;
  else if (typeof o.canonical === 'string') canonical = o.canonical.startsWith('http') ? o.canonical : canonicalFor(o.canonical);
  const noindex = /noindex/i.test(robots);

  const social = site.brand.socialImage || {};
  return {
    path,
    kind,
    lang: D.lang || 'en',
    siteName: D.siteName || BRAND,
    title: o.title || page.runtimeTitle || page.title || BRAND,
    description: o.description || page.description || site.brand.description,
    canonical,
    robots,
    noindex,
    keywords: D.keywords,
    author: D.author,
    ogType: o.ogType || page.ogType || D.ogType || 'website',
    ogLocale: D.ogLocale || 'en_IN',
    ogImage: absoluteUrl(o.ogImage || D.ogImage || social.url || '/og-image.jpg'),
    ogImageWidth: o.ogImageWidth ?? (o.ogImage ? null : D.ogImageWidth ?? social.width ?? null),
    ogImageHeight: o.ogImageHeight ?? (o.ogImage ? null : D.ogImageHeight ?? social.height ?? null),
    ogImageAlt: o.ogImageAlt || (o.ogImage ? '' : social.alt || ''),
    twitterCard: D.twitterCard || 'summary_large_image',
    themeColor: THEME_COLOR,
    schemaType: o.schemaType || page.schemaType || 'WebPage',
    heading: o.heading || page.heading || null,
    summary: page.summary || null,
    about: page.about || null,
    mainEntity: page.mainEntity || null,
    faq: Boolean(page.faq),
    project,
  };
}

/** Breadcrumb trail for JSON-LD when the page passes no visual crumbs (site.json seo.breadcrumbNames). */
export function breadcrumbsFor(pathname) {
  const path = normalizePath(pathname);
  if (path === '/') return [];
  const names = SEO.breadcrumbNames || {};
  const out = [{ label: names['/'] || 'Home', href: '/' }];
  const proj = /^\/project\/[^/]+$/.test(path) ? getProject(path.split('/')[2]) : null;
  if (proj) {
    out.push({ label: names['/ourproject'] || 'Projects', href: '/ourproject' }, { label: displayTitle(proj), href: path });
    return out;
  }
  let acc = '';
  for (const seg of path.split('/').filter(Boolean)) {
    acc += '/' + seg;
    out.push({ label: names[acc] || SEO.pages[acc]?.heading || seg, href: acc });
  }
  return out;
}
