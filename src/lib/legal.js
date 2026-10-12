// =============================================================================
// src/lib/legal.js — the four policy documents (src/data/legal/*.md) as structured data (build-time).
//
//   legalDocs                → [doc, …] in footer order (privacy, terms, data-deletion, refund)
//   getLegalDoc(slugOrPath)  → doc | null    ('privacy-policy' or '/privacy-policy')
//   inlineHtml(text)         → escaped HTML with markdown links/bold/italics and auto-linked email & +91 phones
//
// doc = {
//   slug, path, title, effectiveDate, seoTitle, runtimeTitle, description,   // front matter
//   intro: [string],                                                         // paragraphs before section 1
//   sections: [{ id, number, title, heading, paragraphs: [string] }],        // "## 1. Information We Collect"
//   contact: { heading, lines: [string], links: [{ label, href }] } | null,   // block after the "---" rule
//   related: [{ label, href }]                                               // links to the other policies
// }
// Paragraph strings are verbatim markdown text; render them with inlineHtml().
// =============================================================================

const MODULES = import.meta.glob('/src/data/legal/*.md', { eager: true });
const ORDER = ['privacy-policy', 'terms', 'data-deletion', 'refund-policy'];

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const LINK_ITEM = /^[-*]\s+\[([^\]]+)\]\(([^)\s]+)\)\s*$/;

function paragraphs(lines) {
  const out = [];
  let buf = [];
  const flush = () => {
    if (buf.length) out.push(buf.join(' ').trim());
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) flush();
    else buf.push(line);
  }
  flush();
  return out.filter(Boolean);
}

function parse(raw, fm, slug) {
  const text = String(raw).replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const hr = lines.findIndex((l) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l));
  const body = hr === -1 ? lines : lines.slice(0, hr);
  const tail = hr === -1 ? [] : lines.slice(hr + 1);

  const intro = [];
  const sections = [];
  let current = null;
  let chunk = [];
  const close = () => {
    const paras = paragraphs(chunk).filter((p) => !/^effective date\s*:/i.test(p));
    if (current) current.paragraphs = paras;
    else intro.push(...paras);
    chunk = [];
  };
  for (const line of body) {
    if (/^#\s/.test(line)) continue; // the H1 duplicates front-matter title
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      close();
      const heading = h2[1];
      const m = heading.match(/^(\d+)[.)]\s*(.+)$/);
      current = { id: slugify(m ? m[2] : heading), number: m ? m[1] : null, title: m ? m[2] : heading, heading, paragraphs: [] };
      sections.push(current);
      continue;
    }
    chunk.push(line);
  }
  close();

  // tail: "## Contact Us", address line(s), link list (mailto/tel), then links to the other policies
  let contact = null;
  const related = [];
  if (tail.length) {
    contact = { heading: 'Contact Us', lines: [], links: [] };
    const plain = [];
    for (const line of tail) {
      const h = line.match(/^##\s+(.+?)\s*$/);
      if (h) {
        contact.heading = h[1];
        continue;
      }
      const li = line.trim().match(LINK_ITEM);
      if (li) {
        const item = { label: li[1], href: li[2] };
        if (/^(mailto:|tel:|https?:)/i.test(item.href)) contact.links.push(item);
        else related.push(item);
        continue;
      }
      plain.push(line);
    }
    contact.lines = paragraphs(plain);
  }

  return {
    slug,
    path: fm.path || `/${slug}`,
    title: fm.title,
    effectiveDate: fm.effectiveDate || null,
    seoTitle: fm.seoTitle || null,
    runtimeTitle: fm.runtimeTitle || null,
    description: fm.description || null,
    intro,
    sections,
    contact,
    related,
  };
}

export const legalDocs = Object.entries(MODULES)
  .map(([file, mod]) => {
    const slug = file.split('/').pop().replace(/\.md$/, '');
    const raw = typeof mod.rawContent === 'function' ? mod.rawContent() : '';
    return parse(raw, mod.frontmatter || {}, slug);
  })
  .sort((a, b) => {
    const ia = ORDER.indexOf(a.slug), ib = ORDER.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

export function getLegalDoc(slugOrPath) {
  const k = String(slugOrPath || '').replace(/^\/+|\/+$/g, '');
  return legalDocs.find((d) => d.slug === k || d.path === '/' + k) || null;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped HTML for one markdown paragraph: [text](href), **bold**, *em*, emails → mailto:, +91 numbers → tel:. */
export function inlineHtml(text) {
  const tokens = [];
  const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = String(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => keep(`<a class="text-link" href="${esc(href)}">${esc(label)}</a>`));
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => keep(`<a class="text-link" href="mailto:${esc(m)}">${esc(m)}</a>`));
  s = s.replace(/\+91[\s-]?\d{5}[\s-]?\d{5}/g, (m) => keep(`<a class="text-link" href="tel:+91${m.replace(/\D/g, '').slice(2)}">${esc(m)}</a>`));
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}
