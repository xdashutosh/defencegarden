// "Enquire" modal → composes a WhatsApp message to the sales number (nothing is posted anywhere).
import { stopScroll, startScroll } from '../core/scroll.js';
import { closeMenu } from './menu.js';

let lastFocus = null;
const modal = () => document.querySelector('[data-enquiry]');

function openModal(prefill = {}) {
  const m = modal(); if (!m) return;
  lastFocus = document.activeElement;
  const form = m.querySelector('form');
  if (prefill.interest) { const s = form.elements.interest; [...s.options].forEach((o) => { if (o.text === prefill.interest) s.value = o.value; }); }
  if (prefill.colony) { const s = form.elements.colony; [...s.options].forEach((o) => { if (o.text === prefill.colony) s.value = o.value; }); }
  m.hidden = false; stopScroll();
  requestAnimationFrame(() => m.classList.add('is-open'));
  setTimeout(() => form.elements.name.focus(), 80);
}
function closeModal() {
  const m = modal(); if (!m || m.hidden) return;
  m.classList.remove('is-open'); startScroll();
  setTimeout(() => { m.hidden = true; }, 500);
  lastFocus?.focus?.();
}

export function initEnquiry() {
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-enquire]');
    if (t) { e.preventDefault(); await closeMenu(true); openModal({ interest: t.dataset.interest, colony: t.dataset.colony }); return; }
    if (e.target.closest('[data-enquiry-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    const m = modal();
    if (!m || m.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') { // focus trap
      const f = [...m.querySelectorAll('button, input, select, textarea, a[href]')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  const form = document.querySelector('[data-enquiry-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const phone = String(d.phone || '').replace(/[^\d+]/g, '');
    const err = form.querySelector('[data-enquiry-error]');
    if (!String(d.name || '').trim() || phone.replace(/\D/g, '').length < 10) { err.hidden = false; return; }
    err.hidden = true;
    const lines = ['*New enquiry — Defence Garden website*', '', `*Name:* ${d.name}`, `*Phone:* ${phone}`, `*Interested in:* ${d.interest}`];
    if (d.colony) lines.push(`*Colony:* ${d.colony}`);
    if (String(d.message || '').trim()) lines.push(`*Message:* ${d.message}`);
    window.open(`https://wa.me/${form.dataset.wa}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    closeModal();
  });
}
