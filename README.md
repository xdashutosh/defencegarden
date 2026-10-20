# Defence Garden — website

Astro 7 static site. Design: a blend of realevate.agency (editorial white pages, giant marquee headlines around framed
photos, colour-coded collections) and era.estate (deep navy, copper, Art Deco line work, cinematic full-bleed imagery).
Story: from plotted colonies (since 2006) to urban high-rise living.
Type: the whole site uses one family, Google Sans (`@fontsource-variable/google-sans`, bundled with the CSS); the
type roles live in `src/styles/global.css`.

## Run locally
```bash
npm ci             # exact versions from package-lock.json (Node 24)
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview    # serves dist/ locally
```
`npm run dev` and `npm run preview` forward the read-only `/api-proxy/…` paths to the booking backend and serve
`/booking/track/<id>` exactly like Vercel (see `astro.config.mjs`), so the live plot maps, the booking tracker and the
receipt verifier also work locally. (Redirects and headers from `vercel.json` only apply on Vercel.)

## Deploy on Vercel

The site is plain static HTML (no Vercel adapter, no server code). Vercel runs `npm ci` and `npm run build` on
Node 24 and serves `dist/`. Every hosting rule lives in **`vercel.json`**:

| Rule | What visitors get |
|---|---|
| `trailingSlash: false` | `/about/` → **308** → `/about` (canonical URLs have no trailing slash); `/about` serves `dist/about/index.html` |
| www → apex | `https://www.defencegarden.com/<path>?<query>` → **301** → `https://defencegarden.com/<path>?<query>`. Printed receipt QR codes (`https://www.defencegarden.com/verify-receipt?token=…`) keep working, token included |
| Old URLs | `/projects`, `/courses`, `/project` → **301** → `/ourproject`; `/sitemap.xml` → **301** → `/sitemap-index.xml` |
| Booking tracker | `/booking/track/<id>` shows the tracker page (`dist/booking/track/index.html`); the address bar keeps the id |
| Booking API proxy | Four read-only paths under `/api-proxy/` are forwarded to `https://rivergreenbackend.onrender.com/api/…` (see [For the backend developer](#for-the-backend-developer)); responses are never cached; anything else under `/api-proxy/` is a 404 |
| 404 | Unknown URLs get `404.html` with status 404 |
| Headers | `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and a **report-only** CSP on every page; `/_astro/*` cached 1 year (immutable, hashed names); `/fonts/*` 30 days; `/media/*` 7 days; `X-Robots-Tag: noindex, nofollow` on `/booking/*`, `/verify-receipt` and `/api-proxy/*` |

Files in `public/media` and `public/fonts` have no hash in their names: when you replace a film or a font, give the
new file a **new name** (returning visitors may otherwise keep the old copy for up to 7 / 30 days).

### Step 0 — clean up the Git repository (once, before connecting it to Vercel)
The first commit accidentally contains `node_modules/` (with macOS-only binaries), `dist/` and `.astro/`. The new
`.gitignore` excludes them; take them out of Git (the files stay on your disk):
```bash
cd ~/Desktop/defencegarden
git rm -r --cached --quiet node_modules dist .astro
git add -A                 # .gitignore, .vercelignore, vercel.json, deploy/hostinger/ (moved .htaccess files) and all other changes
git status                 # check: node_modules/, dist/, .astro/ are "deleted" (from Git only), nothing unexpected is added
git commit -m "Deploy on Vercel: vercel.json, same-origin booking API proxy; stop tracking node_modules, dist, .astro"
git push origin main
```

### Step 1 — Vercel account and plan
Use a **Pro** team. Vercel's Hobby plan is for non-commercial, personal use only, so a company website needs Pro.
(Pro also allows CLI uploads up to 1 GB; this project's source, films included, is about 110 MB, more than Hobby's
100 MB CLI limit.)

### Step 2a — deploy from GitHub (recommended)
1. vercel.com → **Add New… → Project → Import Git Repository** → `xdashutosh/defencegarden` (allow the Vercel GitHub
   app to access the repository when asked).
2. **Configure Project**: Framework Preset **Astro** (detected), Root Directory `./`. Leave Build Command, Output
   Directory and Install Command as shown; `vercel.json` sets them (`npm run build`, `dist`, `npm ci`). The Node.js
   version comes from `package.json` (`"engines": { "node": "24.x" }`). No environment variables are needed.
3. **Deploy**. From now on every push to `main` is a production deployment; other branches and pull requests get
   preview deployments.

### Step 2b — or deploy from this computer (Vercel CLI)
```bash
cd ~/Desktop/defencegarden
npx vercel          # first run: log in, "Set up and deploy" → Yes, choose the team, new project "defencegarden",
                    # directory ./, "Modify these settings?" → No. Creates a PREVIEW deployment.
npx vercel --prod   # production deployment
```
The CLI uploads the source and Vercel builds it; `.vercelignore` keeps `dist/`, `.astro/`, `deploy/` and `.env*`
out of the upload. The link to the project is stored in `.vercel/` (ignored by Git).

### Step 3 — project settings to check (Project → Settings)
- **Build and Deployment**: Framework Preset Astro; Node.js Version 24.x.
- **Advanced → Directory Listing**: Disabled (the default), so `/booking`, `/media` etc. answer 404.
- **Deployment Protection**: new projects use *Standard Protection* (Vercel Authentication). Preview URLs and
  per-deployment URLs ask for a Vercel login; the production domains (`defencegarden.com`, `www.defencegarden.com` and
  the project's production `*.vercel.app` domain) stay public. The booking API calls are deliberately sent without
  cookies, so on a **protected preview URL** the live plot status, tracker and verifier show their "service
  unavailable / enquire" state: test those features on a production domain.
- **Environment Variables** (optional): `PUBLIC_DG_API_BASE`. Leave it **unset** to use the same-origin proxy
  `/api-proxy` (recommended). Set it only to call a backend directly, e.g. `https://rivergreenbackend.onrender.com/api`
  once that server allows CORS from the site. It is read at build time: redeploy after changing it.

### Step 4 — custom domain (DNS stays at Hostinger)
The domain's DNS is at Hostinger (nameservers `ns1.dns-parking.com`, `ns2.dns-parking.com`); keep it there and
change only the website records. Email (Hostinger MX) is not affected.

1. Vercel → Project → **Settings → Domains → Add Domain** → `defencegarden.com` (Production). When Vercel offers the
   `www` variant, choose to **add `www.defencegarden.com` and redirect it to `defencegarden.com`** (the site's
   canonical address is the apex). If both are already listed, open **Edit** on `www.defencegarden.com` → *Redirect
   to* `defencegarden.com`, status **301**. (`vercel.json` also 301s www → apex, so either way path and `?token=`
   are kept.)
2. Each domain card in Vercel shows the exact values to enter. Use the card's values:

   | Type | Name (Host) | Value | TTL |
   |---|---|---|---|
   | A | `@` | `76.76.21.21`, or the IP on the `defencegarden.com` card if it differs (newer projects may show e.g. `216.198.79.1`) | 300 |
   | CNAME | `www` | the target on the `www.defencegarden.com` card, project-specific, e.g. `d1d4fc829fe7bc7c.vercel-dns-017.com` (older projects: `cname.vercel-dns.com`) | 300 |

3. In Hostinger **hPanel**: first switch **off Hostinger's CDN** for the website (today both names point at
   Hostinger's CDN: `www` is a CNAME to `www.defencegarden.com.cdn.hstgr.net` and `@` answers with rotating CDN
   addresses such as `93.127.173.x`, `91.108.106.x`, `147.79.69.x` and `2a02:4780:…`). Then **Domains →
   defencegarden.com → DNS / Nameservers → DNS records**:
   - **delete** every `A`, `AAAA` and `ALIAS` record for `@`;
   - **delete** every `CNAME`, `A` and `AAAA` record for `www`;
   - **add** the `A` and `CNAME` records from step 2. Do not add `AAAA` records (Vercel does not serve IPv6 for
     domains on external DNS);
   - **keep** MX (`mx1.hostinger.com`, `mx2.hostinger.com`), the SPF `TXT` record, `_dmarc` and any DKIM records,
     and the nameservers unchanged. There is no CAA record today; if one is ever added it must allow
     `letsencrypt.org`.
4. Wait until both domain cards show **Valid Configuration**; Vercel then issues the HTTPS certificates itself.
   Check from a terminal: `dig +short A defencegarden.com` and `dig +short CNAME www.defencegarden.com`.
5. Keep the Hostinger hosting (and email) until the change has propagated everywhere (up to 24–48 h).

Tip for a switch without downtime: test everything on the production `*.vercel.app` URL first, then change DNS.

### Step 5 — checklist after the first production deploy (and after big changes)
```bash
curl -sI https://defencegarden.com/about                       # 200; x-content-type-options: nosniff; content-security-policy-report-only
curl -sI https://defencegarden.com/about/                      # 308; location: /about
curl -sI https://www.defencegarden.com/                        # 301 (or 308); location: https://defencegarden.com/
curl -sI 'https://www.defencegarden.com/verify-receipt?token=test'   # location: https://defencegarden.com/verify-receipt?token=test
curl -sI https://defencegarden.com/projects                    # 301; location: /ourproject
curl -sI https://defencegarden.com/sitemap.xml                 # 301; location: /sitemap-index.xml
curl -sI https://defencegarden.com/booking/track/TEST123       # 200 (tracker page); x-robots-tag: noindex, nofollow
curl -sI https://defencegarden.com/does-not-exist              # 404 (branded page)
curl -sI https://defencegarden.com/.htaccess                   # 404
curl -s 'https://defencegarden.com/api-proxy/colony-maps/public/site-plots/1?colony_name=River%20Green%20Colony' | head -c 120   # {"success":true,"plots":[…
curl -sI https://defencegarden.com/api-proxy/razorpay/config/1 # 404 (not proxied)
```
In a browser:
- `/project/1` and `/project/5`: the plot map says **"Live · updated hh:mm"** and plots are coloured (the first visit
  can take up to a minute while the Render backend wakes up: "Waking up the booking service…").
- Scan a printed receipt QR code: it opens `https://defencegarden.com/verify-receipt?token=…` and shows the
  certificate.
- Open a real booking link `/booking/track/<id>`: status shows, "Download receipt" works.
- `/_astro/…` files answer `cache-control: public, max-age=31536000, immutable`.
- The browser console may show **CSP report-only** messages; they block nothing. After a clean week, rename the header
  `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `vercel.json`.
- Build log on Vercel: Node 24.x, `npm ci`, "27 page(s) built". Every build re-encodes the images (about 1–2 min)
  because `npm ci` starts from a clean `node_modules` (where Astro keeps its image cache).

### Fallback: Hostinger
`deploy/hostinger/` keeps the previous Apache/LiteSpeed rules (they are outside `public/`, so they never ship to
Vercel). Hostinger cannot proxy `/api-proxy`, so a Hostinger build must call the backend directly, and the backend
must then allow CORS from `https://defencegarden.com` and `https://www.defencegarden.com`:
```bash
PUBLIC_DG_API_BASE=https://rivergreenbackend.onrender.com/api npm run build
cp deploy/hostinger/.htaccess dist/.htaccess && cp deploy/hostinger/_astro/.htaccess dist/_astro/.htaccess
# upload the contents of dist/ (hidden files included) to public_html/
```

### For the backend developer
- The website no longer needs CORS: browsers call `https://defencegarden.com/api-proxy/…` (same origin) and Vercel
  forwards the request server-side to `https://rivergreenbackend.onrender.com/api/…` (`Host:
  rivergreenbackend.onrender.com`, visitor IP in `X-Forwarded-For` / `X-Real-IP`, no cookies).
- Only these GET endpoints are forwarded; keep them stable and read-only:
  `/colony-maps/public/site-plots/:site?colony_name=…`, `/bookings/track/:id`, `/bookings/track/:id/receipt-token`,
  `/payments/verify-receipt?token=…` (paths are listed in `vercel.json` and in `astro.config.mjs` →
  `API_PROXY_PATHS`; change both if an endpoint moves).
- All website traffic now reaches the API from Vercel's servers: any per-IP rate limit must use the visitor IP from
  `X-Forwarded-For` / `X-Real-IP`.
- The `verifyUrl` returned by `receipt-token` (the QR content) may keep using `https://www.defencegarden.com/verify-receipt?token=…`:
  www redirects to the apex with the token.

## Where things live
| What | Where |
|---|---|
| Company data, contacts, SEO | `src/data/site.json` (phone/WhatsApp/email in `contact`; the same number is used for office, sales and WhatsApp; the JSON-LD copies follow it automatically). The legal pages (`src/data/legal/*.md`) spell the number and email out in their text, so update them too |
| Sky at the top of every page | `src/components/chrome/Sky.astro` + `src/scripts/modules/sky.js`; video and stills in `public/media/sky/` (credit in `src/data/vision-media.json` → `vision.sky-clouds`) |
| Logo | `src/components/chrome/Logo.astro` (inline vector, recoloured on dark surfaces); files for print/partners in `public/brand/` |
| Favicons & app icons | `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` (links listed in `site.json` → `brand.favicons`) |
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
| Hosting rules (redirects, rewrites, headers, API proxy) | `vercel.json` (local mirror: `astro.config.mjs`) |
| Booking API client | `src/scripts/booking/api.js` (base `/api-proxy`, override `PUBLIC_DG_API_BASE`) |
| Old Hostinger rules (fallback only) | `deploy/hostinger/` |
| Home hero film (scroll-scrubbed) | `public/media/vision/hero-film.mp4` + `hero-film-m.mp4`, posters in `src/assets/vision/`, entry `hero-film` in `src/data/vision-media.json`; story beats in `src/pages/index.astro` |

### Replacing the home hero film
Scrolling drives the film's time (`src/scripts/modules/scrubVideo.js`), so the files must seek instantly:
- Desktop: 1920×1080 H.264, a keyframe every 10 frames, no audio, faststart —
  `ffmpeg -i in.mp4 -vf scale=1920:1080 -c:v libx264 -preset slow -crf 25 -g 10 -keyint_min 10 -sc_threshold 0 -pix_fmt yuv420p -an -movflags +faststart hero-film.mp4`
- Portrait screens: a native 720×1280 crop (not the desktop file squeezed), same flags with `-crf 26 -g 6`.
- Posters: the exact first frame of each file (`-frames:v 1`) saved as WebP — the preloader and the hero show the
  poster until the film's first frame paints, so they must match it.
- Keep the clip short (≈10–15 s, under ~12 MB on desktop): the whole file is downloaded before scrubbing starts.

## Notes for the owner
- Concept images on the landing and Vision pages are licensed stock visualisations, labelled "Concept"; they are not
  Defence Garden projects. Credits: `/credits`.
- The live plot maps, booking tracker and receipt verifier read from `https://rivergreenbackend.onrender.com/api`
  through the website's own `/api-proxy` (set up in `vercel.json`), so they work on defencegarden.com without any
  CORS change on that server. If the backend is asleep or down, the pages fall back to enquiry mode.
