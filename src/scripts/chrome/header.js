import { onScroll } from '../core/scroll.js';

export function initHeader() {
  const hdr = document.querySelector('[data-hdr]');
  const dock = document.querySelector('[data-dock]');
  let last = 0;
  onScroll(({ scroll }) => {
    const y = scroll ?? window.scrollY;
    const down = y > last && y > 160;
    hdr?.classList.toggle('is-hidden', down && !document.documentElement.classList.contains('menu-open'));
    last = y;
  });
  // the dock hides near the footer
  if (dock) {
    const check = () => {
      const f = document.querySelector('.ftr');
      if (!f) return dock.classList.remove('is-hidden');
      dock.classList.toggle('is-hidden', f.getBoundingClientRect().top < window.innerHeight * 0.85);
    };
    onScroll(check); window.addEventListener('resize', check);
  }
}

export function markCurrentNav(pathname = location.pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const href = a.dataset.nav;
    const on = href === '/' ? p === '/' : p === href || p.startsWith(href + '/') || (href === '/ourproject' && p.startsWith('/project/'));
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
