/**
 * Development-only renderer entry: the Vite dev server landing page, which
 * immediately redirects the shell to the configured SoundKit web app URL so
 * the dev experience matches the packaged app. The error page stays available
 * at /error.html for iteration.
 */
/* oxlint-disable eslint/no-underscore-dangle -- Vite build-time define, set in vite.renderer.config.ts. */
declare const __SOUNDKIT_APP_URL__: string;

window.location.replace(__SOUNDKIT_APP_URL__);
