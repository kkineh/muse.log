import { revalidatePath, revalidateTag } from 'next/cache';
import { BLOG_CHAT_TAG } from '@/lib/chat/config';

/**
 * Purge cached category data after a write.
 *
 * The category GET is edge-cached for 24h (s-maxage=86400); without this the
 * admin list and public pages keep serving a stale tree long after a create,
 * edit, delete or reorder.
 */
export function revalidateCategories() {
  revalidatePath('/api/categories');
  revalidatePath('/admin/categories');
  revalidatePath('/', 'layout');
}

/**
 * Purge the chat's cached index, post bodies and first-turn answers.
 * `revalidatePath` does not clear unstable_cache entries, so the tag is needed.
 */
export function revalidateBlogChat() {
  revalidateTag(BLOG_CHAT_TAG, { expire: 0 });
}
