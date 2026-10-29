import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './brain-env.mjs';
import { readVault } from './brain-vault.mjs';
import { PNG_BYTES, emptyDb, OPTS } from './brain-test-fixtures.mjs';
import { plan } from './brain-plan.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SITE_URL',
  'REVALIDATE_SECRET',
];
const FAKE_KEY = 'FAKE-SERVICE-KEY-should-never-print';
const FAKE_SECRET = 'FAKE-short';

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'brain-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('환경: .env.brain.local이 없으면 키 이름과 파일 경로로 안내한다', async (t) => {
  const dir = await tempDir(t);
  await writeFile(
    join(dir, '.env.local'),
    'NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\n'
  );
  const { errors } = loadEnv(ALL_KEYS, dir);
  assert.equal(errors.length, 3);
  assert.equal(
    errors[0],
    `SUPABASE_SERVICE_ROLE_KEY가 ${join(dir, '.env.brain.local')}에 없습니다. ` +
      'Supabase 대시보드 → Project Settings → API Keys의 service_role(secret) 키를 추가하세요.'
  );
});

test('환경: 키가 빠지거나 형식이 틀려도 출력에 값이 없다', async (t) => {
  const dir = await tempDir(t);
  await writeFile(
    join(dir, '.env.brain.local'),
    `SUPABASE_SERVICE_ROLE_KEY="${FAKE_KEY}"\nSITE_URL=http://plain-http.example\nREVALIDATE_SECRET=${FAKE_SECRET}\n`
  );
  const { errors } = loadEnv(ALL_KEYS, dir);
  assert.equal(errors.length, 3); // URL 없음, SITE_URL http, 짧은 비밀값
  const out = errors.join('\n');
  for (const value of [FAKE_KEY, FAKE_SECRET, 'plain-http.example']) {
    assert.ok(!out.includes(value), `출력에 ${value}가 있음`);
  }
});

test('환경: 키가 모두 있으면 값을 돌려준다 (따옴표 제거, localhost http 허용)', async (t) => {
  const dir = await tempDir(t);
  const secret = 'a'.repeat(64);
  await writeFile(
    join(dir, '.env.local'),
    'NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\r\n'
  );
  await writeFile(
    join(dir, '.env.brain.local'),
    `# 주석\nSUPABASE_SERVICE_ROLE_KEY='${FAKE_KEY}'\nSITE_URL=http://localhost:3000\nREVALIDATE_SECRET=${secret}\n`
  );
  const { values, errors } = loadEnv(ALL_KEYS, dir);
  assert.deepEqual(errors, []);
  assert.equal(values.SUPABASE_SERVICE_ROLE_KEY, FAKE_KEY);
  assert.equal(values.REVALIDATE_SECRET, secret);
});

test('CLI: 알 수 없는 인자나 --brain 누락은 사용법과 exit 2 (환경 파일·DB 접근 전)', () => {
  for (const [script, args] of [
    ['brain-publish.mjs', []],
    ['brain-publish.mjs', ['--brain', 'x', '--bogus']],
    ['brain-export.mjs', []],
  ]) {
    const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 2, `${script} ${args.join(' ')}`);
    assert.match(r.stderr, /사용법/);
  }
});

test('vault 읽기: 제외 폴더와 voice.md를 빼고, 이미지는 요청할 때 읽어 plan에 넘긴다', async (t) => {
  const dir = await tempDir(t);
  const files = {
    'blog/a.md':
      '---\ntitle: A\nslug: a\ndate: 2026-09-03\npublish: true\n---\n![[a.png]]\n',
    'blog/voice.md': '말투\n',
    'blog/material/x/y.md': '재료\n',
    'blog/img/a.png': PNG_BYTES,
    '.obsidian/ws.md': 'x',
    '.git/HEAD.md': 'x',
  };
  for (const [p, body] of Object.entries(files)) {
    await mkdir(dirname(join(dir, p)), { recursive: true });
    await writeFile(join(dir, p), body);
  }
  const vault = await readVault(dir);
  assert.deepEqual(vault.paths, [
    'blog/a.md',
    'blog/img/a.png',
    'blog/material/x/y.md',
    'blog/voice.md',
  ]);
  assert.deepEqual(
    vault.notes.map((n) => n.path),
    ['blog/a.md']
  );
  const r = plan({
    notes: vault.notes,
    vaultPaths: vault.paths,
    images: vault.images,
    db: emptyDb(),
    opts: OPTS,
  });
  assert.deepEqual(r.blocked, []);
  assert.equal(r.uploads.length, 1);
  assert.equal(r.actions[0].status, 'insert');
});
