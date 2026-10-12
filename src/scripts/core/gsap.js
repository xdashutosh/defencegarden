import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
CustomEase.create('dgOut', '0.22,1,0.36,1');
CustomEase.create('dgInOut', '0.76,0,0.24,1');
gsap.defaults({ ease: 'dgOut', duration: 1 });
ScrollTrigger.config({ ignoreMobileResize: true });

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isDesktop = () => window.matchMedia('(min-width: 861px)').matches;
export { gsap, ScrollTrigger, SplitText, CustomEase };
