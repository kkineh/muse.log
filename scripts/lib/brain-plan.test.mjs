import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES } from './brain-core.mjs';
import {
  OPTS,
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

test('② 기준 1: blog 밖 노트를 링크한 공개 글은 막히고 사유에 파일:줄이 들어 있다', () => {
  const a = note('blog/a.md', pub('a'), '첫 줄\n\n[[비공개 노트]] 참고\n');
  const r = run({ notes: [a], extra: [PRIVATE] });
  assert.equal(r.blocked.length, 1);
  assert.deepEqual(r.blocked[0], {
    file: 'blog/a.md',
    line: lineOf(a.text, '[[비공개 노트]]'),
    reason: 'private-link',
    excerpt: '[[비공개 노트]]',
  });
  assert.equal(r.actions.length, 0);
});

test('막힘: related:의 비공개 노트', () => {
  blockedBy('본문\n', 'private-related', {
    data: pub('a', { related: ['[[비공개 노트]]'] }),
  });
});

test('막힘: [[없는파일]]', () => blockedBy('[[없는파일]]\n', 'missing-link'));
test('막힘: ![[note]] 노트 embed', () =>
  blockedBy('![[비공개 노트]]\n', 'bad-embed'));
test('막힘: ![[x.pdf]]', () =>
  blockedBy('![[x.pdf]]\n', 'bad-embed', { extra: ['files/x.pdf'] }));
test('막힘: ![[x.svg]]', () =>
  blockedBy('![[x.svg]]\n', 'bad-image-type', { extra: ['img/x.svg'] }));

test('막힘: 5MB 초과 이미지', () => {
  const big = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  PNG_BYTES.copy(big);
  blockedBy('![[big.png]]\n', 'image-too-large', {
    extra: ['img/big.png'],
    images: new Map([['img/big.png', big]]),
  });
});

test('막힘: 확장자와 magic bytes가 다른 이미지', () => {
  blockedBy('![[fake.jpg]]\n', 'image-type-mismatch', {
    extra: ['img/fake.jpg'],
    images: new Map([['img/fake.jpg', PNG_BYTES]]),
  });
});

test('막힘: /posts/없는slug와 SITE_URL 절대 주소', () => {
  blockedBy('[x](/posts/none)\n', 'private-link');
  blockedBy(`[x](${OPTS.siteUrl}/posts/none)\n`, 'private-link');
});

test('막힘: publish: false 글로의 링크', () => {
  const a = note('blog/a.md', pub('a'), '[[b]]\n');
  const b = note('blog/b.md', { ...pub('b'), publish: false });
  assert.deepEqual(reasons(run({ notes: [a, b] })), ['private-link']);
});

test('막힘: file:/obsidian:/data:/javascript: 스킴과 상대 .md 링크', () => {
  blockedBy('[x](file:///C:/a.md)\n', 'bad-scheme');
  blockedBy('[x](obsidian://open?vault=brain)\n', 'bad-scheme');
  blockedBy('![x](data:image/png;base64,AAAA)\n', 'bad-scheme');
  blockedBy('<javascript:alert(1)>\n', 'bad-scheme');
  blockedBy('[x](../notes/x.md)\n', 'relative-link');
});

test('막힘: raw HTML href·src에도 같은 규칙', () => {
  blockedBy('<a href="obsidian://x">a</a>\n', 'bad-scheme');
  blockedBy('<img src="img/a.png">\n', 'relative-link');
});

test('막힘: %%주석%%과 <!-- -->', () => {
  blockedBy('본문 %%메모%%\n', 'comment');
  blockedBy('<!-- 숨김 -->\n', 'comment');
});

test('코드 블록 안 [[실제 비공개 노트]]는 막히고 [[없는이름]]은 통과한다', () => {
  blockedBy('```\n[[비공개 노트]]\n```\n', 'private-link-in-code');
  blockedBy('`[이름](notes/비공개 노트.md)`\n', 'private-link-in-code');
  const a = note(
    'blog/a.md',
    pub('a'),
    '```\n[[없는이름]] [x](y.md)\n```\n`[[예시]]`\n'
  );
  const r = run({ notes: [a], extra: [PRIVATE] });
  assert.deepEqual(r.blocked, []);
  assert.equal(
    r.actions[0].fields.content,
    '```\n[[없는이름]] [x](y.md)\n```\n`[[예시]]`\n'
  );
});

test('B를 publish: false로 내리면 B를 링크한 공개 글 A가 막힌다', () => {
  const a = note('blog/a.md', pub('a'), '[[b]]\n');
  const bPub = note('blog/b.md', pub('b'));
  assert.deepEqual(run({ notes: [a, bPub] }).blocked, []);
  const bOff = note('blog/b.md', { ...pub('b'), publish: false });
  const r = run({ notes: [a, bOff] });
  assert.deepEqual(
    r.blocked.map((v) => [v.file, v.reason]),
    [['blog/a.md', 'private-link']]
  );
});

test('통과: 외부 URL, mailto:, #a, /tags/x, source:의 비공개 링크, vault tags:는 DB로 가지 않음', () => {
  const data = pub('a', {
    tags: ['vault-only'],
    source: ['[[비공개 노트]]'],
  });
  const body =
    '[e](https://example.com/x) <https://example.com> [m](mailto:a@b.c) [h](#a) [t](/tags/x)\n' +
    '각주[^1]와 [참조][r]\n\n[^1]: 각주 내용\n[r]: https://example.com/ref\n';
  const r = run({ notes: [note('blog/a.md', data, body)], extra: [PRIVATE] });
  assert.deepEqual(r.blocked, []);
  const a = r.actions[0];
  assert.equal(a.status, 'insert');
  assert.equal(a.tags, null);
  assert.equal(r.newTags.length, 0);
  assert.ok(!JSON.stringify(a).includes('vault-only'));
  assert.ok(!JSON.stringify(a).includes('비공개'));
});

test('wikilink 이름이 둘 이상에 맞으면(대소문자 무시 포함) ambiguous-link로 막는다', () => {
  blockedBy('[[같은이름]]\n', 'ambiguous-link', {
    extra: ['x/같은이름.md', 'y/같은이름.md'],
  });
  blockedBy('[[Note]]\n', 'ambiguous-link', {
    extra: ['x/note.md', 'y/NOTE.md'],
  });
});

test('공개 wikilink는 DB 사본에서 /posts/slug 링크로 바뀌고 post_links 대상이 된다', () => {
  const a = note(
    'blog/a.md',
    pub('a', { related: ['[[b]]'] }),
    '[[b]] 와 [[c|다른 이름]] 그리고 [[a]]\n'
  );
  const b = note('blog/b.md', pub('b', { title: '[회고] B' }));
  const c = note('blog/c.md', pub('c'));
  const r = run({ notes: [a, b, c] });
  assert.deepEqual(r.blocked, []);
  const act = r.actions.find((x) => x.slug === 'a');
  assert.equal(
    act.fields.content,
    '[\\[회고\\] B](/posts/b) 와 [다른 이름](/posts/c) 그리고 [제목 a](/posts/a)\n'
  );
  assert.deepEqual(act.links, ['b', 'c']);
  assert.equal(a.text.includes('[[b]]'), true);
});

test('admin 공개 글 링크는 통과하고 admin 비공개 글 링크는 막힌다', () => {
  const db = emptyDb();
  db.posts.push(
    { id: 'x1', slug: 'old', origin: 'admin', published: true },
    { id: 'x2', slug: 'hidden', origin: 'admin', published: false }
  );
  const ok = run({
    notes: [note('blog/a.md', pub('a'), '[o](/posts/old)\n')],
    db,
  });
  assert.deepEqual(ok.blocked, []);
  assert.deepEqual(ok.actions[0].links, ['old']);
  const ng = run({
    notes: [note('blog/a.md', pub('a'), '[h](/posts/hidden)\n')],
    db,
  });
  assert.deepEqual(reasons(ng), ['private-link']);
});
