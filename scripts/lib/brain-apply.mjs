// plan() 결과를 Storage와 DB에 쓴다. --apply일 때만 brain-publish.mjs가 부른다.
// 설계 §4 순서: 이미지 → posts → tags/post_tags → post_sources → post_links.
// 트랜잭션이 아니다. 중간에 실패하면 던지고, 다시 실행하면 수렴한다(모든 단계 멱등).
import { STORAGE_BUCKET } from './brain-core.mjs';
import { unwrap } from './brain-env.mjs';

export const WRITE_STATUSES = new Set([
  'insert',
  'update',
  'unpublish',
  'orphan-unpublish',
]);

function isDuplicate(error) {
  return (
    String(error.statusCode ?? error.status ?? '') === '409' ||
    /duplicate|already exists/i.test(error.message)
  );
}

async function uploadImages(supabase, uploads, images) {
  let n = 0;
  for (const u of uploads.filter((x) => !x.exists)) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(u.key, images.get(u.vaultPath), {
        contentType: u.contentType,
        cacheControl: '31536000',
        upsert: false,
      });
    if (error && !isDuplicate(error)) {
      throw new Error(`이미지 업로드 ${u.vaultPath}: ${error.message}`);
    }
    if (!error) n++;
  }
  return n;
}

async function writePosts(supabase, actions, idBySlug) {
  let n = 0;
  for (const a of actions) {
    if (a.status === 'insert') {
      const row = unwrap(
        await supabase.from('posts').insert(a.fields).select('id').single(),
        `posts insert ${a.slug}`
      );
      a.postId = row.id;
      idBySlug.set(a.slug, row.id);
      n++;
    } else if (
      WRITE_STATUSES.has(a.status) &&
      Object.keys(a.fields).length > 0
    ) {
      unwrap(
        await supabase.from('posts').update(a.fields).eq('id', a.postId),
        `posts update ${a.slug}`
      );
      n++;
    }
  }
  return n;
}

async function writeTags(supabase, result, tags) {
  const counts = { tags: 0, postTags: 0 };
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));
  if (result.newTags.length > 0) {
    const created = unwrap(
      await supabase.from('tags').insert(result.newTags).select('id, name'),
      'tags insert'
    );
    for (const t of created) tagIdByName.set(t.name, t.id);
    counts.tags = created.length;
  }
  for (const a of result.actions.filter((x) => x.tags)) {
    if (a.tags.remove.length > 0) {
      unwrap(
        await supabase
          .from('post_tags')
          .delete()
          .eq('post_id', a.postId)
          .in('tag_id', a.tags.remove),
        `post_tags delete ${a.slug}`
      );
      counts.postTags += a.tags.remove.length;
    }
    if (a.tags.add.length > 0) {
      const rows = a.tags.add.map((name) => ({
        post_id: a.postId,
        tag_id: tagIdByName.get(name),
      }));
      unwrap(
        await supabase.from('post_tags').insert(rows),
        `post_tags insert ${a.slug}`
      );
      counts.postTags += rows.length;
    }
  }
  return counts;
}

async function writeSources(supabase, actions) {
  let n = 0;
  for (const a of actions.filter((x) => x.sourcePath)) {
    const row = {
      post_id: a.postId,
      source_path: a.sourcePath,
      updated_at: new Date().toISOString(),
    };
    unwrap(
      await supabase
        .from('post_sources')
        .upsert(row, { onConflict: 'post_id' }),
      `post_sources ${a.slug}`
    );
    n++;
  }
  return n;
}

async function writeLinks(supabase, actions, idBySlug) {
  let n = 0;
  for (const a of actions.filter((x) => x.links)) {
    if (a.status !== 'insert') {
      unwrap(
        await supabase
          .from('post_links')
          .delete()
          .eq('source_post_id', a.postId),
        `post_links delete ${a.slug}`
      );
      n++;
    }
    const rows = a.links.map((slug) => ({
      source_post_id: a.postId,
      target_post_id: idBySlug.get(slug),
    }));
    if (rows.length > 0) {
      unwrap(
        await supabase.from('post_links').insert(rows),
        `post_links insert ${a.slug}`
      );
      n += rows.length;
    }
  }
  return n;
}

/**
 * @returns {Promise<{uploads: number, posts: number, tags: number, postTags: number, sources: number, links: number}>}
 */
export async function applyPlan(supabase, result, db, images) {
  const idBySlug = new Map(db.posts.map((p) => [p.slug, p.id]));
  const uploads = await uploadImages(supabase, result.uploads, images);
  const posts = await writePosts(supabase, result.actions, idBySlug);
  const tagCounts = await writeTags(supabase, result, db.tags);
  const sources = await writeSources(supabase, result.actions);
  const links = await writeLinks(supabase, result.actions, idBySlug);
  return { uploads, posts, ...tagCounts, sources, links };
}
