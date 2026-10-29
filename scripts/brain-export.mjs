// 1회용: 기존 muse.log 글을 brain/blog/*.md로 옮긴다 (docs/design/brain-publish.md §7).
// 이관이 끝나면 이 파일과 scripts/lib/brain-export-build.mjs는 지워도 된다.
//
//   node scripts/brain-export.mjs --brain D:/workspace/brain           # dry-run: 만들 파일과 frontmatter만
//   node scripts/brain-export.mjs --brain D:/workspace/brain --apply   # 파일 쓰기 → 바이트 검증 → origin/post_sources 기록
//
// 종료 코드: 0 성공, 1 파일 충돌·검증 차이·실행 오류, 2 사용법·환경 키 누락
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { stringify as stringifyYaml } from 'yaml';
import {
  buildExportNotes,
  firstBodyDiff,
  invalidSlugs,
} from './lib/brain-export-build.mjs';
import { createServiceClient, loadEnv, unwrap } from './lib/brain-env.mjs';

const USAGE =
  '사용법: node scripts/brain-export.mjs --brain <vault 폴더> [--apply]';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readDb(supabase) {
  const q = async (table, columns) =>
    unwrap(await supabase.from(table).select(columns), `${table} 조회`);
  const [posts, categories, tags, postTags] = await Promise.all([
    q(
      'posts',
      'id, slug, title, content, excerpt, created_at, published, origin, category_id'
    ),
    q('categories', 'id, slug, parent_id'),
    q('tags', 'id, name, slug'),
    q('post_tags', 'post_id, tag_id'),
  ]);
  return { posts, categories, tags, postTags };
}

function printDiffs(diffs) {
  for (const d of diffs) {
    console.error(`  차이: ${d.path}  첫 차이 바이트 ${d.at}`);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({
      args: process.argv.slice(2),
      options: {
        brain: { type: 'string' },
        apply: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    return 2;
  }
  if (!args.brain) {
    console.error(USAGE);
    return 2;
  }
  const { values, errors } = loadEnv([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    return 2;
  }

  const supabase = createServiceClient(values);
  const vaultDir = resolve(args.brain);
  const db = await readDb(supabase);
  const badSlugs = invalidSlugs(db.posts);
  if (badSlugs.length > 0) {
    console.error(
      'slug 형식이 맞지 않는 글이 있어 멈춥니다. 아무것도 쓰지 않았습니다:'
    );
    for (const s of badSlugs) console.error(`  ${JSON.stringify(s)}`);
    return 1;
  }
  const notes = buildExportNotes(db);

  const taken = [];
  for (const n of notes) {
    if (await exists(join(vaultDir, n.path))) taken.push(n.path);
  }
  if (taken.length > 0) {
    console.error('이미 있는 파일이 있어 멈춥니다. 덮어쓰지 않습니다:');
    for (const p of taken) console.error(`  ${p}`);
    return 1;
  }

  console.log(
    `[brain-export] ${args.apply ? 'apply' : 'dry-run'}  글 ${notes.length}편`
  );
  for (const n of notes) {
    console.log(
      `\n${n.path}\n${stringifyYaml(n.data, { lineWidth: 0 }).trimEnd()}`
    );
  }

  // dry-run도 메모리에서 직렬화 → 파싱 왕복을 확인한다
  const memDiffs = notes
    .map((n) => ({ path: n.path, at: firstBodyDiff(n.text, n.content) }))
    .filter((d) => d.at !== -1);
  if (memDiffs.length > 0) {
    console.error(`\n왕복 검증 실패 ${memDiffs.length}편:`);
    printDiffs(memDiffs);
    return 1;
  }
  if (!args.apply) {
    console.log(
      `\ndry-run: ${notes.length}편 왕복 차이 0. --apply로 파일을 씁니다.`
    );
    return 0;
  }

  for (const n of notes) {
    const abs = join(vaultDir, n.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, n.text, { encoding: 'utf8', flag: 'wx' });
  }
  const diskDiffs = [];
  for (const n of notes) {
    const text = await readFile(join(vaultDir, n.path), 'utf8');
    const at = firstBodyDiff(text, n.content);
    if (at !== -1) diskDiffs.push({ path: n.path, at });
  }
  if (diskDiffs.length > 0) {
    console.error(
      `\n검증 실패 ${diskDiffs.length}/${notes.length}편. DB는 바꾸지 않았습니다.`
    );
    printDiffs(diskDiffs);
    console.error('쓴 파일을 지우고 원인을 고친 뒤 다시 실행하세요.');
    return 1;
  }
  console.log(`\n검증: ${notes.length}/${notes.length}편 차이 0`);

  // 차이 0일 때만 brain 출신으로 표시한다 (service role이라 보호 트리거를 통과)
  const ids = notes.map((n) => n.postId);
  unwrap(
    await supabase.from('posts').update({ origin: 'brain' }).in('id', ids),
    'posts origin'
  );
  unwrap(
    await supabase.from('post_sources').upsert(
      notes.map((n) => ({ post_id: n.postId, source_path: n.path })),
      { onConflict: 'post_id' }
    ),
    'post_sources'
  );
  console.log(
    `origin='brain' ${ids.length}편, post_sources ${notes.length}행 기록`
  );
  console.log(
    `\n다음: node scripts/brain-publish.mjs --brain ${args.brain}  (dry-run으로 검사 통과 확인)`
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error(`실패: ${err.message}`);
  process.exitCode = 1;
}
