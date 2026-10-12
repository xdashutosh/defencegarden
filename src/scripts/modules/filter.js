// [data-filter] root: buttons [data-filter-btn="value"] (value "all" shows everything) filter items
// [data-filter-item][data-tags="a b c"]; optional [data-filter-count] shows the visible count. URL ?f=value kept in sync.
import { gsap, ScrollTrigger } from '../core/gsap.js';
import { register } from '../core/page.js';
import { scrollToEl } from '../core/scroll.js';

register({
  name: 'filter',
  selector: '[data-filter]',
  init(root) {
    const btns = [...root.querySelectorAll('[data-filter-btn]')];
    const items = [...root.querySelectorAll('[data-filter-item]')];
    const count = root.querySelector('[data-filter-count]');
    const apply = (val, animate = true) => {
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterBtn === val)));
      let n = 0;
      items.forEach((it) => {
        const show = val === 'all' || (it.dataset.tags || '').split(/\s+/).includes(val);
        it.hidden = !show; if (show) n++;
      });
      if (count) count.textContent = String(n).padStart(2, '0');
      if (animate) gsap.fromTo(items.filter((x) => !x.hidden), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.04 });
      const u = new URL(location.href);
      if (val === 'all') u.searchParams.delete('f'); else u.searchParams.set('f', val);
      history.replaceState(history.state, '', u);
      ScrollTrigger.refresh();
    };
    const onClick = (e) => {
      const b = e.target.closest('[data-filter-btn]');
      if (!b) return;
      apply(b.dataset.filterBtn);
      // the list may have shrunk under the reader: bring the top of the filtered area back into view
      if (root.getBoundingClientRect().top < 0) scrollToEl(root, -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80));
    };
    root.addEventListener('click', onClick);
    const initial = new URL(location.href).searchParams.get('f');
    if (initial && btns.some((b) => b.dataset.filterBtn === initial)) apply(initial, false);
    return () => root.removeEventListener('click', onClick);
  },
});
