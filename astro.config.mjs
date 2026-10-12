// @ts-check
// =============================================================================
// Defence Garden — Astro config (foundation-base).
//
// Hosting: Hostinger, static build uploaded from dist/ (functional §12). build.format 'directory' +
// trailingSlash 'ignore' (functional §12.5); canonical URLs have NO trailing slash and public/.htaccess
// 301s '/about/' → '/about'. The old /sitemap.xml URL is 301'd to /sitemap-index.xml by public/.htaccess.
//
// DEV/TEST PAGES (src/pages/dev/**) NEVER SHIP — integration `dg:dev-pages`:
//   1. build only: a Vite `load` hook replaces every src/pages/dev/**.astro with an empty page (dynamic
//      routes get getStaticPaths() → []), so dev pages cost nothing and cannot break the production build;
//   2. astro:build:done deletes dist/dev/ entirely;
//   3. the sitemap filter drops /dev/ URLs (and /booking/, /verify-receipt, 404 — functional §12.5).
//   Set DG_KEEP_DEV_PAGES=1 to keep them in a build (staging QA only). In `astro dev` they work normally.
//
// IMAGES (README §4.6): astro:assets outputs WebP by default for <Image>/getImage. <Picture> would add a PNG
// fallback for WebP sources — use pictureProps() from src/lib/media.js (formats + fallbackFormat 'webp').
// Never ask for widths above the manifest width (pictureWidths()). Integration `dg:prune-originals` deletes
// the un-optimised originals that src/lib/media.js's eager glob makes Vite emit but no page references
// (DG_KEEP_ORIGINALS=1 keeps them).
//
// DEV SERVER: `dg:hosting-parity` serves /booking/track/<id> with the tracker page, like .htaccess rule 4.
// =============================================================================
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://defencegarden.com';
const KEEP_DEV_PAGES = process.env.DG_KEEP_DEV_PAGES === '1';

/** site.json seo.sitemap: changefreq/priority per canonical URL (read with fs so the config has no JSON import). */
const siteJson = JSON.parse(fs.readFileSync(new URL('./src/data/site.json', import.meta.url), 'utf8'));
const SITEMAP_META = new Map((siteJson?.seo?.sitemap ?? []).map((e) => [String(e.loc).replace(/\/+$/, '') || SITE, e]));

/** Paths that must never be listed (private utilities, error pages, dev/test pages). */
const NOT_IN_SITEMAP = /^\/(?:dev|booking|verify-receipt|404|500)(?:\/|$)/;

/** Canonical form used everywhere on the site: no trailing slash except the root. */
const canonical = (url) => {
  const u = new URL(url);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.href;
};

/** @returns {import('astro').AstroIntegration} */
function devPages() {
  const DEV_PAGE = /[\\/]src[\\/]pages[\\/]dev[\\/].+\.astro$/;
  return {
    name: 'dg:dev-pages',
    hooks: {
      'astro:config:setup': ({ command, updateConfig, logger }) => {
        if (command !== 'build' || KEEP_DEV_PAGES) return;
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'dg:stub-dev-pages',
                enforce: 'pre',
                load(id) {
                  if (id.includes('?') || !DEV_PAGE.test(id)) return null;
                  const route = id.replace(/\\/g, '/').split('/src/pages/dev/').pop() ?? '';
                  const dynamic = /\[[^\]]+\]/.test(route); // [param] in the file name or in a folder name
                  return `---\n${dynamic ? 'export function getStaticPaths() { return []; }\n' : ''}---\n<meta name="robots" content="noindex, nofollow">\n`;
                },
              },
            ],
          },
        });
        logger.info('src/pages/dev/** is stubbed for this build and dist/dev/ will be removed (DG_KEEP_DEV_PAGES=1 keeps them).');
      },
      'astro:build:done': ({ dir, logger }) => {
        if (KEEP_DEV_PAGES) return;
        const out = fileURLToPath(new URL('./dev/', dir));
        if (fs.existsSync(out)) {
          fs.rmSync(out, { recursive: true, force: true });
          logger.info('removed dist/dev/ (dev/test pages never ship)');
        }
      },
    },
  };
}

/**
 * src/lib/media.js imports EVERY image under src/assets (eager glob) so media(key) can stay synchronous.
 * Vite emits each imported image into dist/_astro, and Astro only deletes an original when that image was
 * transformed and never referenced — originals of images no page uses would ship (≈22 MB of unused WebP/PNG).
 * After the build, delete every raster image in dist/_astro that no emitted text file (html/css/js/json/xml/svg)
 * mentions. Referenced originals (e.g. an `image.src` used directly, a CSS url()) are kept.
 * DG_KEEP_ORIGINALS=1 disables the prune.
 * @returns {import('astro').AstroIntegration}
 */
function pruneUnusedOriginals() {
  const IMG = /\.(?:webp|png|jpe?g|avif|gif)$/i;
  const TEXT = /\.(?:html?|css|m?js|json|xml|svg|txt|webmanifest)$/i;
  /** @param {string} dir @param {RegExp} re @param {string[]} out */
  const walk = (dir, re, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'media' && e.name !== 'fonts') walk(p, re, out); }
      else if (re.test(e.name)) out.push(p);
    }
    return out;
  };
  return {
    name: 'dg:prune-originals',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        if (process.env.DG_KEEP_ORIGINALS === '1') return;
        const root = fileURLToPath(dir).replace(/\/+$/, '');
        const assets = `${root}/_astro`;
        if (!fs.existsSync(assets)) return;
        const haystack = walk(root, TEXT).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
        let count = 0, bytes = 0;
        for (const f of walk(assets, IMG)) {
          const name = f.slice(f.lastIndexOf('/') + 1);
          if (haystack.includes(name)) continue;
          bytes += fs.statSync(f).size;
          fs.rmSync(f);
          count++;
        }
        if (count) logger.info(`removed ${count} unreferenced original image(s) from dist/_astro (${(bytes / 1048576).toFixed(1)} MB)`);
      },
    },
  };
}

/**
 * Dev-server parity with public/.htaccess rule 4: /booking/track/<id> is served by the ONE static tracker
 * page (src/pages/booking/track/index.astro) while the URL keeps the id (read from location.pathname).
 * @returns {import('astro').AstroIntegration}
 */
function hostingParity() {
  const TRACK = /^\/booking\/track\/[A-Za-z0-9_-]+\/?$/;
  return {
    name: 'dg:hosting-parity',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, _res, next) => {
          const [p, q] = String(req.url || '').split('?');
          if (TRACK.test(p)) req.url = '/booking/track/' + (q ? `?${q}` : '');
          next();
        });
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  // 'class' so a component's scoped styles also reach the root of child components it passes `class` to
  scopedStyleStrategy: 'class', // keeps screenshots of the shared dev server identical to production
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        webp: { quality: 80, effort: 4, smartSubsample: true },
        jpeg: { quality: 82, mozjpeg: true },
      },
    },
  },
  integrations: [
    devPages(),
    pruneUnusedOriginals(),
    hostingParity(),
    sitemap({
      filter: (page) => !NOT_IN_SITEMAP.test(new URL(page).pathname),
      namespaces: { news: false, xhtml: false, image: false, video: false },
      serialize: (() => {
        const seen = new Set();
        return (item) => {
          const url = canonical(item.url);
          if (seen.has(url)) return undefined;
          seen.add(url);
          const meta = SITEMAP_META.get(url.replace(/\/+$/, '') || SITE);
          return {
            ...item,
            url,
            ...(meta?.changefreq ? { changefreq: meta.changefreq } : {}),
            ...(meta?.priority ? { priority: Number(meta.priority) } : {}),
          };
        };
      })(),
    }),
  ],
});
