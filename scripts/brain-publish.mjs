// brain/blog/*.md를 검사해 muse.log DB에 발행한다 (로드맵 ②, docs/design/brain-publish.md).
//
//   node scripts/brain-publish.mjs --brain D:/workspace/brain             # dry-run (쓰기 없음)
//   node scripts/brain-publish.mjs --brain D:/workspace/brain --apply     # 이미지·DB 쓰기 + 재검증
//   node scripts/brain-publish.mjs --revalidate-only                      # 재검증만 다시
//
// 종료 코드: 0 성공, 1 검사 위반·실행 오류, 2 사용법·환경 키 누락
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { STORAGE_BUCKET } from './lib/brain-core.mjs';
import { plan } from './lib/brain-plan.mjs';
import { WRITE_STATUSES, applyPlan } from './lib/brain-apply.mjs';
import {
  callRevalidate,
  createServiceClient,
  loadEnv,
} from './lib/brain-env.mjs';
import { readDbState, readVault } from './lib/brain-vault.mjs';

const USAGE =
  '사용법: node scripts/brain-publish.mjs --brain <vault 폴더> [--apply]\n' +
  '        node scripts/brain-publish.mjs --revalidate-only';

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      brain: { type: 'string' },
      apply: { type: 'boolean', default: false },
      'revalidate-only': { type: 'boolean', default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  return {
    brain: values.brain,
    apply: values.apply,
    revalidateOnly: values['revalidate-only'],
  };
}

function printEnvErrors(errors) {
  for (const e of errors) console.error(e);
}

async function revalidateOnly() {
  const { values, errors } = loadEnv(['SITE_URL', 'REVALIDATE_SECRET']);
  if (errors.length > 0) {
    printEnvErrors(errors);
    return 2;
  }
  const r = await callRevalidate(values);
  console.log(r.ok ? '재검증 완료' : `재검증 실패 (status ${r.status})`);
  return r.ok ? 0 : 1;
}

function printPlan(result) {
  for (const a of result.actions) {
    console.log(
      `${a.status.padEnd(16)} ${a.file}${a.slug ? `  (${a.slug})` : ''}`
    );
  }
  for (const u of result.uploads) {
    const kb = Math.ceil(u.size / 1024);
    const state = u.exists ? '이미 있음' : '새로 올림';
    console.log(`image  ${u.vaultPath}  ${kb}KB  → ${u.key}  ${state}`);
  }
}

function printBlocked(blocked) {
  console.error(
    `\n발행 막힘: 위반 ${blocked.length}건. 아무것도 쓰지 않았습니다.`
  );
  for (const v of blocked) {
    console.error(`  ${v.file}:${v.line}  ${v.reason}  ${v.excerpt}`);
  }
}

async function main() {
  let args;
  try {
    args = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    return 2;
  }
  if (args.revalidateOnly) return revalidateOnly();
  if (!args.brain) {
    console.error(USAGE);
    return 2;
  }

  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SITE_URL',
  ];
  if (args.apply) keys.push('REVALIDATE_SECRET');
  const { values, errors } = loadEnv(keys);
  if (errors.length > 0) {
    printEnvErrors(errors);
    return 2;
  }

  const supabase = createServiceClient(values);
  const vaultDir = resolve(args.brain);
  const [vault, db] = await Promise.all([
    readVault(vaultDir),
    readDbState(supabase),
  ]);
  const imageBaseUrl = new URL(
    `/storage/v1/object/public/${STORAGE_BUCKET}/`,
    values.NEXT_PUBLIC_SUPABASE_URL
  ).href;
  const result = plan({
    notes: vault.notes,
    vaultPaths: vault.paths,
    images: vault.images,
    db,
    opts: { siteUrl: values.SITE_URL, imageBaseUrl, vaultDir },
  });

  console.log(
    `[brain-publish] ${args.apply ? 'apply' : 'dry-run'}  글 ${vault.notes.length}개`
  );
  if (result.blocked.length > 0) {
    printBlocked(result.blocked);
    return 1;
  }
  printPlan(result);

  if (!args.apply) {
    const writes = result.actions.filter((a) =>
      WRITE_STATUSES.has(a.status)
    ).length;
    const uploads = result.uploads.filter((u) => !u.exists).length;
    console.log(
      `\ndry-run: 바뀔 글 ${writes}편, 올릴 이미지 ${uploads}개. --apply로 적용합니다.`
    );
    if (result.reindexCount > 0) {
      console.log(`적용하면 RAG 재색인 대상 ${result.reindexCount}편`);
    }
    return 0;
  }

  const counts = await applyPlan(supabase, result, db, vault.images);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  console.log(
    `\n쓰기: 이미지 ${counts.uploads}, posts ${counts.posts}, tags ${counts.tags}, ` +
      `post_tags ${counts.postTags}, post_sources ${counts.sources}, post_links ${counts.links}`
  );
  if (total > 0) {
    const r = await callRevalidate(values);
    if (r.ok) console.log('재검증 완료');
    else {
      console.warn(
        `경고: 재검증 실패 (status ${r.status}). 데이터는 들어갔습니다. 최대 24시간 뒤 반영됩니다.`
      );
      console.warn(
        '  다시 시도: node scripts/brain-publish.mjs --revalidate-only'
      );
    }
  } else {
    console.log('바뀐 것 없음. 재검증 생략');
  }
  if (result.reindexCount > 0) {
    console.log(
      `RAG 재색인 필요: ${result.reindexCount}편 → /admin/rag에서 일괄 재생성`
    );
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error(`실패: ${err.message}`);
  console.error('쓰기는 멱등입니다. 원인을 고친 뒤 다시 실행하세요.');
  process.exitCode = 1;
}
