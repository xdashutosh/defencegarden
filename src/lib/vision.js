// =============================================================================
// src/lib/vision.js — licensed concept ("vision") media for the landing and /vision pages (BUILD-TIME ONLY).
//
// Source of truth: src/data/vision-media.json { items: [{ key, kind, file, poster, width, height, alt, focus,
// source, sourceUrl, author, license, licenseUrl, attribution, description }] } — written by the media sourcing
// step. Images live in src/assets/vision/, videos in public/media/vision/.
//
//   vision(key)      → { kind:'image', key, image (ImageMetadata), width, height, alt, focus, credit } | null
//   visionVideo(key) → { kind:'video', key, url, poster (ImageMetadata|null), width, height, alt, focus, credit } | null
//   visionCredits()  → every item that exists, for the credits section
//
// Every getter returns null when the item is missing so pages can fall back to Defence Garden's own photos.
// =============================================================================

const DATA = import.meta.glob('/src/data/vision-media.json', { eager: true, import: 'default' });
const IMAGES = import.meta.glob('/src/assets/vision/**/*.{webp,jpg,jpeg,png,avif}', { eager: true, import: 'default' });

const items = (() => {
  const d = Object.values(DATA)[0];
  const list = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
  return list.filter((i) => i && i.key && i.file);
})();

const norm = (p) => '/' + String(p || '').replace(/^\.?\/+/, '');
const byKey = new Map(items.map((i) => [i.key.replace(/^vision\./, ''), i]));

function credit(i) {
  return {
    source: i.source || null,
    sourceUrl: i.sourceUrl || null,
    author: i.author || null,
    authorUrl: i.authorUrl || null,
    license: i.license || null,
    licenseUrl: i.licenseUrl || null,
    attribution: i.attribution || null,
  };
}

function find(key) {
  return byKey.get(String(key).replace(/^vision\./, '')) || null;
}

export function vision(key) {
  const i = find(key);
  if (!i || i.kind === 'video') return null;
  const image = IMAGES[norm(i.file)];
  if (!image) return null;
  return {
    kind: 'image', key: i.key, image, width: i.width || null, height: i.height || null,
    alt: i.alt || i.description || '', focus: i.focus || '50% 50%', credit: credit(i),
  };
}

export function visionVideo(key) {
  const i = find(key);
  if (!i || i.kind !== 'video') return null;
  const url = norm(i.file).replace(/^\/public\//, '/');
  const poster = i.poster ? IMAGES[norm(i.poster)] || null : null;
  return {
    kind: 'video', key: i.key, url, poster, width: i.width || null, height: i.height || null,
    alt: i.alt || i.description || '', focus: i.focus || '50% 50%', credit: credit(i),
  };
}

export function visionCredits() {
  return items
    .filter((i) => (i.kind === 'video' ? true : Boolean(IMAGES[norm(i.file)])))
    .map((i) => ({ key: i.key, kind: i.kind, alt: i.alt || i.description || '', ...credit(i) }));
}
