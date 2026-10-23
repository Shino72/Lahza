import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { defineConfig, envField } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL ?? 'https://lahza-six.vercel.app';

// Vercel in deployment; the Node adapter runs the same server build for local end-to-end tests.
const adapter = process.env.LAHZA_ADAPTER === 'node' ? node({ mode: 'standalone' }) : vercel();

export default defineConfig({
  site,
  output: 'server',
  adapter,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Keep styles and scripts in external files so the CSP can stay free of 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  security: {
    checkOrigin: true,
  },
  env: {
    // Values are checked in src/lib/server/env.ts so a malformed setting is ignored and logged
    // instead of failing every request.
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      OWNER_SETUP_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SITE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_LOGIN_ENABLED: envField.string({ context: 'server', access: 'secret', optional: true }),
      LAHZA_CONTENT_SOURCE: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
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
