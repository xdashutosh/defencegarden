// Resolves when the page may play its intro (after the preloader on a first visit, immediately otherwise).
let resolveIntro;
let introPromise = new Promise((r) => (resolveIntro = r));
export const whenIntro = () => introPromise;
export function releaseIntro() { resolveIntro(); }
export function resetIntro(ready = true) { introPromise = ready ? Promise.resolve() : new Promise((r) => (resolveIntro = r)); }
