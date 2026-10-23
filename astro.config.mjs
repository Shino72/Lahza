import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL ?? 'https://lahza-tau.vercel.app';

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Keep styles and scripts in external files so the CSP can stay free of 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  devToolbar: {
    enabled: false,
  },
});
