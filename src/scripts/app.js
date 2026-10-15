// Global runtime (loaded once; Barba keeps it alive across navigations).
import './core/gsap.js';
import { initScroll } from './core/scroll.js';
import { mountPage } from './core/page.js';
import { resetIntro, releaseIntro } from './core/intro.js';
import './modules/reveal.js';
import './modules/marquee.js';
import './modules/frameHero.js';
import './modules/parallax.js';
import './modules/frames.js';
import './modules/counter.js';
import './modules/headerTone.js';
import './modules/hscroll.js';
import './modules/strip.js';
import './modules/video.js';
import './modules/scrubVideo.js';
import './modules/skylineRise.js';
import './modules/lightbox.js';
import './modules/filter.js';
import './modules/calc.js';
import './modules/plotmap.js';
import { initMenu } from './chrome/menu.js';
import { initEnquiry } from './chrome/enquiry.js';
import { initHeader, markCurrentNav } from './chrome/header.js';
import { runPreloader } from './chrome/preloader.js';
import { initTransitions } from './chrome/transitions.js';
import { initSky } from './chrome/sky.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

initScroll();
initMenu();
initEnquiry();
initHeader();
markCurrentNav();

resetIntro(false);
const container = document.querySelector('[data-barba="container"]');
if (container) mountPage(container);
runPreloader().then(() => releaseIntro());
initSky();
initTransitions();
