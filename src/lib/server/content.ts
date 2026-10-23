import { demoRepository, emptyRepository, type PublicRepository } from '../../content/repository';
import { backendConfigured, serverEnv } from './env';
import { getPublicClient } from './supabase';
import { supabaseRepository } from './supabase-repository';

/**
 * Database content when Supabase is configured. Sample content is used only
 * outside production (or when explicitly requested), so a misconfigured
 * production deployment shows an empty site rather than sample stories.
 */
export function getRepository(): PublicRepository {
  const source = serverEnv.contentSource;
  if (source === 'supabase' || (source === 'auto' && backendConfigured())) {
    return supabaseRepository(getPublicClient(), serverEnv.supabaseUrl!);
  }
  if (source === 'demo' || process.env.VERCEL_ENV !== 'production') return demoRepository();
  return emptyRepository();
}
