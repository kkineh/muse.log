// 이관(brain-export.mjs) 전용 순수 함수. 이관이 끝나면 brain-export.mjs와 함께 지워도 된다.
import {
  SERIES_PREFIX,
  isValidSlug,
  kstDate,
  parseNote,
  serializeNote,
} from './brain-core.mjs';

/** slug가 파일 이름·URL 규칙에 맞지 않는 글의 slug 목록 (경로 탈출 방지) */
export function invalidSlugs(posts) {
  return posts
    .map((p) => p.slug)
    .filter((s) => typeof s !== 'string' || !isValidSlug(s));
}

function categoryPath(id, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const slugs = [];
  for (
    let c = byId.get(id);
    c;
    c = c.parent_id ? byId.get(c.parent_id) : null
  ) {
    slugs.unshift(c.slug);
  }
  return slugs.join('/');
}

/**
 * DB 글을 brain 노트로 만든다. 본문은 posts.content 그대로다.
 * @param {{posts: object[], categories: object[], tags: object[], postTags: object[]}} db
 * @returns {{ postId: string, slug: string, path: string, data: object, text: string, content: string }[]}
 */
export function buildExportNotes(db) {
  const tagName = new Map(db.tags.map((t) => [t.id, t.name]));
  const namesOf = (postId) =>
    db.postTags
      .filter((pt) => pt.post_id === postId)
      .map((pt) => tagName.get(pt.tag_id))
      .filter(Boolean)
      .sort();
  const byCreated = [...db.posts].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
  );

  return db.posts.map((post) => {
    const names = namesOf(post.id);
    // 발행 스크립트가 SERIES_PREFIX + series로 되돌리므로 접두가 정확히 같은 태그만 시리즈로 본다
    const seriesTag = names.find((n) => n.startsWith(SERIES_PREFIX));
    const publicTags = names.filter((n) => n !== seriesTag);
    const date = kstDate(post.created_at);
    const data = {
      title: post.title,
      slug: post.slug,
      date,
      publish: post.published,
    };
    if (post.published) data.review = 'done';
    if (post.category_id)
      data.category = categoryPath(post.category_id, db.categories);
    if (publicTags.length > 0) data.public_tags = publicTags;
    if (seriesTag) {
      data.series = seriesTag.slice(SERIES_PREFIX.length);
      data.part =
        byCreated
          .filter((p) => namesOf(p.id).includes(seriesTag))
          .findIndex((p) => p.id === post.id) + 1;
    }
    if (post.excerpt !== null && post.excerpt !== undefined)
      data.excerpt = post.excerpt;

    const yymmdd = date.slice(2).replace(/-/g, '');
    return {
      postId: post.id,
      slug: post.slug,
      path: `blog/${yymmdd}-muselog-${post.slug}.md`,
      data,
      text: serializeNote(data, post.content),
      content: post.content,
    };
  });
}

/**
 * 파일 텍스트에서 본문을 뽑아 DB content와 바이트 단위로 비교한다.
 * @returns {number} 첫 차이의 바이트 위치, 같으면 -1
 */
export function firstBodyDiff(fileText, content) {
  const body = Buffer.from(parseNote(fileText).body, 'utf8');
  const want = Buffer.from(content, 'utf8');
  if (Buffer.compare(body, want) === 0) return -1;
  const n = Math.min(body.length, want.length);
  for (let i = 0; i < n; i++) if (body[i] !== want[i]) return i;
  return n;
}
