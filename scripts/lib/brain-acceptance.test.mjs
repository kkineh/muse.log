// ② 통과 기준 1·2를 글 여러 편·이관 → 발행 흐름으로 확인하는 보강 테스트 (test agent 추가)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNote, serializeNote } from './brain-core.mjs';
import { buildExportNotes } from './brain-export-build.mjs';
import { plan } from './brain-plan.mjs';
import {
  OPTS,
  PNG_BYTES,
  PRIVATE,
  emptyDb,
  note,
  pub,
  run,
} from './brain-test-fixtures.mjs';

test('② 기준 1: 막힌 글이 하나라도 있으면 다른 정상 글의 쓰기·업로드·새 태그도 0', () => {
  const bad = note('blog/a.md', pub('a'), '[[비공개 노트]]\n');
  const good = note(
    'blog/b.md',
    pub('b', { public_tags: ['새태그'] }),
    '![[b.png]]\n'
  );
  const r = run({
    notes: [bad, good],
    extra: [PRIVATE, 'blog/b.png'],
    images: new Map([['blog/b.png', PNG_BYTES]]),
  });
  assert.deepEqual(
    r.blocked.map((v) => [v.file, v.reason]),
    [['blog/a.md', 'private-link']]
  );
  assert.deepEqual(r.actions, []);
  assert.deepEqual(r.uploads, []);
  assert.deepEqual(r.newTags, []);
  assert.equal(r.reindexCount, 0);
});

test('② 기준 2: 이관한 노트를 그대로 발행 검사하면 모두 unchanged이고 본문이 DB와 바이트 같음', () => {
  const db = emptyDb();
  db.tags.push({ id: 't1', name: 'ERP', slug: 'erp' });
  const row = (id, slug, content, extra = {}) => ({
    id,
    slug,
    title: `제목 ${slug}`,
    content,
    excerpt: null,
    created_at: '2026-03-01T03:00:00Z',
    published: true,
    origin: 'admin',
    category_id: null,
    ...extra,
  });
  db.posts.push(
    row('p1', 'crlf', '첫 줄\r\n둘째 줄\r\n', {
      category_id: 'c3',
      excerpt: '요약\n둘째 줄',
    }),
    row('p2', 'dash', '---\n위\n---\n아래', { published: false }),
    row('p3', 'nfd', `${'한글'.normalize('NFD')} 본문\n`)
  );
  db.postTags.push({ post_id: 'p1', tag_id: 't1' });

  const exported = buildExportNotes(db);
  // brain-export --apply 이후 상태: origin=brain, post_sources 기록
  const after = structuredClone({ ...db, storageKeys: [] });
  after.storageKeys = new Set();
  for (const p of after.posts) p.origin = 'brain';
  after.sources = exported.map((n) => ({
    post_id: n.postId,
    source_path: n.path,
  }));

  const notes = exported.map((n) => ({ path: n.path, text: n.text }));
  const r = plan({
    notes,
    vaultPaths: notes.map((n) => n.path),
    images: new Map(),
    db: after,
    opts: OPTS,
  });
  assert.deepEqual(r.blocked, []);
  assert.deepEqual(
    r.actions.map((a) => [a.slug, a.status]),
    [
      ['crlf', 'unchanged'],
      ['dash', 'unchanged'],
      ['nfd', 'unchanged'],
    ]
  );
  assert.equal(r.reindexCount, 0);
  for (const n of exported) {
    const body = parseNote(n.text).body;
    assert.equal(
      Buffer.compare(Buffer.from(body), Buffer.from(n.content)),
      0,
      n.path
    );
  }
});

test('② 기준 2: YAML이 헷갈리는 frontmatter 값과 --- 로 시작하는 본문도 왕복이 같음', () => {
  const data = {
    title: 'true',
    slug: '123',
    date: '2026-09-03',
    publish: true,
    excerpt: '첫 줄\n---\n# 둘째',
    series: '- 목록처럼',
    public_tags: ['null', '#해시', ' 앞뒤 공백 ', 'a: b'],
  };
  for (const body of ['---\n본문\n', '﻿본문', '---', '\r\n']) {
    const parsed = parseNote(serializeNote(data, body));
    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.data, data);
    assert.equal(
      Buffer.compare(Buffer.from(parsed.body), Buffer.from(body)),
      0,
      JSON.stringify(body)
    );
  }
});
