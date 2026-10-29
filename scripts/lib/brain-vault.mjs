// vault 읽기와 DB 현재 상태 읽기. 발행·이관 CLI가 함께 쓴다.
import { readdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  BRAIN_STORAGE_PREFIX,
  STORAGE_BUCKET,
  VAULT_EXCLUDED_DIRS,
  normalizeVaultPath,
} from './brain-core.mjs';
import { unwrap } from './brain-env.mjs';

const BLOG_NOTE_RE = /^blog\/[^/]+\.md$/;
const NOT_POSTS = new Set(['blog/voice.md']);
const STORAGE_PAGE = 1000;

/**
 * vault 전체 파일 경로(posix, NFC)와 blog/ 최상위 글을 읽는다.
 * @param {string} vaultDir
 */
export async function readVault(vaultDir) {
  const paths = [];
  const diskPath = new Map();
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (!VAULT_EXCLUDED_DIRS.includes(e.name)) await walk(abs);
      } else if (e.isFile()) {
        const rel = normalizeVaultPath(relative(vaultDir, abs));
        paths.push(rel);
        diskPath.set(rel, abs);
      }
    }
  };
  await walk(vaultDir);
  paths.sort();
  const notePaths = paths.filter(
    (p) => BLOG_NOTE_RE.test(p) && !NOT_POSTS.has(p)
  );
  const notes = await Promise.all(
    notePaths.map(async (p) => ({
      path: p,
      text: await readFile(diskPath.get(p), 'utf8'),
    }))
  );
  // 이미지 바이트는 plan()이 본문에서 찾은 경로만 요청할 때 읽는다
  const cache = new Map();
  const images = {
    get(p) {
      if (!diskPath.has(p)) return undefined;
      if (!cache.has(p)) cache.set(p, readFileSync(diskPath.get(p)));
      return cache.get(p);
    },
  };
  return { paths, notes, images };
}

async function listBrainKeys(supabase) {
  const keys = new Set();
  const folder = BRAIN_STORAGE_PREFIX.replace(/\/$/, '');
  for (let offset = 0; ; offset += STORAGE_PAGE) {
    const page = unwrap(
      await supabase.storage
        .from(STORAGE_BUCKET)
        .list(folder, { limit: STORAGE_PAGE, offset }),
      'Storage 목록 조회'
    );
    for (const f of page) keys.add(`${BRAIN_STORAGE_PREFIX}${f.name}`);
    if (page.length < STORAGE_PAGE) return keys;
  }
}

/** plan()에 넘길 DB 상태. 모든 조회는 에러면 던진다 */
export async function readDbState(supabase) {
  const q = async (table, columns) =>
    unwrap(await supabase.from(table).select(columns), `${table} 조회`);
  const [posts, sources, categories, tags, postTags, postLinks, storageKeys] =
    await Promise.all([
      q(
        'posts',
        'id, slug, title, content, excerpt, created_at, published, origin, category_id'
      ),
      q('post_sources', 'post_id, source_path'),
      q('categories', 'id, slug, parent_id'),
      q('tags', 'id, name, slug'),
      q('post_tags', 'post_id, tag_id'),
      q('post_links', 'source_post_id, target_post_id'),
      listBrainKeys(supabase),
    ]);
  return { posts, sources, categories, tags, postTags, postLinks, storageKeys };
}
