// 발행·이관 스크립트가 함께 쓰는 순수 함수와 상수.
// fs, process, console, 네트워크, 현재 시각을 쓰지 않는다. 입력을 받아 값을 돌려준다.
import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// src/lib/constants.ts의 BRAIN_STORAGE_PREFIX와 같은 값 (스크립트는 TS를 import할 수 없음)
export const BRAIN_STORAGE_PREFIX = 'brain/';
export const STORAGE_BUCKET = 'blog-images';
// src/lib/series.ts의 SERIES_PREFIX와 같은 값
export const SERIES_PREFIX = 'series:';
export const VAULT_EXCLUDED_DIRS = ['.obsidian', '.git', '.omc'];
export const ALLOWED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const DRAFT_HEADINGS = ['## 제목', '## Excerpt', '## 태그', '# 본문'];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};
// 이미지처럼 보이지만 허용하지 않는 확장자 (svg 등)
const OTHER_IMAGE_EXTS = ['svg', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'ico'];

/** 차단 사유 코드 */
export const REASON = {
  badFrontmatter: 'bad-frontmatter',
  missingField: 'missing-field',
  badField: 'bad-field',
  reviewPending: 'review-pending',
  badSlug: 'bad-slug',
  duplicateSlug: 'duplicate-slug',
  slugTaken: 'slug-taken',
  slugChanged: 'slug-changed',
  missingPart: 'missing-part',
  badCategory: 'bad-category',
  badTag: 'bad-tag',
  draftTemplate: 'draft-template',
  comment: 'comment',
  privateLink: 'private-link',
  privateLinkInCode: 'private-link-in-code',
  linkInField: 'link-in-field',
  vaultPath: 'vault-path',
  privateRelated: 'private-related',
  missingLink: 'missing-link',
  ambiguousLink: 'ambiguous-link',
  badScheme: 'bad-scheme',
  relativeLink: 'relative-link',
  badEmbed: 'bad-embed',
  missingImage: 'missing-image',
  ambiguousImage: 'ambiguous-image',
  badImageType: 'bad-image-type',
  imageTypeMismatch: 'image-type-mismatch',
  imageTooLarge: 'image-too-large',
};

// ---------------------------------------------------------------------------
// frontmatter
// ---------------------------------------------------------------------------

const OPEN_RE = /^---\r?\n/;

function countNewlines(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') n++;
  return n;
}

/**
 * 노트 텍스트를 frontmatter와 본문으로 나눈다. 본문은 닫는 `---` 줄 다음
 * 바이트부터 끝까지 그대로다.
 * @param {string} text
 * @returns {{ yamlText: string, body: string, bodyStartLine: number } | null}
 */
export function splitFrontmatter(text) {
  const open = OPEN_RE.exec(text);
  if (!open) return null;
  const close = /^---(?:\r?\n|$)/gm;
  close.lastIndex = open[0].length;
  const m = close.exec(text);
  if (!m) return null;
  const bodyStart = m.index + m[0].length;
  return {
    yamlText: text.slice(open[0].length, m.index),
    body: text.slice(bodyStart),
    bodyStartLine: countNewlines(text.slice(0, bodyStart)) + 1,
  };
}

/**
 * @param {string} text
 * @returns {{ data: Record<string, unknown>, body: string, bodyStartLine: number, yamlText: string, error: string | null }}
 */
export function parseNote(text) {
  const parts = splitFrontmatter(text);
  if (!parts) {
    return {
      data: {},
      body: text,
      bodyStartLine: 1,
      yamlText: '',
      error: null,
    };
  }
  try {
    const data = parseYaml(parts.yamlText) ?? {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      return { ...parts, data: {}, error: 'frontmatter가 키-값 형식이 아님' };
    }
    return { ...parts, data, error: null };
  } catch (err) {
    return { ...parts, data: {}, error: err.message.split('\n')[0] };
  }
}

/**
 * `---\n` + frontmatter + `---\n` + 본문. 본문은 바이트 그대로 붙인다.
 * @param {Record<string, unknown>} data
 * @param {string} body
 */
export function serializeNote(data, body) {
  return `---\n${stringifyYaml(data, { lineWidth: 0 })}---\n${body}`;
}

/** frontmatter 안에서 key가 있는 줄의 파일 기준 줄 번호 (못 찾으면 1) */
export function lineOfKey(yamlText, key) {
  const lines = yamlText.split('\n');
  const idx = lines.findIndex((l) => l.startsWith(`${key}:`));
  return idx === -1 ? 1 : idx + 2;
}

// ---------------------------------------------------------------------------
// slug, 날짜 (src/lib/slug.ts와 같은 규칙)
// ---------------------------------------------------------------------------

export function isValidSlug(slug) {
  return /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug);
}

export function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 타임스탬프의 KST 날짜 (YYYY-MM-DD) */
export function kstDate(timestamp) {
  const ms = new Date(timestamp).getTime() + KST_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** 삽입 시 created_at: date 00:00 KST + (part-1)초 */
export function insertCreatedAt(date, part = 1) {
  const base = new Date(`${date}T00:00:00+09:00`).getTime();
  return new Date(base + (part - 1) * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// vault 색인과 이름 찾기
// ---------------------------------------------------------------------------

/** 경로를 vault 상대 posix + NFC로 맞춘다 */
export function normalizeVaultPath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').normalize('NFC');
}

/**
 * Obsidian처럼 대소문자를 무시하고, 경로 끝이 name과 맞는 항목을 모두 찾는다.
 * @param {string[]} paths vault 상대 경로
 * @param {string} name 찾을 이름 (`a.png`, `dir/a.png`, 노트는 `.md` 포함)
 */
export function findByName(paths, name) {
  const want = `/${normalizeVaultPath(name).toLowerCase()}`;
  return paths.filter((p) => `/${p.toLowerCase()}`.endsWith(want));
}

/** `[[...]]` 안쪽을 대상·제목·별칭으로 나눈다 */
export function parseWikiTarget(inner) {
  const raw = inner.replace(/\\\|/g, '|');
  const pipe = raw.indexOf('|');
  const ref = pipe === -1 ? raw : raw.slice(0, pipe);
  const alias = pipe === -1 ? null : raw.slice(pipe + 1).trim() || null;
  const hash = ref.indexOf('#');
  const target = (hash === -1 ? ref : ref.slice(0, hash)).trim();
  return { target, alias };
}

/** 노트 이름(확장자 없음 또는 .md)으로 vault의 .md 경로를 찾는다 */
export function findNotes(paths, name) {
  const base = name.replace(/\.md$/i, '');
  if (!base) return [];
  return findByName(
    paths.filter((p) => p.toLowerCase().endsWith('.md')),
    `${base}.md`
  );
}

// ---------------------------------------------------------------------------
// 이미지
// ---------------------------------------------------------------------------

/** 확장자 (소문자, 점 없음). 없으면 '' */
export function extOf(p) {
  const m = /\.([^./]+)$/.exec(p);
  return m ? m[1].toLowerCase() : '';
}

export function isImageLike(p) {
  const ext = extOf(p);
  return ALLOWED_IMAGE_EXTS.includes(ext) || OTHER_IMAGE_EXTS.includes(ext);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 파일 앞부분으로 형식을 판정한다. png | jpg | gif | webp | null */
export function sniffImageType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'jpg';
  const head6 = buf.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'webp';
  return null;
}

/**
 * 이미지 바이트를 검사하고 업로드 키를 정한다.
 * @param {string} vaultPath
 * @param {Buffer | undefined} buf
 * @returns {{ reason: string } | { key: string, contentType: string, size: number }}
 */
export function inspectImage(vaultPath, buf) {
  const ext = extOf(vaultPath);
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) return { reason: REASON.badImageType };
  if (!buf) return { reason: REASON.missingImage };
  if (buf.length > MAX_IMAGE_BYTES) return { reason: REASON.imageTooLarge };
  const type = sniffImageType(buf);
  const family = ext === 'jpeg' ? 'jpg' : ext;
  if (type !== family) return { reason: REASON.imageTypeMismatch };
  const sha = createHash('sha256').update(buf).digest('hex');
  return {
    key: `${BRAIN_STORAGE_PREFIX}${sha}.${type}`,
    contentType: IMAGE_MIME[type],
    size: buf.length,
  };
}

// ---------------------------------------------------------------------------
// URL 판정 (기본 거부)
// ---------------------------------------------------------------------------

/**
 * @param {string} raw 링크 대상
 * @param {{ siteOrigin: string, publicSlugs: Set<string> }} ctx
 * @returns {{ ok: true, postSlug?: string } | { ok: false, reason: string }}
 */
export function classifyUrl(raw, ctx) {
  let url = raw.trim();
  if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1).trim();
  if (url.startsWith('#')) return { ok: true };
  if (/^mailto:/i.test(url)) return { ok: true };
  if (/^https?:\/\//i.test(url)) {
    const origin = ctx.siteOrigin.toLowerCase();
    const lower = url.toLowerCase();
    if (lower === origin || lower.startsWith(`${origin}/`)) {
      return classifyRootPath(url.slice(origin.length) || '/', ctx);
    }
    return { ok: true };
  }
  if (url.startsWith('//')) return { ok: false, reason: REASON.badScheme };
  if (url.startsWith('/')) return classifyRootPath(url, ctx);
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return { ok: false, reason: REASON.badScheme };
  }
  return { ok: false, reason: REASON.relativeLink };
}

function classifyRootPath(path, ctx) {
  const m = /^\/posts\/([^/?#]+)/.exec(path);
  if (!m) return { ok: true };
  let slug;
  try {
    slug = decodeURIComponent(m[1]).normalize('NFC');
  } catch {
    return { ok: false, reason: REASON.privateLink };
  }
  return ctx.publicSlugs.has(slug)
    ? { ok: true, postSlug: slug }
    : { ok: false, reason: REASON.privateLink };
}
