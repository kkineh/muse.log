// plan()의 쓰기 계획 단계: 검사를 통과한 글을 insert/update/unpublish 등의 action으로 바꾼다. 순수 함수.
import { generateSlug, insertCreatedAt, kstDate } from './brain-core.mjs';

const BRAIN_OWNED = ['title', 'content', 'excerpt', 'published'];

export function buildActions(ctx, scans) {
  const actions = [];
  const newTags = new Map();
  const handled = new Set();
  let reindexCount = 0;

  for (const n of ctx.parsed) {
    if (n.error) continue;
    if (n.data.publish === true) {
      const a = publishAction(n, scans.get(n.path), ctx, newTags);
      if (a.postId) handled.add(a.postId);
      if (a.reindex) reindexCount++;
      actions.push(a);
      continue;
    }
    const slug = n.data.slug;
    // slug로 찾는 것은 다른 파일에 매핑되지 않은 행일 때만 (다른 파일의 글을 내리지 않게)
    const bySlug = typeof slug === 'string' ? ctx.postsBySlug.get(slug) : null;
    const row =
      ctx.postBySource.get(n.path) ??
      (bySlug && !ctx.sourceByPostId.has(bySlug.id) ? bySlug : undefined);
    if (!row || row.origin !== 'brain') {
      actions.push({ status: 'skip', file: n.path, slug: slug ?? null });
      continue;
    }
    handled.add(row.id);
    actions.push({
      status: row.published ? 'unpublish' : 'unchanged',
      file: n.path,
      slug: row.slug,
      postId: row.id,
      fields: row.published ? { published: false } : {},
    });
  }

  const onDisk = new Set(ctx.parsed.map((n) => n.path));
  for (const s of ctx.db.sources) {
    const post = ctx.postsById.get(s.post_id);
    if (onDisk.has(s.source_path) || !post || handled.has(post.id)) continue;
    if (post.published) {
      actions.push({
        status: 'orphan-unpublish',
        file: s.source_path,
        slug: post.slug,
        postId: post.id,
        fields: { published: false },
      });
    }
  }

  const uploads = [...ctx.uploads.values()];
  return {
    actions,
    uploads,
    newTags: [...newTags].map(([name, slug]) => ({ name, slug })),
    reindexCount,
  };
}

function publishAction(n, scan, ctx, newTags) {
  const d = n.data;
  const row = ctx.postsBySlug.get(d.slug);
  const desired = {
    title: d.title,
    content: scan.content,
    excerpt: d.excerpt ?? null,
    published: true,
  };
  const base = {
    file: n.path,
    slug: d.slug,
    links: [...scan.linkSlugs].sort(),
  };
  const createdAt = insertCreatedAt(d.date, d.part ?? 1);

  if (!row) {
    const fields = {
      ...desired,
      slug: d.slug,
      created_at: createdAt,
      origin: 'brain',
    };
    if (n.categoryId !== undefined) fields.category_id = n.categoryId;
    return {
      ...base,
      status: 'insert',
      postId: null,
      fields,
      tags: n.tagNames ? tagChanges(null, n.tagNames, ctx, newTags) : null,
      sourcePath: n.path,
      reindex: true,
    };
  }

  const fields = {};
  for (const k of BRAIN_OWNED)
    if (row[k] !== desired[k]) fields[k] = desired[k];
  if (kstDate(row.created_at) !== d.date) fields.created_at = createdAt;
  if (n.categoryId !== undefined && row.category_id !== n.categoryId) {
    fields.category_id = n.categoryId;
  }
  const tags = n.tagNames ? tagChanges(row.id, n.tagNames, ctx, newTags) : null;
  const current = ctx.db.postLinks
    .filter((l) => l.source_post_id === row.id)
    .map((l) => ctx.postsById.get(l.target_post_id)?.slug)
    .filter(Boolean)
    .sort();
  const linksChanged = current.join('\n') !== base.links.join('\n');
  const sourcePath = ctx.sourceByPostId.get(row.id) !== n.path ? n.path : null;
  const changed =
    Object.keys(fields).length > 0 || tags || linksChanged || sourcePath;
  const contentChanged = ['title', 'content', 'excerpt'].some(
    (k) => k in fields
  );
  return {
    ...base,
    status: changed ? 'update' : 'unchanged',
    postId: row.id,
    fields,
    tags,
    links: linksChanged ? base.links : null,
    sourcePath,
    reindex: !row.published || contentChanged,
  };
}

// 태그 집합을 차집합으로 맞춘다. add는 이름, remove는 tag id. 바뀐 게 없으면 null
function tagChanges(postId, names, ctx, newTags) {
  const current = new Set(
    ctx.db.postTags.filter((pt) => pt.post_id === postId).map((pt) => pt.tag_id)
  );
  const desiredIds = new Set();
  const add = [];
  for (const name of names) {
    const tag = ctx.tagsByName.get(name);
    if (tag) desiredIds.add(tag.id);
    else newTags.set(name, generateSlug(name));
    if (!tag || !current.has(tag.id)) add.push(name);
  }
  const remove = [...current].filter((id) => !desiredIds.has(id));
  return add.length || remove.length ? { add, remove } : null;
}
