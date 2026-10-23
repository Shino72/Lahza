import { demoRepository, type PublicRepository } from '../../content/repository';
import { backendConfigured, serverEnv } from './env';
import { getPublicClient } from './supabase';
import { supabaseRepository } from './supabase-repository';

/** Database content when Supabase is configured; labelled sample content otherwise. */
export function getRepository(): PublicRepository {
  const useSupabase =
    serverEnv.contentSource === 'supabase' || (serverEnv.contentSource === 'auto' && backendConfigured());
  if (useSupabase) return supabaseRepository(getPublicClient(), serverEnv.supabaseUrl!);
  return demoRepository();
}
