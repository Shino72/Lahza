// Stands in for `rolldown`, which the Vercel adapter imports for build-time
// helpers that end up in the server bundle (see astro.config.mjs). Nothing
// calls it at runtime; if something ever does, fail loudly.
export function rolldown() {
  throw new Error('rolldown is not available in the deployed server');
}
