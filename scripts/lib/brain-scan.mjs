// 본문·필드의 링크, 스킴, 주석, 이미지 embed 검사와 DB 사본용 치환. 순수 함수.
import { posix } from 'node:path';
import {
  REASON,
  ALLOWED_IMAGE_EXTS,
  classifyUrl,
  extOf,
  findByName,
  findNotes,
  isImageLike,
  normalizeVaultPath,
  parseWikiTarget,
} from './brain-core.mjs';

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE_RE = /(`+)(.+?)\1(?!`)/g;
// [[wiki]] / ![[embed]] / [text](url) / ![alt](url)
const LINK_RE =
  /(!?)\[\[([^\]\n]+?)\]\]|(!?)\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]+)((?:\s+"[^"\n]*")?)\s*\)/g;
// 참조 링크 정의 `[id]: url` (각주 `[^1]: 내용`은 링크가 아니므로 뺀다)
const REF_DEF_RE = /^ {0,3}\[(?!\^)[^\]\n]+\]:\s*(<[^>\n]*>|\S+)/;
const HTML_TAG_RE = /<[a-zA-Z][^<>]*>/g;
const HTML_ATTR_RE = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const AUTOLINK_RE = /<([a-zA-Z][a-zA-Z0-9+.-]*:[^<>\s]*)>/g;
const CODE_WIKI_RE = /\[\[([^\]\n]+?)\]\]/g;
const CODE_MDLINK_RE = /\]\(\s*<?([^)>\n]+?\.md)(?:#[^)>\n]*)?>?\s*\)/gi;
const MAX_EXCERPT = 80;
// 링크 문법 밖에 맨 글자로 적힌 vault 스킴 (예: obsidian://open?..., file:///D:/...)
const BARE_SCHEME_RE = /\b(?:obsidian|file):\//i;
// frontmatter 필드는 평문이다. wikilink와 마크다운 링크·embed를 모두 막는다
const FIELD_LINK_RE = /\[\[|!?\[[^\]\n]*\]\([^)\n]*\)/;

/** 텍스트에 vault 절대 경로가 들어 있는지 (\·/ 둘 다, 대소문자 무시) */
export function containsVaultPath(text, vaultDir) {
  if (!vaultDir) return false;
  const norm = (s) => s.replace(/[\\/]+/g, '/').toLowerCase();
  return norm(text).includes(norm(vaultDir).replace(/\/$/, ''));
}

/**
 * title·excerpt·series·public_tags 값 검사. 막는 사유 목록을 돌려준다.
 * @param {string} value
 * @param {string | undefined} vaultDir
 */
export function fieldReasons(value, vaultDir) {
  const out = [];
  if (FIELD_LINK_RE.test(value)) out.push(REASON.linkInField);
  if (value.includes('%%') || value.includes('<!--')) out.push(REASON.comment);
  if (BARE_SCHEME_RE.test(value)) out.push(REASON.badScheme);
  if (containsVaultPath(value, vaultDir)) out.push(REASON.vaultPath);
  return out;
}

/**
 * @typedef {object} ScanContext
 * @property {string} notePath 검사하는 노트의 vault 상대 경로
 * @property {string[]} vaultPaths vault 전체 파일 경로
 * @property {string} siteOrigin
 * @property {Set<string>} publicSlugs 공개 집합 P의 slug
 * @property {Map<string, {slug: string, title: string}>} publicPostByPath P에 속한 brain 글
 * @property {string} [vaultDir] vault 절대 경로 (본문에 나오면 막음)
 * @property {((vaultPath: string) => ({url: string} | {reason: string})) | null} resolveImage null이면 이미지 금지
 */

/**
 * 텍스트를 줄 단위로 검사하고, 공개 wikilink와 이미지 embed를 바꾼 사본을 돌려준다.
 * @param {string} text
 * @param {number} startLine text 첫 줄의 파일 기준 줄 번호
 * @param {ScanContext} ctx
 * @returns {{ text: string, violations: {line: number, reason: string, excerpt: string}[], linkSlugs: Set<string> }}
 */
export function scanText(text, startLine, ctx) {
  const res = { violations: [], linkSlugs: new Set() };
  const lines = text.split(/(?<=\n)/);
  const out = [];
  let fence = null;
  lines.forEach((line, i) => {
    const lineNo = startLine + i;
    const fm = FENCE_RE.exec(line);
    if (fence) {
      const closes =
        fm &&
        fm[1][0] === fence[0] &&
        fm[1].length >= fence.length &&
        line.slice(fm[0].length).trim() === '';
      if (closes) fence = null;
      else scanCode(line, lineNo, ctx, res);
      out.push(line);
      return;
    }
    if (fm) {
      fence = fm[1];
      out.push(line);
      return;
    }
    let rebuilt = '';
    let last = 0;
    for (const m of line.matchAll(INLINE_CODE_RE)) {
      rebuilt += scanProse(line.slice(last, m.index), lineNo, ctx, res, last);
      scanCode(m[0], lineNo, ctx, res);
      rebuilt += m[0];
      last = m.index + m[0].length;
    }
    rebuilt += scanProse(line.slice(last), lineNo, ctx, res, last);
    out.push(rebuilt);
  });
  return { text: out.join(''), ...res };
}

function addViolation(res, line, reason, excerpt) {
  res.violations.push({
    line,
    reason,
    excerpt: excerpt.trim().slice(0, MAX_EXCERPT),
  });
}

function checkUrl(url, line, ctx, res, excerpt) {
  const r = classifyUrl(url, ctx);
  if (!r.ok) addViolation(res, line, r.reason, excerpt);
  else if (r.postSlug) res.linkSlugs.add(r.postSlug);
}

function scanProse(seg, line, ctx, res, offset) {
  if (seg.includes('%%') || seg.includes('<!--')) {
    addViolation(res, line, REASON.comment, seg);
  }
  if (BARE_SCHEME_RE.test(seg)) addViolation(res, line, REASON.badScheme, seg);
  if (containsVaultPath(seg, ctx.vaultDir)) {
    addViolation(res, line, REASON.vaultPath, seg);
  }
  const ref = offset === 0 ? REF_DEF_RE.exec(seg) : null;
  if (ref) checkUrl(ref[1], line, ctx, res, ref[0]);
  for (const tag of seg.matchAll(HTML_TAG_RE)) {
    for (const a of tag[0].matchAll(HTML_ATTR_RE)) {
      checkUrl(a[1] ?? a[2] ?? a[3], line, ctx, res, tag[0]);
    }
  }
  for (const a of seg.matchAll(AUTOLINK_RE)) {
    checkUrl(a[1], line, ctx, res, a[0]);
  }
  return seg.replace(
    LINK_RE,
    (m, embedBang, wikiInner, imgBang, text, url, title) => {
      if (wikiInner !== undefined) {
        return embedBang
          ? replaceEmbed(m, wikiInner, line, ctx, res)
          : replaceWiki(m, wikiInner, line, ctx, res);
      }
      if (imgBang) return replaceMdImage(m, text, url, title, line, ctx, res);
      checkUrl(url, line, ctx, res, m);
      return m;
    }
  );
}

function escapeLabel(label) {
  return label.replace(/([[\]])/g, '\\$1');
}

function replaceWiki(m, inner, line, ctx, res) {
  const { target, alias } = parseWikiTarget(inner);
  if (!target) return m; // 같은 글 안의 [[#제목]]
  const found = findNotes(ctx.vaultPaths, target);
  if (found.length === 0) return fail(m, line, REASON.missingLink, res);
  if (found.length > 1) return fail(m, line, REASON.ambiguousLink, res);
  const post = ctx.publicPostByPath.get(found[0]);
  if (!post) return fail(m, line, REASON.privateLink, res);
  res.linkSlugs.add(post.slug);
  return `[${escapeLabel(alias ?? post.title)}](/posts/${post.slug})`;
}

function fail(m, line, reason, res) {
  addViolation(res, line, reason, m);
  return m;
}

function applyImage(m, vaultPath, alt, line, ctx, res) {
  const r = ctx.resolveImage(vaultPath);
  if ('reason' in r) return fail(m, line, r.reason, res);
  return `![${escapeLabel(alt)}](${r.url})`;
}

function imageTypeReason(target) {
  if (!isImageLike(target)) return REASON.badEmbed;
  if (!ALLOWED_IMAGE_EXTS.includes(extOf(target))) return REASON.badImageType;
  return null;
}

function replaceEmbed(m, inner, line, ctx, res) {
  const pipe = inner.indexOf('|');
  const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
  const label = pipe === -1 ? '' : inner.slice(pipe + 1).trim();
  const typeReason = ctx.resolveImage
    ? imageTypeReason(target)
    : REASON.badEmbed;
  if (typeReason) return fail(m, line, typeReason, res);
  const found = findByName(ctx.vaultPaths, target);
  if (found.length === 0) return fail(m, line, REASON.missingImage, res);
  if (found.length > 1) return fail(m, line, REASON.ambiguousImage, res);
  // ![[x.png|300]]의 크기 표시는 무시하고, 숫자가 아닌 값은 alt로 쓴다.
  // alt가 없으면 빈 값 (파일 이름에 비공개 정보가 들어 있을 수 있음)
  const alt = label && !/^\d+(x\d+)?$/.test(label) ? label : '';
  return applyImage(m, found[0], alt, line, ctx, res);
}

function replaceMdImage(m, alt, url, title, line, ctx, res) {
  const r = classifyUrl(url, ctx);
  if (r.ok) {
    if (r.postSlug) res.linkSlugs.add(r.postSlug);
    return m;
  }
  if (r.reason !== REASON.relativeLink) return fail(m, line, r.reason, res);
  // 상대 경로 이미지: 글이 있는 폴더 기준으로만 찾는다
  let rel = url.trim().replace(/^<|>$/g, '');
  try {
    rel = decodeURI(rel);
  } catch {
    return fail(m, line, REASON.missingImage, res);
  }
  const typeReason = ctx.resolveImage ? imageTypeReason(rel) : REASON.badEmbed;
  if (typeReason) return fail(m, line, typeReason, res);
  const joined = normalizeVaultPath(
    posix.normalize(posix.join(posix.dirname(ctx.notePath), rel))
  );
  if (joined.startsWith('../') || !ctx.vaultPaths.includes(joined)) {
    return fail(m, line, REASON.missingImage, res);
  }
  const img = applyImage(m, joined, alt, line, ctx, res);
  return img === m ? m : img.replace(/\)$/, `${title})`);
}

// 코드 안 링크는 바꾸지 않는다. 이름이 vault의 실제 노트(공개 글 포함)에 맞으면 막는다.
function scanCode(seg, line, ctx, res) {
  if (containsVaultPath(seg, ctx.vaultDir)) {
    addViolation(res, line, REASON.vaultPath, seg);
  }
  const names = [];
  for (const w of seg.matchAll(CODE_WIKI_RE)) {
    names.push([parseWikiTarget(w[1]).target, w[0]]);
  }
  for (const l of seg.matchAll(CODE_MDLINK_RE)) {
    let p = l[1];
    try {
      p = decodeURI(p);
    } catch {
      // 디코딩 실패는 원문 그대로 찾는다
    }
    names.push([posix.normalize(p).replace(/^(\.\.\/)+/, ''), l[0]]);
  }
  for (const [name, excerpt] of names) {
    if (!name) continue;
    const found = findNotes(ctx.vaultPaths, name);
    if (found.length > 0) {
      addViolation(res, line, REASON.privateLinkInCode, excerpt);
    }
  }
}
