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

export const serverEnv = {
  supabaseUrl: SUPABASE_URL,
  supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: SUPABASE_SECRET_KEY,
  ownerSetupToken: OWNER_SETUP_TOKEN,
  turnstileSiteKey: TURNSTILE_SITE_KEY,
  turnstileSecretKey: TURNSTILE_SECRET_KEY,
  googleLoginEnabled: GOOGLE_LOGIN_ENABLED,
  contentSource: LAHZA_CONTENT_SOURCE,
};

/** True when the database, auth and storage are configured. */
export const backendConfigured = () =>
  Boolean(serverEnv.supabaseUrl && serverEnv.supabasePublishableKey && serverEnv.supabaseSecretKey);

export const turnstileEnabled = () => Boolean(serverEnv.turnstileSiteKey && serverEnv.turnstileSecretKey);

export const supabaseOrigin = () => (serverEnv.supabaseUrl ? new URL(serverEnv.supabaseUrl).origin : undefined);
