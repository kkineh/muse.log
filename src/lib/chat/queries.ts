import type { SupabaseClient } from '@supabase/supabase-js';
import { buildIndex, type ChatIndex, type IndexRow } from './index-text.ts';
import type { PromptPost } from './prompts.ts';

/** Read the public post index. Throws on error or empty so nothing is cached. */
export async function fetchIndex(client: SupabaseClient): Promise<ChatIndex> {
  const { data, error } = await client
    .from('blog_index')
    .select('category_path,title,slug,excerpt,created_at')
    .order('created_at', { ascending: false });
  if (error || !data || data.length === 0) {
    throw new Error('blog_index unavailable');
  }
  return buildIndex(data as IndexRow[]);
}

/** Read one published post. Throws on error or missing so null is never cached. */
export async function fetchPost(
  client: SupabaseClient,
  slug: string
): Promise<PromptPost> {
  const { data, error } = await client
    .from('posts')
    .select('slug,title,content')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error || !data) throw new Error('post unavailable');
  return data as PromptPost;
}
