export interface ServerEnv {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseSecretKey?: string;
  ownerSetupToken?: string;
  turnstileSiteKey?: string;
  turnstileSecretKey?: string;
  googleLoginEnabled: boolean;
  contentSource: 'auto' | 'demo' | 'supabase';
}

type Raw = Record<string, string | undefined>;

const clean = (value: string | undefined) => {
  const v = value?.trim();
  return v ? v : undefined;
};

/**
 * Normalises deployment settings. An invalid value is reported and treated as
 * unset, so one bad setting cannot take the public site down.
 */
export function parseServerEnv(raw: Raw, warn: (message: string) => void): ServerEnv {
  let supabaseUrl = clean(raw.SUPABASE_URL);
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error();
      supabaseUrl = url.origin;
    } catch {
      warn('SUPABASE_URL must look like https://<project>.supabase.co; ignoring it');
      supabaseUrl = undefined;
    }
  }

  const google = clean(raw.GOOGLE_LOGIN_ENABLED)?.toLowerCase();
  if (google && google !== 'true' && google !== 'false') warn('GOOGLE_LOGIN_ENABLED must be true or false; treating it as false');

  const source = clean(raw.LAHZA_CONTENT_SOURCE)?.toLowerCase() ?? 'auto';
  const contentSource = source === 'demo' || source === 'supabase' || source === 'auto' ? source : 'auto';
  if (contentSource !== source) warn('LAHZA_CONTENT_SOURCE must be auto, demo or supabase; using auto');

  return {
    supabaseUrl,
    supabasePublishableKey: clean(raw.SUPABASE_PUBLISHABLE_KEY),
    supabaseSecretKey: clean(raw.SUPABASE_SECRET_KEY),
    ownerSetupToken: clean(raw.OWNER_SETUP_TOKEN),
    turnstileSiteKey: clean(raw.TURNSTILE_SITE_KEY),
    turnstileSecretKey: clean(raw.TURNSTILE_SECRET_KEY),
    googleLoginEnabled: google === 'true',
    contentSource,
  };
}
