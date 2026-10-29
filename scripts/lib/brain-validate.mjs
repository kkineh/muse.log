// 발행 대상 글의 frontmatter 검사 (필수 키, slug, 시리즈, 카테고리, 태그, 초안 템플릿). 순수 함수.
import {
  REASON,
  SERIES_PREFIX,
  DRAFT_HEADINGS,
  generateSlug,
  isValidSlug,
  lineOfKey,
} from './brain-core.mjs';
import { fieldReasons } from './brain-scan.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function violation(n, line, reason, excerpt) {
  return { file: n.path, line, reason, excerpt: String(excerpt).slice(0, 80) };
}

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// 필수 키, slug, 시리즈, 카테고리, 태그, 초안 템플릿 검사. 파생 값을 n에 붙인다.
export function validateNote(n, ctx, blocked) {
  const d = n.data;
  const add = (key, reason, excerpt) =>
    blocked.push(violation(n, lineOfKey(n.yamlText, key), reason, excerpt));

  for (const key of ['title', 'slug', 'date']) {
    if (!isNonEmptyString(d[key])) add(key, REASON.missingField, key);
  }
  if (isNonEmptyString(d.date) && !DATE_RE.test(d.date)) {
    add('date', REASON.badField, d.date);
  }
  if (d.review === 'pending')
    add('review', REASON.reviewPending, 'review: pending');
  if (isNonEmptyString(d.slug)) checkSlug(n, ctx, add);

  if (d.part !== undefined && !(Number.isInteger(d.part) && d.part >= 1)) {
    add('part', REASON.badField, `part: ${d.part}`);
  }
  if (d.series !== undefined) {
    if (!isNonEmptyString(d.series)) add('series', REASON.badField, 'series');
    else if (d.part === undefined) add('series', REASON.missingPart, d.series);
  }
  if (
    d.excerpt !== undefined &&
    d.excerpt !== null &&
    typeof d.excerpt !== 'string'
  ) {
    add('excerpt', REASON.badField, 'excerpt');
  }
  if (d.related !== undefined && !isStringList(d.related)) {
    add('related', REASON.badField, 'related');
  }

  n.categoryId = undefined;
  if ('category' in d) {
    if (d.category === null || d.category === '') n.categoryId = null;
    else {
      n.categoryId = resolveCategory(String(d.category), ctx.db.categories);
      if (n.categoryId === undefined)
        add('category', REASON.badCategory, d.category);
    }
  }

  n.tagNames = null;
  if (d.public_tags !== undefined && !isStringList(d.public_tags)) {
    add('public_tags', REASON.badField, 'public_tags');
  } else if (d.public_tags !== undefined || d.series !== undefined) {
    // 이관한 태그 이름과 정확히 같아야 하므로 공백을 다듬지 않는다
    const names = [...(d.public_tags ?? [])];
    if (isNonEmptyString(d.series)) names.push(SERIES_PREFIX + d.series);
    n.tagNames = [...new Set(names)];
    checkNewTags(n.tagNames, ctx, (reason, name) =>
      add('public_tags', reason, name)
    );
  }

  checkPlainFields(n, ctx.opts.vaultDir, add);
  checkDraftHeadings(n, blocked);
}

// title·excerpt·series·public_tags는 평문이다. 링크·embed·주석·vault 스킴·경로를 막는다
function checkPlainFields(n, vaultDir, add) {
  for (const key of ['title', 'excerpt', 'series', 'public_tags']) {
    const v = n.data[key];
    const values = Array.isArray(v) ? v : [v];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      for (const reason of fieldReasons(value, vaultDir)) {
        add(key, reason, value);
      }
    }
  }
}

export function isStringList(v) {
  return Array.isArray(v) && v.every(isNonEmptyString);
}

function checkSlug(n, ctx, add) {
  const slug = n.data.slug;
  if (!isValidSlug(slug)) return add('slug', REASON.badSlug, slug);
  if (ctx.slugCount.get(slug) > 1) add('slug', REASON.duplicateSlug, slug);
  const row = ctx.postsBySlug.get(slug);
  if (row && row.origin !== 'brain') add('slug', REASON.slugTaken, slug);
  const mapped = ctx.postBySource.get(n.path);
  if (mapped && mapped.slug !== slug) {
    add('slug', REASON.slugChanged, `${mapped.slug} → ${slug}`);
  }
}

// 없는 태그는 이름으로 만들므로, 만들 slug가 비었거나 다른 태그와 겹치면 막는다
function checkNewTags(names, ctx, add) {
  for (const name of names) {
    if (ctx.tagsByName.has(name)) continue;
    const slug = generateSlug(name);
    const owner = ctx.tagSlugs.get(slug);
    if (!slug || (owner !== undefined && owner !== name))
      add(REASON.badTag, name);
    else ctx.tagSlugs.set(slug, name);
  }
}

function checkDraftHeadings(n, blocked) {
  n.body.split('\n').forEach((line, i) => {
    if (DRAFT_HEADINGS.includes(line.replace(/\s+$/, ''))) {
      blocked.push(
        violation(n, n.bodyStartLine + i, REASON.draftTemplate, line)
      );
    }
  });
}

/** `a/b/c` slug 경로를 부모 체인까지 맞춰 찾는다. 없으면 undefined */
export function resolveCategory(path, categories) {
  const segs = path
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 1 || segs.length > 3) return undefined;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const leaf = categories.find((c) => c.slug === segs[segs.length - 1]);
  if (!leaf) return undefined;
  let cur = leaf;
  for (let i = segs.length - 2; i >= 0; i--) {
    const parent = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    if (!parent || parent.slug !== segs[i]) return undefined;
    cur = parent;
  }
  return cur.parent_id ? undefined : leaf.id;
}
