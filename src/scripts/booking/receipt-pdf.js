// =============================================================================
// Signed PDF booking receipt (functional spec §4) — a 1:1 port of the old site's bookingReceipt chunk
// (same A4 layout, "RiverGreen" sales identity, QR → /verify-receipt?token=…), with the two small defects
// fixed ("IN FIGURES" overflowing the margin, "1 entries").
//
// Import ONLY with import('./receipt-pdf.js'): jspdf + jspdf-autotable + qrcode (~130 KB gzip) must stay out
// of the global bundle. Read-only: GET /bookings/track/:id/receipt-token. The PDF is built in the browser.
// =============================================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { getJSON, DEFAULT_API } from './api.js';
import { inr2 } from './format.js';
import { rupeesInWords } from './numwords.js';

const C = {
  ink: [15, 23, 42], ink2: [30, 41, 59], muted: [100, 116, 139], faint: [148, 163, 184],
  line: [203, 213, 225], tint: [241, 245, 249], red: [185, 28, 28], amber: [180, 83, 9],
};
const M = 16, RIGHT = 194, CW = 178;

const d = (v) => { if (!v) return null; const x = new Date(v); return Number.isNaN(x.getTime()) ? null : x; };
const date2 = (v) => { const x = d(v); return x ? x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
const rs = (v) => 'Rs. ' + inr2(v);

/** GET the signed token + booking/payment data for a booking id. */
export async function fetchReceiptData(id, { api = DEFAULT_API, signal } = {}) {
  let body;
  try {
    body = await getJSON(api, `/bookings/track/${encodeURIComponent(id)}/receipt-token`, { signal });
  } catch (err) {
    if (err?.kind === 'http' && err.status === 404) {
      const e = new Error('The receipt is not available for this booking yet. Please contact our team.');
      e.kind = 'http';
      throw e;
    }
    throw err;
  }
  if (!body || !body.success || !body.token || !body.verifyUrl) throw new Error('Backend returned no token');
  return body;
}

/** Build the jsPDF document from the receipt-token payload. */
export async function buildPublicBookingReceipt(data, { signatoryName = 'RiverGreen Sales' } = {}) {
  const booking = data.booking || {};
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const summary = data.paymentSummary || {};
  const receiptNo = String(data.receiptNo || '—');
  const verifyUrl = String(data.verifyUrl || '');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const ink = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const draw = (c, w) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); };
  const font = (style = 'normal', size = 10, family = 'helvetica') => { doc.setFont(family, style); doc.setFontSize(size); };

  const totalAmt = Number(booking.total_amount || 0);
  const paid = Number(summary.total_paid || booking.total_paid || 0);
  const bookingAmt = Number(booking.booking_amount || 0);
  const remaining = Math.max(0, totalAmt - paid);
  const completed = payments
    .filter((p) => String(p?.status || '').toUpperCase() === 'COMPLETED')
    .sort((a, b) => (d(b.payment_date || b.created_at)?.getTime() || 0) - (d(a.payment_date || a.created_at)?.getTime() || 0));
  const mode = String(completed[0]?.payment_method || booking.payment_type || 'CASH').toUpperCase();

  // ---- header
  fill(C.ink); doc.rect(16, 16, 14, 14, 'F');
  font('bold', 11); doc.setTextColor(255, 255, 255); doc.text('RG', 23, 25.5, { align: 'center' });
  font('bold', 15); ink(C.ink); doc.text('RiverGreen', 34, 22.5);
  font('normal', 8.5); ink(C.muted); doc.text('Premium Plotted Developments', 34, 27);
  font('normal', 7.5); doc.text('www.defencegarden.com', 34, 30.5);
  draw(C.ink, 0.8); doc.line(M, 34, RIGHT, 34);
  draw(C.line, 0.2); doc.line(M, 35.2, RIGHT, 35.2);
  let y = 40;

  // ---- meta row
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  [
    ['Receipt No.', receiptNo, 'courier'],
    ['Receipt Date', today],
    ['Payment Mode', mode],
    ['Status', String(booking.status || '—').toUpperCase()],
  ].forEach(([label, value, family], i) => {
    const x = M + i * 44.5;
    font('normal', 7); ink(C.muted); doc.text(label.toUpperCase(), x, y, { charSpace: 1 });
    font('bold', 10, family || 'helvetica'); ink(C.ink);
    let size = 10;
    while (size > 6.5 && doc.getTextWidth(String(value)) > 42) { size -= 0.5; doc.setFontSize(size); }
    doc.text(String(value), x, y + 5);
  });
  draw(C.line, 0.2); doc.line(M, y + 9, RIGHT, y + 9);
  y += 14;

  const section = (title, right) => {
    font('bold', 8.5); ink(C.ink); doc.text(title.toUpperCase(), M, y, { charSpace: 1.5 });
    if (right) { font('normal', 7.5); ink(C.muted); doc.text(right, RIGHT, y, { align: 'right' }); }
    draw(C.ink, 0.3); doc.line(M, y + 1.5, RIGHT, y + 1.5);
    y += 5;
  };

  // ---- received with thanks from
  section('Received with thanks from');
  font('bold', 13); ink(C.ink); doc.text(String(booking.client_name || '—'), M, y + 5);
  const contact = [booking.client_phone, booking.client_email].filter(Boolean).join('   ·   ');
  if (contact) { font('normal', 8.5); ink(C.muted); doc.text(contact, M, y + 10); y += 14; } else y += 10;
  fill(C.tint); doc.rect(M, y, CW, 18, 'F');
  font('normal', 7.5); ink(C.muted); doc.text('THE SUM OF', 20, y + 5, { charSpace: 1.2 });
  font('bold', 10); ink(C.ink); doc.text(doc.splitTextToSize(rupeesInWords(paid), 89.9).slice(0, 2), 20, y + 11);
  // fix: the old version drew this with charSpace and right alignment, which overflowed the margin
  font('normal', 7.5); ink(C.muted); doc.text('IN FIGURES', 190, y + 5, { align: 'right' });
  font('bold', 18); ink(C.ink); doc.text(rs(paid), 190, y + 14, { align: 'right' });
  y += 22;

  // ---- being payment towards
  section('Being payment towards');
  y += 3;
  const towards = `Booking of Plot No. ${booking.plot_number || '—'}${booking.block ? `, Block ${booking.block}` : ''}, ${booking.colony_name || 'RiverGreen'}.`;
  font('normal', 10); ink(C.ink2);
  doc.splitTextToSize(towards, CW).forEach((l) => { doc.text(l, M, y); y += 5; });
  if (booking.notes) {
    font('italic', 8.5); ink(C.muted);
    doc.splitTextToSize(`Notes: ${booking.notes}`, CW).forEach((l) => { doc.text(l, M, y); y += 4; });
  }
  y += 3;

  // ---- property details | payment summary
  section('Property details', 'Payment summary');
  const top = y;
  draw(C.line, 0.2); doc.line(105, top, 105, top + 42);
  const left = [
    ['Site / Project', booking.colony_name || 'RiverGreen'],
    ['Plot Number', booking.plot_number || '—'],
    ['Block', booking.block || '—'],
    ['Plot Type', booking.plot_type || '—'],
    ['Area', booking.area_sqft ? `${booking.area_sqft} sqft` : '—'],
    ['Dimensions', booking.dimensions || '—'],
    ['Facing', booking.facing || '—'],
    ['Booking Date', date2(booking.booking_date || booking.created_at)],
  ];
  let ly = top + 2;
  left.forEach(([k, v]) => {
    font('normal', 8.5); ink(C.muted); doc.text(k, M, ly);
    font('bold', 8.5); ink(C.ink2);
    const lines = doc.splitTextToSize(String(v), 55);
    doc.text(lines, 46, ly);
    ly += 5 * Math.max(1, lines.length);
  });
  const plan = String(booking.payment_type || '').toUpperCase() === 'INSTALLMENT'
    ? `Installment · ${booking.installment_count || 1} × ${booking.installment_frequency || ''}`.trim()
    : 'One-Time';
  const right = [
    ['Total Plot Price', rs(totalAmt), C.ink],
    ['Booking Amount', rs(bookingAmt), C.ink2],
    ['Total Paid', rs(paid), C.ink2],
    ['Balance Due', rs(remaining), remaining > 0 ? C.amber : C.ink],
    ['Payment Plan', plan, C.ink],
  ];
  let ry = top + 2;
  right.forEach(([k, v, c]) => {
    font('normal', 8.5); ink(C.muted); doc.text(k, 109, ry);
    font('bold', 8.5); ink(c); doc.text(String(v), RIGHT, ry, { align: 'right' });
    ry += 5;
  });
  draw(C.ink, 0.4); doc.line(109, top + 18.5, RIGHT, top + 18.5);
  y = Math.max(ly, ry) + 4;

  // ---- payment ledger
  if (payments.length) {
    section('Payment ledger', `${payments.length} ${payments.length === 1 ? 'entry' : 'entries'}`);
    const statusColor = (s) => {
      const v = String(s || '').toUpperCase();
      return v === 'PENDING' ? C.amber : v === 'CANCELLED' || v === 'FAILED' ? C.red : C.ink;
    };
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Type', 'Paid On', 'Due', 'Method', 'Reference', 'Amount', 'Status']],
      body: payments.map((p, i) => [
        i + 1,
        String(p.payment_type || '—') + (Number(p.installment_number) > 0 ? ` #${p.installment_number}` : ''),
        date2(p.payment_date),
        date2(p.due_date),
        p.payment_method || '—',
        p.transaction_id || p.upi_id || '—',
        rs(p.amount),
        p.status || '—',
      ]),
      theme: 'plain',
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, lineColor: C.line, lineWidth: 0.15, textColor: C.ink2, valign: 'middle' },
      headStyles: { fillColor: [255, 255, 255], textColor: C.ink, fontStyle: 'bold', fontSize: 7.5, halign: 'left', lineColor: C.ink, lineWidth: 0.4 },
      alternateRowStyles: { fillColor: C.tint },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center', textColor: C.muted },
        1: { cellWidth: 24, fontStyle: 'bold' },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 'auto', fontSize: 7.5 },
        6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 22, fontStyle: 'bold' },
      },
      didParseCell: (h) => { if (h.section === 'body' && h.column.index === 7) h.cell.styles.textColor = statusColor(h.cell.raw); },
    });
    y = (doc.lastAutoTable?.finalY || y) + 4;
  }

  // ---- verification | authorised signatory
  if (y + 52 > 268) { doc.addPage(); y = 20; }
  section('Verification', 'Authorized signatory');
  fill([255, 255, 255]); draw(C.ink, 0.4); doc.rect(M, y + 2, 44, 44, 'FD');
  try {
    const png = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f172a', light: '#ffffff' }, width: 700 });
    doc.addImage(png, 'PNG', 18, y + 4, 40, 40);
  } catch {
    font('italic', 8); ink(C.muted); doc.text('QR unavailable', 38, y + 24, { align: 'center' });
  }
  font('bold', 9); ink(C.ink); doc.text('Scan to verify', 66, y + 7);
  font('normal', 8); ink(C.ink2);
  const desc = doc.splitTextToSize('This receipt is digitally signed with HMAC-SHA256 and can be verified at:', 33);
  doc.text(desc, 66, y + 13);
  font('bold', 8); ink(C.ink); doc.text('www.defencegarden.com/verify-receipt', 66, Math.max(y + 31, y + 13 + desc.length * 3.6 + 4));
  font('normal', 8.5); ink(C.muted); doc.text('For RiverGreen Sales,', 109, y + 5);
  draw(C.ink, 0.4); doc.line(109, y + 36, 184, y + 36);
  font('bold', 9); ink(C.ink); doc.text(String(signatoryName), 109, y + 41);
  font('normal', 7.5); ink(C.muted); doc.text('Authorized Signatory', 109, y + 45);

  // ---- footer on every page
  const issued = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    draw(C.line, 0.2); doc.line(M, 272, RIGHT, 272);
    font('normal', 7); ink(C.muted);
    doc.text('This is a system-generated, cryptographically signed receipt and does not require a physical signature.', M, 276);
    doc.text('HMAC-SHA256  ·  Tamper-evident  ·  Verifiable at www.defencegarden.com/verify-receipt', M, 279.5);
    ink(C.faint);
    doc.text(`Issued ${issued}`, RIGHT, 276, { align: 'right' });
    doc.text(`Page ${i} of ${pages}`, RIGHT, 279.5, { align: 'right' });
  }
  return { doc, fileName: `RiverGreen-${receiptNo.replace(/\s+/g, '_')}.pdf` };
}

/** Fetch + build + save. Errors bubble to the caller (shown under the button). */
export async function downloadPublicBookingReceipt(id, { api, signal, signatoryName } = {}) {
  const data = await fetchReceiptData(id, { api, signal });
  if (signal?.aborted) return null;
  const { doc, fileName } = await buildPublicBookingReceipt(data, { signatoryName });
  doc.save(fileName);
  return fileName;
}
