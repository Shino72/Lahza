import {
  GOOGLE_LOGIN_ENABLED,
  LAHZA_CONTENT_SOURCE,
  OWNER_SETUP_TOKEN,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY,
  SUPABASE_URL,
  TURNSTILE_SECRET_KEY,
  TURNSTILE_SITE_KEY,
} from 'astro:env/server';
import { parseServerEnv } from './env-parse';

export const serverEnv = parseServerEnv(
  {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY,
    OWNER_SETUP_TOKEN,
    TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY,
    GOOGLE_LOGIN_ENABLED,
    LAHZA_CONTENT_SOURCE,
  },
  (message) => console.error(`configuration: ${message}`),
);

/** True when the database, auth and storage are configured. */
export const backendConfigured = () =>
  Boolean(serverEnv.supabaseUrl && serverEnv.supabasePublishableKey && serverEnv.supabaseSecretKey);

export const turnstileEnabled = () => Boolean(serverEnv.turnstileSiteKey && serverEnv.turnstileSecretKey);

export const supabaseOrigin = () => (serverEnv.supabaseUrl ? new URL(serverEnv.supabaseUrl).origin : undefined);
