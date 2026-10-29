// 보안 검토 반영 (F1, L4, L5, L6, L8, L9) 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invalidSlugs } from './brain-export-build.mjs';
import {
  PNG_BYTES,
  PRIVATE,
  blockedBy,
  emptyDb,
  lineOf,
  note,
  pub,
  reasons,
  run,
} from './brain-test-fixtures.mjs';

test('F1: title·excerpt·series·public_tags의 wikilink·마크다운 링크·embed는 link-in-field로 막는다 (공개 글 링크도)', () => {
  const values = [
    '[[b]]',
    '[[비공개 노트]]',
    '[글](/posts/b)',
    '[외부](https://example.com)',
    '![그림](https://example.com/a.png)',
    '![[a.png]]',
  ];
  for (const key of ['title', 'excerpt', 'series']) {
    for (const value of values) {
      const data = pub('a', { [key]: value, part: 1 });
      const a = note('blog/a.md', data, '본문\n');
      const r = run({
        notes: [a, note('blog/b.md', pub('b'))],
        extra: [PRIVATE],
      });
      assert.deepEqual(reasons(r), ['link-in-field'], `${key}: ${value}`);
      assert.equal(r.blocked[0].line, lineOf(a.text, `${key}:`));
      assert.equal(r.actions.length, 0);
    }
  }
  blockedBy('본문\n', 'link-in-field', {
    data: pub('a', { public_tags: ['ok', '[[비공개 노트]]'] }),
  });
});

test('F1: 링크가 없는 평문 필드는 통과한다', () => {
  const data = pub('a', {
    title: '[회고] 대괄호 제목',
    excerpt: '요약 (괄호) 포함',
    series: 'S',
    part: 1,
    public_tags: ['C#'],
  });
  assert.deepEqual(run({ notes: [note('blog/a.md', data)] }).blocked, []);
});

test('L4: 코드 안 이름이 vault 노트에 맞으면 공개 글이어도 막는다', () => {
  const a = note('blog/a.md', pub('a'), '```\n[[b]]\n```\n');
  const r = run({ notes: [a, note('blog/b.md', pub('b'))] });
  assert.deepEqual(reasons(r), ['private-link-in-code']);
  const inline = note('blog/a.md', pub('a'), '`[x](b.md)`\n');
  const r2 = run({ notes: [inline, note('blog/b.md', pub('b'))] });
  assert.deepEqual(reasons(r2), ['private-link-in-code']);
});

test('L5: 본문·필드의 맨 obsidian:/file: 스킴은 막는다', () => {
  blockedBy('여기 obsidian://open?vault=brain 참고\n', 'bad-scheme');
  blockedBy('경로 FILE:///C:/x.md\n', 'bad-scheme');
  blockedBy('본문\n', 'bad-scheme', {
    data: pub('a', { excerpt: 'obsidian://open?file=x' }),
  });
  // 평범한 "file:" 글자는 스킴이 아니다
  const ok = note('blog/a.md', pub('a'), 'config file: 설정\nprofile:x\n');
  assert.deepEqual(run({ notes: [ok] }).blocked, []);
});

test('L5: vault 절대 경로는 슬래시 종류·대소문자와 상관없이 본문·코드·필드에서 막는다', () => {
  blockedBy('경로 x:\\vaults\\testbrain\\notes\\a.md\n', 'vault-path');
  blockedBy('경로 X:/Vaults/TestBrain/blog\n', 'vault-path');
  blockedBy('```\ncd X:\\\\Vaults\\\\TestBrain\n```\n', 'vault-path');
  blockedBy('본문\n', 'vault-path', {
    data: pub('a', { title: 'x:/vaults/testbrain 회고' }),
  });
});

test('L6: alt가 없는 이미지 embed는 파일 이름 대신 빈 alt를 쓴다', () => {
  const a = note('blog/a.md', pub('a'), '![[비밀-프로젝트-캡처.png]]\n');
  const r = run({
    notes: [a],
    extra: ['img/비밀-프로젝트-캡처.png'],
    images: new Map([['img/비밀-프로젝트-캡처.png', PNG_BYTES]]),
  });
  assert.deepEqual(r.blocked, []);
  assert.match(r.actions[0].fields.content, /^!\[\]\(https:/);
  assert.ok(!r.actions[0].fields.content.includes('비밀'));
});

test('L8: 이관할 글의 slug가 형식에 맞지 않으면 찾아낸다 (CLI는 아무것도 쓰지 않고 exit 1)', () => {
  const posts = [
    { slug: 'ok-slug' },
    { slug: '../../escape' },
    { slug: 'a/b' },
    { slug: '' },
    { slug: '한글-슬러그' },
  ];
  assert.deepEqual(invalidSlugs(posts), ['../../escape', 'a/b', '']);
});

test('L9: publish:false 파일의 slug가 다른 파일에 매핑된 글과 같으면 그 글을 내리지 않는다', () => {
  const db = emptyDb();
  db.posts.push({
    id: 'p1',
    slug: 'a',
    title: '제목 a',
    content: '본문\n',
    excerpt: null,
    created_at: '2026-09-02T15:00:00.000Z',
    published: true,
    origin: 'brain',
    category_id: null,
  });
  db.sources.push({ post_id: 'p1', source_path: 'blog/a.md' });
  const copy = note('blog/copy.md', { ...pub('a'), publish: false });
  const r = run({ notes: [note('blog/a.md', pub('a')), copy], db });
  assert.deepEqual(
    r.actions.map((x) => [x.file, x.status]),
    [
      ['blog/a.md', 'unchanged'],
      ['blog/copy.md', 'skip'],
    ]
  );
  // 매핑이 없는 행이면 slug로 찾아 내린다
  const db2 = structuredClone(db);
  db2.storageKeys = new Set();
  db2.sources = [];
  const r2 = run({ notes: [copy], db: db2 });
  assert.equal(r2.actions[0].status, 'unpublish');
});
