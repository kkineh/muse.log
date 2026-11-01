import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import type { CachedFirstTurn } from './chat.ts';
import {
  BLOG_CHAT_TAG,
  CACHE_REVALIDATE_SECONDS,
  CHAT_MODEL,
  PROMPT_VERSION,
} from './config.ts';
import type { ChatIndex } from './index-text.ts';
import type { PromptPost } from './prompts.ts';
import { fetchIndex, fetchPost } from './queries.ts';

const cacheOptions = {
  revalidate: CACHE_REVALIDATE_SECONDS,
  tags: [BLOG_CHAT_TAG],
};

// Anonymous client: no cookies, so it is safe inside unstable_cache.
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Cached public post index (24h, tag blog-chat). */
export const getIndex: () => Promise<ChatIndex> = unstable_cache(
  () => fetchIndex(anonClient()),
  ['blog-index'],
  cacheOptions
);

/**
 * Cached full text of one published post (24h, tag blog-chat). Called inside
 * the first-turn cache function it bypasses this cache (nested unstable_cache).
 */
export function getPost(slug: string): Promise<PromptPost> {
  return unstable_cache(
    () => fetchPost(anonClient(), slug),
    ['blog-post', slug],
    cacheOptions
  )();
}

/** First-turn answer cache (24h, tag blog-chat); a throw in `compute` stores nothing. */
export function firstTurnCache(
  key: string,
  compute: () => Promise<CachedFirstTurn>
): Promise<CachedFirstTurn> {
  return unstable_cache(
    compute,
    ['chat-first-turn', CHAT_MODEL, PROMPT_VERSION, key],
    cacheOptions
  )();
}
