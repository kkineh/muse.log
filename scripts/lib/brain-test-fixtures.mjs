// 테스트 전용 메모리 픽스처. 디스크 vault를 쓰지 않는다.
import assert from 'node:assert/strict';
import { serializeNote } from './brain-core.mjs';
import { plan } from './brain-plan.mjs';

export const OPTS = {
  siteUrl: 'https://muse.example.com',
  imageBaseUrl: 'https://sb.example.co/storage/v1/object/public/blog-images/',
  vaultDir: 'X:\\Vaults\\TestBrain',
};

export const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake png body'),
]);

export function emptyDb() {
  return {
    posts: [],
    sources: [],
    categories: [
      { id: 'c1', slug: 'dev', parent_id: null },
      { id: 'c2', slug: 'projects', parent_id: 'c1' },
      { id: 'c3', slug: 'muse-log', parent_id: 'c2' },
    ],
    tags: [],
    postTags: [],
    postLinks: [],
    storageKeys: new Set(),
  };
}

/** publish: true 글의 기본 frontmatter */
export function pub(slug, extra = {}) {
  return {
    title: `제목 ${slug}`,
    slug,
    date: '2026-09-03',
    publish: true,
    review: 'done',
    ...extra,
  };
}

export function note(path, data, body = '본문\n') {
  return { path, text: serializeNote(data, body) };
}

/** 텍스트에서 snippet이 처음 나오는 줄 번호 (구현과 독립적으로 계산) */
export function lineOf(text, snippet) {
  return text.split('\n').findIndex((l) => l.includes(snippet)) + 1;
}

/**
 * @param {object} p
 * @param {{path: string, text: string}[]} p.notes
 * @param {string[]} [p.extra] blog 글 외의 vault 파일
 * @param {Map<string, Buffer>} [p.images]
 * @param {object} [p.db]
 */
export function run({ notes, extra = [], images = new Map(), db = emptyDb() }) {
  const vaultPaths = [...notes.map((n) => n.path), ...extra].sort();
  return plan({ notes, vaultPaths, images, db, opts: OPTS });
}

/** plan 결과를 메모리 DB에 적용한다 (CLI applyPlan과 같은 순서). 멱등 테스트용 */
export function applyToDb(db, result) {
  const next = structuredClone({ ...db, storageKeys: [...db.storageKeys] });
  next.storageKeys = new Set(next.storageKeys);
  for (const u of result.uploads) next.storageKeys.add(u.key);
  let seq = next.posts.length;
  for (const a of result.actions) {
    if (a.status === 'insert') {
      a.postId = `p${++seq}`;
      next.posts.push({ id: a.postId, category_id: null, ...a.fields });
    } else if (a.fields && Object.keys(a.fields).length > 0) {
      Object.assign(
        next.posts.find((p) => p.id === a.postId),
        a.fields
      );
    }
  }
  for (const t of result.newTags) next.tags.push({ id: `t-${t.name}`, ...t });
  const tagId = (name) => next.tags.find((t) => t.name === name).id;
  const idOf = (slug) => next.posts.find((p) => p.slug === slug).id;
  for (const a of result.actions) {
    if (a.tags) {
      next.postTags = next.postTags.filter(
        (pt) => !(pt.post_id === a.postId && a.tags.remove.includes(pt.tag_id))
      );
      for (const name of a.tags.add) {
        next.postTags.push({ post_id: a.postId, tag_id: tagId(name) });
      }
    }
    if (a.sourcePath) {
      next.sources = next.sources.filter((s) => s.post_id !== a.postId);
      next.sources.push({ post_id: a.postId, source_path: a.sourcePath });
    }
    if (a.links) {
      next.postLinks = next.postLinks.filter(
        (l) => l.source_post_id !== a.postId
      );
      for (const s of a.links) {
        next.postLinks.push({
          source_post_id: a.postId,
          target_post_id: idOf(s),
        });
      }
    }
  }
  return next;
}

export const PRIVATE = 'notes/비공개 노트.md';
export const reasons = (r) => r.blocked.map((v) => v.reason);

/** body가 reason으로 막히고 쓰기 계획이 비어 있음을 확인한다 */
export function blockedBy(
  body,
  reason,
  { extra = [PRIVATE], images, data } = {}
) {
  const a = note('blog/a.md', data ?? pub('a'), body);
  const r = run({ notes: [a], extra, images });
  assert.ok(reasons(r).includes(reason), `${reason} 기대, 실제 ${reasons(r)}`);
  assert.equal(r.actions.length, 0);
  assert.equal(r.uploads.length, 0);
  return r;
}
