// Build-time helpers shared by the colony listing (/ourproject) and the project pages (/project/:id).
// Frontmatter only (imports src/lib/site.js and src/lib/media.js, both build-time).
import { projects, displayTitle } from '../../lib/site.js';
import { preferred } from '../../lib/media.js';

/** A real photograph we may show (gallery hygiene: no layout plans, no images with unclear rights). */
export const isPhoto = (g) => Boolean(g) && !g.notPhoto && !g.rightsUnclear;

/**
 * Number of photos in the project page's gallery (the listing card's "+N photos"). Same rule as /project/:id: without
 * a film the cover is the page's hero, so the cover's twin is left out of the gallery.
 */
export function photoCount(p) {
  return galleryFor(p, { coverShown: !p.video }).length;
}

/** Gallery for a detail page: real photos only; the cover's twin is dropped when the cover itself is on screen. */
export function galleryFor(p, { coverShown = true } = {}) {
  return (p.gallery || []).filter((g) => isPhoto(g) && !(coverShown && g.coverTwin));
}

/** Two display lines for a project title ('Defence Garden' / 'Budhana', 'Defence Garden' / 'Phase 2', 'River Green' / 'Society'). */
export function titleLines(p) {
  const t = displayTitle(p);
  if (t !== p.title) return [p.title, p.city];
  const lead = p.titleSplit?.lead?.trim() || '';
  const accent = p.titleSplit?.accent?.trim() || '';
  if (!lead || !accent) return [t];
  if (accent.length <= 2) {
    const w = lead.split(/\s+/);
    if (w.length > 1) return [w.slice(0, -1).join(' '), `${w[w.length - 1]} ${accent}`];
  }
  return [lead, accent];
}

/** Filter tags of a listing card ('shamli ongoing'). */
export function tagsFor(p) {
  return [p.city, p.status].map((s) => String(s).toLowerCase().replace(/\s+/g, '-')).join(' ');
}

/** Other colonies for a detail page: same city first, then the rest in display order. */
export function otherColonies(p, n = 3) {
  const others = projects.filter((x) => x.id !== p.id);
  const same = others.filter((x) => x.city === p.city);
  const rest = others.filter((x) => x.city !== p.city);
  return [...same, ...rest].slice(0, n);
}

/** '01' … from a display index (0-based). */
export const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Photos ranked for feature slots (About, Amenities, enquiry backdrop): manifest quality, full-bleed suitability
 * and subject (homes, roads, parks, fountains over signage close-ups). Stable: ties keep gallery order.
 * Items: { g, i, s (score), bleed (full-bleed suitable), aerial (drone photo: manifest tag 'aerial' or 'drone'),
 *   signage (a gate, entrance or logo in frame, i.e. big lettering: manifest tag 'gate', 'entrance' or 'logo') }.
 */
export function rankPhotos(photos) {
  const GOOD = ['houses', 'villa', 'park', 'road', 'fountain', 'aerial', 'greenery'];
  const AERIAL = ['aerial', 'drone'];
  const SIGNAGE = ['gate', 'entrance', 'logo'];
  const score = (g) => {
    const r = preferred(g);
    const tags = r.tags || [];
    return (r.quality === 'high' ? 2 : r.quality === 'medium' ? 1 : 0) + (r.fullBleed ? 2 : 0)
      + (tags.some((t) => GOOD.includes(t)) ? 1 : 0) - (tags.includes('portrait-of-person') ? 2 : 0);
  };
  return photos.map((g, i) => {
    const r = preferred(g);
    const tags = r.tags || [];
    return { g, i, s: score(g), bleed: Boolean(r.fullBleed), aerial: tags.some((t) => AERIAL.includes(t)), signage: tags.some((t) => SIGNAGE.includes(t)) };
  }).sort((a, b) => b.s - a.s || a.i - b.i);
}
