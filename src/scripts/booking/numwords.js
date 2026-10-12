// Amount in words, Indian numbering system (functional spec §4.3). 1000 → 'Rupees One Thousand Only'.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const three = (n) => {
  const h = Math.floor(n / 100), r = n % 100;
  const H = h ? ONES[h] + ' Hundred' : '';
  return r ? (H ? H + ' ' + two(r) : two(r)) : H;
};

export function words(x) {
  let n = Math.floor(Math.abs(Number(x) || 0));
  if (!n) return 'Zero';
  const p = [];
  const cr = Math.floor(n / 1e7), lk = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (cr) p.push((cr < 100 ? two(cr) : three(cr % 1000)) + ' Crore');
  if (lk) p.push(two(lk) + ' Lakh');
  if (th) p.push(two(th) + ' Thousand');
  if (rest) p.push(three(rest));
  return p.join(' ').trim();
}

export function rupeesInWords(x) {
  const v = Math.abs(Number(x) || 0);
  const r = Math.floor(v);
  const paise = Math.round((v - r) * 100);
  return `Rupees ${words(r)}${paise > 0 ? ` and ${two(paise)} Paise` : ''} Only`;
}
