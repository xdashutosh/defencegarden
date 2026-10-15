// =============================================================================
// src/lib/seo.js — builds the per-page <head> data used by src/layouts/Base.astro (build-time).
//
//   headFor(seo, { crumbs, jsonLd }) → HeadData {
//     v: 1, title, lang,
//     tags: [{ tag: 'meta'|'link', attrs: {…} }, …],   // page-specific head tags (description, canonical,
//                                                      // robots, Open Graph, Twitter, referrer for utilities)
//     jsonLd: { '@context', '@graph': [...] } | null    // null on noindex pages
//   }
//   jsonLdFor(seo, { crumbs, extra })   → the JSON-LD object (Organization+RealEstateAgent, Person, WebSite,
//                                         WebPage(schemaType), BreadcrumbList (not on '/'), FAQPage (faq pages))
//   safeJson(value)                      → JSON string safe to embed in <script> (escapes <, >, &, U+2028/9)
//
// Base renders `tags` into <head> with a `data-page-head` attribute and embeds the same HeadData inside the
// Barba container as <script type="application/json" data-head>; src/lib/head-sync.js swaps them on navigation.
// =============================================================================

import { site, absoluteUrl, breadcrumbsFor, phone, email } from './site.js';

const LD = site.seo.jsonLd;

/** Drop the documentation-only keys ("note", "...Note") the content agent left in site.json. */
function clean(node) {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'note' || /Note$/.test(k)) continue;
    out[k] = clean(v);
  }
  return out;
}

// telephone/email always follow site.contact (the copies in site.json seo.jsonLd are only a fallback)
const ORG = clean({ ...LD.organization, telephone: phone('office').display, email: email.address });
const PERSON = clean(LD.person);
const WEBSITE = clean(LD.website);

export function jsonLdFor(seo, { crumbs, extra } = {}) {
  if (!seo || seo.noindex) return null;
  const url = seo.canonical || absoluteUrl(seo.path);
  const page = {
    '@type': seo.schemaType || 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: seo.title,
    description: seo.description,
    inLanguage: seo.lang || 'en',
    isPartOf: { '@id': WEBSITE['@id'] },
    about: { '@id': seo.about === 'owner' ? PERSON['@id'] : ORG['@id'] },
  };
  if (seo.mainEntity === 'owner') page.mainEntity = { '@id': PERSON['@id'] };

  const graph = [ORG, PERSON, WEBSITE, page];

  if (seo.path !== '/') {
    const trail = (crumbs && crumbs.length ? crumbs : breadcrumbsFor(seo.path)).filter((c) => c && c.label);
    if (trail.length) {
      const id = `${url}#breadcrumb`;
      page.breadcrumb = { '@id': id };
      graph.push({
        '@type': 'BreadcrumbList',
        '@id': id,
        itemListElement: trail.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.label,
          item: i === trail.length - 1 ? url : absoluteUrl(c.href || seo.path),
        })),
      });
    }
  }

  if (seo.faq && Array.isArray(site.seo.faq) && site.seo.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: site.seo.faq.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    });
  }

  for (const node of [].concat(extra || [])) if (node && typeof node === 'object') graph.push(node);
  return { '@context': 'https://schema.org', '@graph': graph };
}

const meta = (attrs) => ({ tag: 'meta', attrs });
const link = (attrs) => ({ tag: 'link', attrs });

/**
 * HeadData for a resolved seo object (src/lib/site.js seoFor).
 * opts.jsonLd: false → no JSON-LD; object/array → extra @graph nodes appended to the route graph.
 */
export function headFor(seo, { crumbs, jsonLd } = {}) {
  const tags = [meta({ name: 'description', content: seo.description })];
  if (seo.canonical) tags.push(link({ rel: 'canonical', href: seo.canonical }));
  tags.push(meta({ name: 'robots', content: seo.robots }));
  if (seo.kind === 'utility') tags.push(meta({ name: 'referrer', content: 'no-referrer' })); // functional §12.4 / §13

  tags.push(
    meta({ property: 'og:type', content: seo.ogType }),
    meta({ property: 'og:site_name', content: seo.siteName }),
    meta({ property: 'og:locale', content: seo.ogLocale }),
    meta({ property: 'og:title', content: seo.title }),
    meta({ property: 'og:description', content: seo.description }),
  );
  if (seo.canonical) tags.push(meta({ property: 'og:url', content: seo.canonical }));
  if (seo.ogImage) {
    tags.push(meta({ property: 'og:image', content: seo.ogImage }));
    if (seo.ogImageWidth) tags.push(meta({ property: 'og:image:width', content: String(seo.ogImageWidth) }));
    if (seo.ogImageHeight) tags.push(meta({ property: 'og:image:height', content: String(seo.ogImageHeight) }));
    if (seo.ogImageAlt) tags.push(meta({ property: 'og:image:alt', content: seo.ogImageAlt }));
  }
  tags.push(
    meta({ name: 'twitter:card', content: seo.twitterCard }),
    meta({ name: 'twitter:title', content: seo.title }),
    meta({ name: 'twitter:description', content: seo.description }),
  );
  if (seo.ogImage) {
    tags.push(meta({ name: 'twitter:image', content: seo.ogImage }));
    if (seo.ogImageAlt) tags.push(meta({ name: 'twitter:image:alt', content: seo.ogImageAlt }));
  }

  const ld = jsonLd === false ? null : jsonLdFor(seo, { crumbs, extra: jsonLd && jsonLd !== true ? jsonLd : null });
  return { v: 1, title: seo.title, lang: seo.lang || 'en', tags, jsonLd: ld };
}

const LS = String.fromCharCode(0x2028); // line separator: valid in JSON, not inside a JS string literal
const PS = String.fromCharCode(0x2029); // paragraph separator

/** JSON for embedding in a <script> element. */
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}
