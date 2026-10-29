import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  OPTS,
  PNG_BYTES,
  PRIVATE,
  applyToDb,
  blockedBy,
  emptyDb,
  note,
  pub,
  reasons,
  run,
} from './brain-test-fixtures.mjs';

function imageCase() {
  const body = '![[a.png]]\n![그림](img/a.png "t")\n';
  const a = note('blog/a.md', pub('a'), body);
  const images = new Map([['blog/img/a.png', PNG_BYTES]]);
  return { a, body, images, extra: ['blog/img/a.png'] };
}

test('이미지: ![[a.png]], ![x](img/a.png) → brain/{sha256}.png 업로드, DB 사본만 치환, 두 번째 실행은 업로드 0', () => {
  const { a, body, images, extra } = imageCase();
  const r1 = run({ notes: [a], extra, images });
  assert.deepEqual(r1.blocked, []);
  const sha = createHash('sha256').update(PNG_BYTES).digest('hex');
  const key = `brain/${sha}.png`;
  assert.deepEqual(r1.uploads, [
    {
      vaultPath: 'blog/img/a.png',
      key,
      contentType: 'image/png',
      size: PNG_BYTES.length,
      exists: false,
    },
  ]);
  const url = `${OPTS.imageBaseUrl}${key}`;
  assert.equal(
    r1.actions[0].fields.content,
    `![](${url})\n![그림](${url} "t")\n` // alt가 없으면 파일 이름 대신 빈 값
  );
  assert.ok(a.text.endsWith(body)); // brain 파일은 그대로

  const db2 = applyToDb(emptyDb(), r1);
  const r2 = run({ notes: [a], extra, images, db: db2 });
  assert.equal(r2.uploads.filter((u) => !u.exists).length, 0);
  assert.equal(r2.actions[0].status, 'unchanged');
});

test('이미지: ![[x.png]]가 vault에서 둘 이상이면 막고, 상대 경로는 글 폴더 기준으로만 찾는다', () => {
  blockedBy('![[a.png]]\n', 'ambiguous-image', {
    extra: ['x/a.png', 'y/a.png'],
    images: new Map([
      ['x/a.png', PNG_BYTES],
      ['y/a.png', PNG_BYTES],
    ]),
  });
  blockedBy('![](a.png)\n', 'missing-image', {
    extra: ['a.png'],
    images: new Map([['a.png', PNG_BYTES]]),
  });
});

function existingBrain(db, id, slug, extra = {}) {
  db.posts.push({
    id,
    slug,
    title: `제목 ${slug}`,
    content: '본문\n',
    excerpt: null,
    created_at: '2026-09-02T15:00:00.000Z',
    published: true,
    origin: 'brain',
    category_id: null,
    ...extra,
  });
  db.sources.push({ post_id: id, source_path: `blog/${slug}.md` });
}

test('publish:false: 이미 있는 brain 행은 published=false로만 바뀌고 본문·이미지는 올라가지 않는다', () => {
  const db = emptyDb();
  existingBrain(db, 'p1', 'a');
  const a = note(
    'blog/a.md',
    { ...pub('a'), publish: false, title: '새 제목' },
    '![[a.png]] [[없음]]\n'
  );
  const r = run({
    notes: [a],
    extra: ['img/a.png'],
    images: new Map([['img/a.png', PNG_BYTES]]),
    db,
  });
  assert.deepEqual(r.blocked, []);
  assert.deepEqual(r.uploads, []);
  assert.deepEqual(r.actions, [
    {
      status: 'unpublish',
      file: 'blog/a.md',
      slug: 'a',
      postId: 'p1',
      fields: { published: false },
    },
  ]);
  assert.equal(r.reindexCount, 0);
});

test('멱등: 같은 vault로 두 번째 실행하면 모두 unchanged, 쓰기 0, RAG 안내 없음', () => {
  const notes = [
    note(
      'blog/a.md',
      pub('a', {
        category: 'dev/projects/muse-log',
        public_tags: ['ERP'],
        series: 'SR 자동화',
        part: 2,
        excerpt: '요약',
      }),
      '[[b]]\n'
    ),
    note('blog/b.md', pub('b')),
  ];
  const db0 = emptyDb();
  db0.tags.push({ id: 't1', name: 'ERP', slug: 'erp' });
  const r1 = run({ notes, db: db0 });
  assert.deepEqual(r1.blocked, []);
  assert.equal(r1.reindexCount, 2);
  const ins = r1.actions.find((x) => x.slug === 'a');
  assert.equal(ins.fields.category_id, 'c3');
  assert.equal(ins.fields.created_at, '2026-09-02T15:00:01.000Z');
  assert.deepEqual(ins.tags, { add: ['ERP', 'series:SR 자동화'], remove: [] });
  assert.deepEqual(r1.newTags, [
    { name: 'series:SR 자동화', slug: 'seriessr-자동화' },
  ]);

  const r2 = run({ notes, db: applyToDb(db0, r1) });
  assert.deepEqual(
    r2.actions.map((x) => x.status),
    ['unchanged', 'unchanged']
  );
  assert.equal(r2.reindexCount, 0);
  assert.deepEqual(r2.newTags, []);
});

test('수정: KST 날짜가 같으면 created_at을 보존하고, 바뀐 brain 필드와 태그 차집합만 쓴다', () => {
  const db = emptyDb();
  existingBrain(db, 'p1', 'a', { created_at: '2026-09-03T05:12:00.000Z' });
  db.tags.push(
    { id: 't1', name: 'old', slug: 'old' },
    { id: 't2', name: 'keep', slug: 'keep' }
  );
  db.postTags.push(
    { post_id: 'p1', tag_id: 't1' },
    { post_id: 'p1', tag_id: 't2' }
  );
  const r = run({
    notes: [
      note(
        'blog/a.md',
        pub('a', { public_tags: ['keep', 'new'] }),
        '바뀐 본문\n'
      ),
    ],
    db,
  });
  const a = r.actions[0];
  assert.equal(a.status, 'update');
  assert.deepEqual(a.fields, { content: '바뀐 본문\n' });
  assert.deepEqual(a.tags, { add: ['new'], remove: ['t1'] });
  assert.equal(r.reindexCount, 1);
});

test('slug 보호: 발행된 글의 slug 변경, 두 파일이 같은 slug, admin 글과 slug 충돌은 막힌다', () => {
  const db = emptyDb();
  existingBrain(db, 'p1', 'a');
  db.posts.push({
    id: 'x1',
    slug: 'admin-post',
    origin: 'admin',
    published: true,
  });
  assert.deepEqual(
    reasons(run({ notes: [note('blog/a.md', pub('a2'))], db })),
    ['slug-changed']
  );
  assert.deepEqual(
    reasons(
      run({
        notes: [note('blog/a.md', pub('a')), note('blog/b.md', pub('a'))],
        db,
      })
    ),
    ['duplicate-slug', 'duplicate-slug']
  );
  assert.deepEqual(
    reasons(run({ notes: [note('blog/z.md', pub('admin-post'))], db })),
    ['slug-taken']
  );
  assert.deepEqual(
    reasons(run({ notes: [note('blog/z.md', pub('Bad Slug'))], db })),
    ['bad-slug']
  );
});

test('slug 보호: 파일 이름만 바뀌면 같은 slug 글의 source_path만 갱신한다', () => {
  const db = emptyDb();
  existingBrain(db, 'p1', 'a');
  const r = run({ notes: [note('blog/renamed.md', pub('a'))], db });
  assert.deepEqual(r.blocked, []);
  assert.deepEqual(
    r.actions.map((x) => [x.status, x.sourcePath, x.fields]),
    [['update', 'blog/renamed.md', {}]]
  );
});

test('파일 삭제: 파일을 지우면 해당 글이 published=false가 되고 행은 남는다', () => {
  const db = emptyDb();
  existingBrain(db, 'p1', 'gone');
  const r = run({ notes: [], db });
  assert.deepEqual(r.actions, [
    {
      status: 'orphan-unpublish',
      file: 'blog/gone.md',
      slug: 'gone',
      postId: 'p1',
      fields: { published: false },
    },
  ]);
});

test('그 밖의 막힘: 필수 키, review: pending, series만 있고 part 없음, 없는 category, 초안 템플릿 제목', () => {
  const r = run({
    notes: [
      note('blog/a.md', { publish: true, slug: 'a' }),
      note('blog/b.md', pub('b', { review: 'pending' })),
      note('blog/c.md', pub('c', { series: 'S' })),
      note('blog/d.md', pub('d', { category: 'dev/none' })),
      note('blog/e.md', pub('e'), '## 제목\n본문\n'),
    ],
  });
  assert.deepEqual(reasons(r).sort(), [
    'bad-category',
    'draft-template',
    'missing-field',
    'missing-field',
    'missing-part',
    'review-pending',
  ]);
});

test('publish 키가 없는 초안과 voice 같은 글은 검사하지 않는다', () => {
  const r = run({
    notes: [
      note('blog/draft.md', { title: 'x' }, '[[비공개 노트]] %%메모%%\n'),
    ],
    extra: [PRIVATE],
  });
  assert.deepEqual(r.blocked, []);
  assert.deepEqual(r.actions, [
    { status: 'skip', file: 'blog/draft.md', slug: null },
  ]);
});
