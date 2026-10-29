import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyUrl,
  insertCreatedAt,
  kstDate,
  parseNote,
  serializeNote,
  sniffImageType,
} from './brain-core.mjs';
import { buildExportNotes, firstBodyDiff } from './brain-export-build.mjs';
import { resolveCategory } from './brain-validate.mjs';
import { PNG_BYTES, emptyDb } from './brain-test-fixtures.mjs';

const NFD = '한글'.normalize('NFD');
const BODIES = {
  '빈 본문': '',
  '앞 개행': '\n\n첫 줄\n',
  '끝 개행 없음': '마지막 줄에 개행 없음',
  CRLF: '첫 줄\r\n둘째 줄\r\n',
  '본문 안 ---': '위\n---\n아래\n---\n',
  '한글 NFD': `${NFD} 본문\n`,
};

for (const [name, body] of Object.entries(BODIES)) {
  test(`② 기준 2: 직렬화 → 파싱 왕복이 바이트 단위로 같음 (${name})`, () => {
    const data = {
      title: '제목: 콜론',
      slug: 's',
      date: '2026-09-03',
      publish: true,
    };
    const text = serializeNote(data, body);
    const parsed = parseNote(text);
    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.data, data);
    assert.equal(
      Buffer.compare(Buffer.from(parsed.body), Buffer.from(body)),
      0
    );
  });
}

test('② 기준 2: 이관 노트는 posts.content와 바이트 차이 0, 파일 이름·frontmatter 규칙을 따른다', () => {
  const db = emptyDb();
  db.tags.push(
    { id: 't1', name: 'ERP', slug: 'erp' },
    { id: 't2', name: 'series:SR 자동화', slug: 'seriessr-자동화' }
  );
  const base = { excerpt: null, category_id: null, origin: 'admin' };
  db.posts.push(
    {
      ...base,
      id: 'p1',
      slug: 'first',
      title: 'A',
      content: BODIES.CRLF,
      created_at: '2026-03-01T16:00:00Z',
      published: true,
      category_id: 'c3',
      excerpt: '요약',
    },
    {
      ...base,
      id: 'p2',
      slug: 'second',
      title: 'B',
      content: BODIES['본문 안 ---'],
      created_at: '2026-03-05T00:00:00Z',
      published: false,
    },
    {
      ...base,
      id: 'p3',
      slug: 'third',
      title: 'C',
      content: BODIES['한글 NFD'],
      created_at: '2026-03-04T00:00:00Z',
      published: true,
    }
  );
  db.postTags.push(
    { post_id: 'p1', tag_id: 't1' },
    { post_id: 'p1', tag_id: 't2' },
    { post_id: 'p3', tag_id: 't2' }
  );
  const notes = buildExportNotes(db);
  for (const n of notes) assert.equal(firstBodyDiff(n.text, n.content), -1);
  const [p1, p2, p3] = notes;
  assert.equal(p1.path, 'blog/260302-muselog-first.md');
  assert.deepEqual(p1.data, {
    title: 'A',
    slug: 'first',
    date: '2026-03-02',
    publish: true,
    review: 'done',
    category: 'dev/projects/muse-log',
    public_tags: ['ERP'],
    series: 'SR 자동화',
    part: 1,
    excerpt: '요약',
  });
  assert.deepEqual(p2.data, {
    title: 'B',
    slug: 'second',
    date: '2026-03-05',
    publish: false,
  });
  assert.equal(p3.data.part, 2);
  assert.equal(
    firstBodyDiff(p1.text, `${BODIES.CRLF}x`),
    Buffer.byteLength(BODIES.CRLF)
  );
});

test('created_at: date 00:00 KST + (part-1)초, KST 날짜 계산', () => {
  assert.equal(insertCreatedAt('2026-09-03'), '2026-09-02T15:00:00.000Z');
  assert.equal(insertCreatedAt('2026-09-03', 3), '2026-09-02T15:00:02.000Z');
  assert.equal(kstDate('2026-09-02T15:00:00Z'), '2026-09-03');
  assert.equal(kstDate('2026-09-02T14:59:59Z'), '2026-09-02');
});

test('URL 판정: 허용 목록 외 스킴과 상대 경로는 거부한다', () => {
  const ctx = {
    siteOrigin: 'https://muse.example.com',
    publicSlugs: new Set(['ok']),
  };
  const ok = (u) => classifyUrl(u, ctx).ok;
  assert.equal(ok('https://x.com/a'), true);
  assert.equal(ok('mailto:a@b.c'), true);
  assert.equal(ok('#h'), true);
  assert.equal(ok('/category/x'), true);
  assert.deepEqual(classifyUrl('/posts/ok', ctx), { ok: true, postSlug: 'ok' });
  assert.deepEqual(classifyUrl('https://muse.example.com/posts/ok#x', ctx), {
    ok: true,
    postSlug: 'ok',
  });
  assert.equal(ok('/posts/no'), false);
  assert.equal(ok('//evil.com/x'), false);
  assert.equal(ok('ftp://x'), false);
  assert.equal(ok('img/a.png'), false);
});

test('magic bytes 판정', () => {
  assert.equal(sniffImageType(PNG_BYTES), 'png');
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(sniffImageType(Buffer.from('GIF89a....')), 'gif');
  assert.equal(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns=')), null);
});

test('category 경로는 부모 체인까지 맞아야 찾는다', () => {
  const cats = emptyDb().categories;
  assert.equal(resolveCategory('dev/projects/muse-log', cats), 'c3');
  assert.equal(resolveCategory('dev', cats), 'c1');
  assert.equal(resolveCategory('projects/muse-log', cats), undefined);
  assert.equal(resolveCategory('dev/muse-log', cats), undefined);
});
