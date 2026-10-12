# Defence Garden — website

Astro 7 static site. Design: a blend of realevate.agency (editorial white pages, giant marquee headlines around framed
photos, colour-coded collections) and era.estate (deep navy, copper, Art Deco line work, cinematic full-bleed imagery).
Story: from plotted colonies (since 2006) to urban high-rise living.

## Run locally
```bash
npm install
npm run dev        # http://localhost:4321
```

## Build & deploy (Hostinger)
```bash
npm run build      # outputs dist/
```
Upload the **contents** of `dist/` (including the hidden `.htaccess` files) to `public_html/`.
`public/.htaccess` handles clean URLs, `/booking/track/<id>`, the 404 page, `www → apex`, old-URL redirects
(`/projects`, `/courses` → `/ourproject`, `/sitemap.xml` → `/sitemap-index.xml`) and caching headers.

## Where things live
| What | Where |
|---|---|
| Company data, contacts, SEO | `src/data/site.json` |
| The 10 colonies (text, media links) | `src/data/projects.json` |
| Page copy | `src/data/pages/*.json`, legal pages `src/data/legal/*.md` |
| Photos (own) | `src/assets/media/**` (catalogue: `src/data/media-manifest.json`) |
| Films (own) | `public/media/video/*.mp4` |
| Concept (licensed stock) media | `src/assets/vision/*`, `public/media/vision/*`, credits in `src/data/vision-media.json` |
| Plot maps | `src/data/maps/*` |
| Design system | `src/styles/global.css` |
| Layout & chrome | `src/layouts/Base.astro`, `src/components/chrome/*` |
| Animation runtime (Lenis, GSAP, Barba) | `src/scripts/**` |
| Owner switches | `src/lib/flags.js` (e.g. `investmentClaims`) |

## Notes for the owner
- Concept images on the landing and Vision pages are licensed stock visualisations, labelled "Concept"; they are not
  Defence Garden projects. Credits: `/credits`.
- The live plot maps, booking tracker and receipt verifier call `https://rivergreenbackend.onrender.com/api`. That server
  must allow requests from `https://defencegarden.com` and `https://www.defencegarden.com` (CORS); until then the pages
  degrade gracefully to enquiry mode.
