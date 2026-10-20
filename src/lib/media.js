// =============================================================================
// src/lib/media.js — the single media helper (BUILD-TIME ONLY: use it in Astro frontmatter,
// never import it from client scripts; it eagerly imports every image's metadata).
//
// Public API (other agents code against it — keep it stable):
//   media(keyOrSrc)            → image record (see shape below). Accepts a manifest key
//                                ('projects.river-green-society.gallery-02'), a data `src`
//                                ('src/assets/media/…', with or without a leading '/' or './'),
//                                a public URL/path ('/og-image.jpg', 'public/og-image.jpg'),
//                                a data object ({ key } / { src }) or an imported ImageMetadata.
//                                Throws a clear Error for anything unknown.
//   video(keyOrSrc)            → video record (see shape below); accepts 'video.x', 'public/media/video/x.mp4',
//                                '/media/video/x.mp4' or a data object ({ key } / { src } / { url }).
//   preferred(obj)             → media(obj.preferKey || obj.key) (data objects carry the sharper twin
//                                in preferKey); a string follows the manifest's own preferKey.
//   pictureWidths(m, wanted=[480,800,1200,1600]) → the wanted widths ≤ m.width (never upscale);
//                                when the source is narrower than the largest wanted width its native
//                                width is appended (1400 px covers → [480, 800, 1200, 1400]).
//   imageProps(m, opts)        → props for astro:assets <Image>   (WebP, srcset, sizes, focus, placeholder colour)
//   pictureProps(m, opts)      → props for astro:assets <Picture> (same + formats ['webp'], fallbackFormat 'webp')
//   hasMedia(keyOrSrc)         → boolean, never throws
//
// Image record: { kind:'image', key, src, image, url, width, height, aspect, orientation, alt, description,
//   decorative, focus, dominantColor, topColor, tags, amenities, quality, fullBleed, hasAlpha, format,
//   projectId, group, role, preferKey, entry }
//   - src   = path from the project root (same as the data files' `src`)
//   - image = astro:assets ImageMetadata (null for files under public/, e.g. the OG image)
//   - url   = public URL for files under public/ (null for src/assets images: render those
//             through <Image>/<Picture>/getImage so they are optimised)
//   - alt   = manifest alt, or '' when the entry is decorative (description keeps the text)
//   - focus = CSS object-position ('x% y%'), default '50% 50%'
//
// Video record: { kind:'video', key, src, url, urlPortrait, urlSmall, width, height, duration, alt, hasAudio, startAt,
//   endAt, poster, posterKey, posterMedia, still, stillKey, stillMedia, summary, entry }
//   - urlPortrait = 9:16 crop for portrait boxes (manifest portraitLocalPath), urlSmall = light landscape encode for
//     small boxes (smallLocalPath); both null when the film has no variants (Vid.astro / video.js choose per box)
//   - poster/still = ImageMetadata | null (poster = first fully exposed frame → seamless autoplay;
//     still = representative frame → reduced motion / Save-Data / cards); *Media = full image records.
//   - Always render videos `muted playsinline`; loop between startAt and endAt (never native `loop`
//     when startAt > 0), preload="none" for the 11–17 MB project films (media-catalogue §4, §6).
//
// WHY width/height come from the manifest: astro:assets wraps every imported image in a Proxy and
// reading any of its properties (width, src, …) marks the ORIGINAL file as used, which copies the
// un-optimised original into dist/. Pass `image` straight to <Image>/<Picture>/getImage (they read it
// through a clone) and avoid JSON.stringify-ing or spreading it yourself.
//
// WHY pictureProps sets fallbackFormat: Astro's <Picture> defaults its fallback <img> to PNG for WebP
// sources, which would encode every photo a second time as a multi-megabyte PNG. README §4.6: WebP only.
// =============================================================================

import manifest from '../data/media-manifest.json';

if (!import.meta.env.SSR) {
  throw new Error('src/lib/media.js is build-time only: use it in Astro frontmatter, not in client scripts.');
}

/** Every raster image under src/assets (media + decor), as astro:assets ImageMetadata, keyed '/src/assets/…'. */
const FILES = import.meta.glob('/src/assets/**/*.{webp,jpg,jpeg,png,avif}', { eager: true, import: 'default' });

export const DEFAULT_WIDTHS = Object.freeze([480, 800, 1200, 1600]);
const DEFAULT_FOCUS = '50% 50%';

const BY_KEY = new Map();
const BY_PATH = new Map();
for (const e of manifest) {
  BY_KEY.set(e.key, e);
  if (e.localPath) BY_PATH.set(normalisePath(e.localPath), e);
  if (e.publicUrl) BY_PATH.set(normalisePath('public' + e.publicUrl), e);
}

/** 'src/assets/x.webp' | '/src/assets/x.webp' | './src/assets/x.webp' | '/og-image.jpg' | 'public/og-image.jpg' → canonical project path */
function normalisePath(p) {
  let s = String(p).trim().replace(/\\/g, '/').replace(/[?#].*$/, '');
  s = s.replace(/^\.\//, '').replace(/^\/+/, '');
  if (!s.startsWith('src/') && !s.startsWith('public/')) s = 'public/' + s; // a public URL such as '/og-image.jpg'
  return s;
}

/** Absolute filesystem path (ImageMetadata.fsPath) → project path, without touching the proxy's tracked props. */
function fsPathToProjectPath(fsPath) {
  const s = String(fsPath).replace(/\\/g, '/');
  const i = s.lastIndexOf('/src/assets/');
  return i >= 0 ? s.slice(i + 1) : null;
}

function looksLikePath(s) {
  return s.includes('/') || /\.(webp|jpe?g|png|avif|gif|svg|mp4|webm)$/i.test(s);
}

function describe(input) {
  try { return typeof input === 'string' ? `'${input}'` : JSON.stringify(input)?.slice(0, 160); } catch { return String(input); }
}

/**
 * Resolve any accepted input to { entry, path } where entry is the manifest entry (or null for a
 * non-manifest asset such as src/assets/decor/*) and path the canonical project path.
 */
function resolve(input, fn = 'media') {
  if (input == null || input === '') throw new Error(`${fn}(): expected a manifest key or a src path, got ${describe(input)}`);
  if (typeof input === 'object') {
    // imported ImageMetadata (fsPath is readable without marking the original as used)
    if (typeof input.fsPath === 'string' && !('key' in input) && !('src' in input)) {
      const p = fsPathToProjectPath(input.fsPath);
      if (p) return resolve(p, fn);
    }
    const ref = input.key || input.src || input.url;
    if (!ref) throw new Error(`${fn}(): data object has no key/src/url: ${describe(input)}`);
    return resolve(ref, fn);
  }
  const s = String(input).trim();
  if (BY_KEY.has(s)) {
    const entry = BY_KEY.get(s);
    return { entry, path: normalisePath(entry.localPath) };
  }
  if (looksLikePath(s)) {
    const path = normalisePath(s);
    const entry = BY_PATH.get(path);
    if (entry) return { entry, path };
    if (FILES['/' + path]) return { entry: null, path }; // asset outside the manifest (e.g. src/assets/decor)
    throw new Error(`${fn}(): no media at ${describe(input)} (looked for '${path}' in media-manifest.json and src/assets/**)`);
  }
  throw new Error(`${fn}(): unknown media key ${describe(input)} — keys look like 'projects.river-green-society.gallery-02' (see src/data/media-manifest.json)`);
}

function imageFor(path) {
  return path && path.startsWith('src/') ? FILES['/' + path] ?? null : null;
}

/** Image record for a manifest entry. */
function fromEntry(entry) {
  const src = entry.localPath;
  const image = imageFor(normalisePath(src));
  if (src.startsWith('src/') && !image) {
    throw new Error(`media(): '${entry.key}' points at '${src}', which is not an importable image under src/assets`);
  }
  const width = Number(entry.width) || 0;
  const height = Number(entry.height) || 0;
  return {
    kind: 'image',
    key: entry.key,
    src,
    image,
    url: entry.publicUrl ?? null,
    width,
    height,
    aspect: width && height ? width / height : null,
    orientation: entry.orientation ?? (width > height ? 'landscape' : width < height ? 'portrait' : 'square'),
    alt: entry.decorative ? '' : entry.alt ?? '',
    description: entry.alt ?? '',
    decorative: Boolean(entry.decorative),
    focus: entry.focus || DEFAULT_FOCUS,
    dominantColor: entry.dominantColor ?? null,
    topColor: entry.topColor ?? null,
    tags: entry.tags ?? [],
    amenities: entry.amenities ?? [],
    quality: entry.quality ?? null,
    fullBleed: Boolean(entry.fullBleed),
    hasAlpha: Boolean(entry.hasAlpha),
    format: entry.format ?? null,
    projectId: entry.projectId ?? null,
    group: entry.group ?? null,
    role: entry.role ?? null,
    preferKey: entry.preferKey ?? null,
    entry,
  };
}

/** Image record for an asset that is not in the manifest (decor art): dimensions from a clone of the metadata. */
function fromAsset(path) {
  const image = imageFor(path);
  const meta = (image && image.clone) || {}; // `clone` is a structuredClone of the metadata; it does not mark the original as used
  const width = Number(meta.width) || 0;
  const height = Number(meta.height) || 0;
  return {
    kind: 'image',
    key: null,
    src: path,
    image,
    url: null,
    width,
    height,
    aspect: width && height ? width / height : null,
    orientation: width > height ? 'landscape' : width < height ? 'portrait' : 'square',
    alt: '',
    description: '',
    decorative: true,
    focus: DEFAULT_FOCUS,
    dominantColor: null,
    topColor: null,
    tags: [],
    amenities: [],
    quality: null,
    fullBleed: false,
    hasAlpha: meta.format === 'png' || meta.format === 'avif' || meta.format === 'webp',
    format: meta.format ?? null,
    projectId: null,
    group: null,
    role: null,
    preferKey: null,
    entry: null,
  };
}

/** Image record for a manifest key, a src path, a public URL, a data object or an imported image. */
export function media(keyOrSrc) {
  const { entry, path } = resolve(keyOrSrc, 'media');
  if (!entry) return fromAsset(path);
  if (entry.kind === 'video') {
    throw new Error(`media(): '${entry.key}' is a video — use video('${entry.key}')`);
  }
  return fromEntry(entry);
}

/** true when media(keyOrSrc) would succeed. */
export function hasMedia(keyOrSrc) {
  try { media(keyOrSrc); return true; } catch { return false; }
}

/** The sharper twin when the data object (or the manifest entry of a string key) names one. */
export function preferred(obj) {
  if (obj == null) throw new Error('preferred(): expected a data object or a media key');
  if (typeof obj === 'string') {
    const { entry } = resolve(obj, 'preferred');
    return media(entry?.preferKey || obj);
  }
  return media(obj.preferKey || obj.key || obj.preferSrc || obj.src);
}

/** Video record (poster/still as ImageMetadata). */
export function video(keyOrSrc) {
  const { entry } = resolve(keyOrSrc, 'video');
  if (!entry || entry.kind !== 'video') {
    throw new Error(`video(): ${describe(keyOrSrc)} is not a video — use media() for images`);
  }
  const posterMedia = entry.poster ? media(entry.poster) : null;
  const stillMedia = entry.still ? media(entry.still) : null;
  return {
    kind: 'video',
    key: entry.key,
    src: entry.localPath,
    url: entry.publicUrl ?? '/' + entry.localPath.replace(/^public\//, ''),
    urlPortrait: entry.portraitLocalPath ? '/' + entry.portraitLocalPath.replace(/^public\//, '') : null,
    urlSmall: entry.smallLocalPath ? '/' + entry.smallLocalPath.replace(/^public\//, '') : null,
    width: Number(entry.width) || 0,
    height: Number(entry.height) || 0,
    duration: entry.duration ?? null,
    alt: entry.alt ?? '',
    hasAudio: Boolean(entry.hasAudio),
    startAt: Number(entry.startAt) || 0,
    endAt: Number(entry.endAt) || Number(entry.duration) || null,
    poster: posterMedia?.image ?? null,
    posterKey: entry.poster ?? null,
    posterMedia,
    still: stillMedia?.image ?? null,
    stillKey: entry.still ?? null,
    stillMedia,
    summary: entry.summary ?? '',
    entry,
  };
}

/** Wanted srcset widths that do not upscale the source (plus its native width when it is narrower than the largest wanted). */
export function pictureWidths(m, wanted = DEFAULT_WIDTHS) {
  const max = Number(m?.width) || 0;
  const list = [...new Set((wanted?.length ? wanted : DEFAULT_WIDTHS).map(Number).filter((w) => w > 0))].sort((a, b) => a - b);
  if (!max) return list;
  const out = list.filter((w) => w <= max);
  if (list[list.length - 1] > max && !out.includes(max)) out.push(max);
  return out.length ? out : [max];
}

function toRecord(m) {
  return m && typeof m === 'object' && m.kind === 'image' && 'focus' in m ? m : media(m);
}

/**
 * Props for astro:assets <Image>: `<Image {...imageProps('about.r2', { sizes: '50vw' })} class="…" />`.
 * opts: widths, sizes ('100vw'), loading ('lazy'), decoding ('async'), fetchpriority, alt, focus, quality, style.
 * The inline style sets object-position (manifest focus) and a dominant-colour placeholder background.
 */
export function imageProps(m, opts = {}) {
  const rec = toRecord(m);
  if (!rec.image) throw new Error(`imageProps(): '${rec.key ?? rec.src}' lives in public/ — use its url instead`);
  const { widths, sizes = '100vw', loading = 'lazy', decoding = 'async', fetchpriority, alt, focus, quality, style = '' } = opts;
  const css = [`object-position:${focus || rec.focus}`];
  if (rec.dominantColor && !rec.hasAlpha) css.push(`background-color:${rec.dominantColor}`);
  if (style) css.push(String(style).replace(/;+\s*$/, ''));
  const props = {
    src: rec.image,
    alt: alt ?? rec.alt,
    widths: pictureWidths(rec, widths),
    sizes,
    loading,
    decoding,
    style: css.join(';'),
  };
  if (fetchpriority) props.fetchpriority = fetchpriority;
  if (quality != null) props.quality = quality;
  return props;
}

/** Props for astro:assets <Picture>: WebP sources AND a WebP fallback <img> (never the PNG default). */
export function pictureProps(m, opts = {}) {
  return { ...imageProps(m, opts), formats: ['webp'], fallbackFormat: 'webp' };
}

/** All manifest entries (read-only use: filters, galleries). */
export function manifestEntries() {
  return manifest;
}
