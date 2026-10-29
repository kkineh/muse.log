// plan(): vault 파일과 DB 현재 상태를 받아 차단 목록 또는 쓰기 계획을 돌려준다. 순수 함수.
import {
  REASON,
  findNotes,
  inspectImage,
  lineOfKey,
  parseNote,
  parseWikiTarget,
} from './brain-core.mjs';
import { buildActions } from './brain-actions.mjs';
import { scanText } from './brain-scan.mjs';
import {
  isNonEmptyString,
  isStringList,
  validateNote,
  violation,
} from './brain-validate.mjs';

/**
 * @typedef {object} DbState
 * @property {{id: string, slug: string, title: string, content: string, excerpt: string | null, created_at: string, published: boolean, origin: string, category_id: string | null}[]} posts
 * @property {{post_id: string, source_path: string}[]} sources
 * @property {{id: string, slug: string, parent_id: string | null}[]} categories
 * @property {{id: string, name: string, slug: string}[]} tags
 * @property {{post_id: string, tag_id: string}[]} postTags
 * @property {{source_post_id: string, target_post_id: string}[]} postLinks
 * @property {Set<string>} storageKeys `blog-images` 버킷에 이미 있는 `brain/` 키
 */

/**
 * @param {object} input
 * @param {{path: string, text: string}[]} input.notes blog/ 최상위 글 (vault 상대 posix)
 * @param {string[]} input.vaultPaths vault 전체 파일 경로
 * @param {Map<string, Buffer>} input.images 본문이 가리키는 이미지 바이트
 * @param {DbState} input.db
 * @param {{siteUrl: string, imageBaseUrl: string}} input.opts
 */
export function plan(input) {
  const ctx = buildContext(input);
  const blocked = [];
  for (const n of ctx.pub) validateNote(n, ctx, blocked);
  for (const n of ctx.parsed) {
    if (n.error) {
      blocked.push(violation(n, 1, REASON.badFrontmatter, n.error));
    }
  }
  const scans = scanPublished(ctx, blocked);
  if (blocked.length > 0) {
    return { blocked, actions: [], uploads: [], newTags: [], reindexCount: 0 };
  }
  return { blocked, ...buildActions(ctx, scans) };
}

function buildContext({ notes, vaultPaths, images, db, opts }) {
  const parsed = notes.map((n) => ({ path: n.path, ...parseNote(n.text) }));
  const pub = parsed.filter((n) => !n.error && n.data.publish === true);
  const postsById = new Map(db.posts.map((p) => [p.id, p]));
  const sourceByPostId = new Map(
    db.sources.map((s) => [s.post_id, s.source_path])
  );
  const postBySource = new Map();
  for (const s of db.sources) {
    const post = postsById.get(s.post_id);
    if (post) postBySource.set(s.source_path, post);
  }
  const slugCount = new Map();
  for (const n of pub) {
    const s = n.data.slug;
    slugCount.set(s, (slugCount.get(s) ?? 0) + 1);
  }
  return {
    parsed,
    pub,
    vaultPaths,
    images,
    db,
    opts,
    postsById,
    postsBySlug: new Map(db.posts.map((p) => [p.slug, p])),
    sourceByPostId,
    postBySource,
    slugCount,
    tagsByName: new Map(db.tags.map((t) => [t.name, t])),
    tagSlugs: new Map(db.tags.map((t) => [t.slug, t.name])),
  };
}

function scanPublished(ctx, blocked) {
  const publicPostByPath = new Map();
  for (const n of ctx.pub) {
    if (isNonEmptyString(n.data.slug) && isNonEmptyString(n.data.title)) {
      publicPostByPath.set(n.path, { slug: n.data.slug, title: n.data.title });
    }
  }
  const publicSlugs = new Set(
    [...publicPostByPath.values()].map((p) => p.slug)
  );
  for (const p of ctx.db.posts) {
    if (p.origin !== 'brain' && p.published) publicSlugs.add(p.slug);
  }
  ctx.uploads = new Map();
  const resolveImage = (vaultPath) => {
    const r = inspectImage(vaultPath, ctx.images.get(vaultPath));
    if ('reason' in r) return r;
    const exists = ctx.db.storageKeys.has(r.key);
    ctx.uploads.set(r.key, { vaultPath, ...r, exists });
    return { url: `${ctx.opts.imageBaseUrl}${r.key}` };
  };
  const base = {
    vaultPaths: ctx.vaultPaths,
    siteOrigin: new URL(ctx.opts.siteUrl).origin,
    publicSlugs,
    publicPostByPath,
    vaultDir: ctx.opts.vaultDir,
  };

  const scans = new Map();
  for (const n of ctx.pub) {
    const sctx = { ...base, notePath: n.path, resolveImage };
    const body = scanText(n.body, n.bodyStartLine, sctx);
    const linkSlugs = new Set(body.linkSlugs);
    const collect = (r) => {
      for (const v of r.violations) blocked.push({ file: n.path, ...v });
      for (const s of r.linkSlugs) linkSlugs.add(s);
    };
    collect(body);
    // title·excerpt·series·public_tags는 평문이라 validateNote에서 따로 막는다
    if (isStringList(n.data.related)) {
      checkRelated(n, base, blocked, linkSlugs);
    }
    linkSlugs.delete(n.data.slug);
    scans.set(n.path, { content: body.text, linkSlugs });
  }
  return scans;
}

function checkRelated(n, base, blocked, linkSlugs) {
  const line = lineOfKey(n.yamlText, 'related');
  for (const item of n.data.related) {
    const inner = item
      .trim()
      .replace(/^!?\[\[/, '')
      .replace(/\]\]$/, '');
    const found = findNotes(base.vaultPaths, parseWikiTarget(inner).target);
    const post =
      found.length === 1 ? base.publicPostByPath.get(found[0]) : null;
    if (post) linkSlugs.add(post.slug);
    else {
      const reason =
        found.length === 0
          ? REASON.missingLink
          : found.length > 1
            ? REASON.ambiguousLink
            : REASON.privateRelated;
      blocked.push(violation(n, line, reason, item));
    }
  }
}
