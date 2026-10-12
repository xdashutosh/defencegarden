// Booking features in the global (Barba-persistent) runtime. Each module is a thin registrar: the actual code
// lives in src/scripts/booking/* and is loaded with import() only on pages that need it, so the home page
// bundle stays small and the map SVG/data never enter the client bundle (the SVG is inlined in the HTML).
//
//   [data-plotmap]         plot map section on /project/1 and /project/5   → booking/map.js
//   [data-booking-track]   /booking/track/:id                              → booking/track.js
//   [data-verify-receipt]  /verify-receipt?token=…                         → booking/verify.js
//
// The utility pages are full page loads (Barba prevents links to them), but a back/forward navigation can
// still bring them in through Barba — registering them here makes both paths work.
import { register } from '../core/page.js';

function lazy(name, selector, load) {
  register({
    name,
    selector,
    init(el) {
      let dead = false;
      let destroy = null;
      load()
        .then((m) => { if (!dead) destroy = m.mount(el); })
        .catch((err) => {
          console.error(`[dg] ${name} failed to load`, err);
          el.dataset.loadError = 'true';
          const fallback = el.querySelector('[data-load-error]');
          if (fallback) fallback.hidden = false;
        });
      return () => {
        dead = true;
        try { destroy?.(); } catch (err) { console.error(err); }
      };
    },
  });
}

lazy('plotmap', '[data-plotmap]', () => import('../booking/map.js'));
lazy('bookingTrack', '[data-booking-track]', () => import('../booking/track.js'));
lazy('verifyReceipt', '[data-verify-receipt]', () => import('../booking/verify.js'));
