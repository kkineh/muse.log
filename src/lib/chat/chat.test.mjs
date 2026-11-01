// Run: node --test src/lib/chat/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeps, memoryCache, req, run } from './test-helpers.mjs';
import { MESSAGES } from './config.ts';

const followUp = (extra = {}) =>
  req({
    message: '그 글에서 말한 것 더 알려줘',
    history: [
      { role: 'user', content: 'a가 뭐야' },
      { role: 'assistant', content: 'a는 ...' },
    ],
    readSlugs: ['a'],
    ...extra,
  });

// router stand-in: returns a only when the hint is present
const hintRouter = (r) =>
  /<recent_read>\na\n/.test(r.user) ? '{"slugs":["a"]}' : '{"slugs":[]}';

test('기준1: 후속 질문이 readSlugs 힌트로 같은 글을 읽고 history를 받는다', async () => {
  const h = makeDeps({ routerOut: hintRouter });
  const out = await run(h, followUp());
  assert.deepEqual(h.postCalls, ['a']);
  assert.deepEqual(out.response.sources, [{ title: 'T-a', slug: 'a' }]);
  const answer = h.calls.find((c) => c.call === 'answer');
  assert.match(answer.system, /body of a/);
  assert.match(answer.user, /<history>/);
  assert.match(answer.user, /어시스턴트: a는/);
});

test('기준1: readSlugs를 비우면 같은 라우터가 0편, 고정 문구', async () => {
  const h = makeDeps({ routerOut: hintRouter });
  const out = await run(h, followUp({ readSlugs: [] }));
  assert.equal(out.response.answer, MESSAGES.noPosts);
  assert.deepEqual(out.response.sources, []);
});

test('폴백: 라우터가 []이거나 파싱 불가여도 짧은 후속 질문은 readSlugs[0]을 읽는다', async () => {
  for (const routerOut of ['{"slugs":[]}', 'not json']) {
    const h = makeDeps({ routerOut });
    const out = await run(h, followUp({ readSlugs: ['b', 'a'] }));
    assert.deepEqual(h.postCalls, ['b']);
    assert.deepEqual(out.response.sources, [{ title: 'T-b', slug: 'b' }]);
    assert.equal(h.calls.filter((c) => c.call === 'router').length, 1);
  }
});

test('폴백: 질문이 41자 이상이거나 history가 비면 폴백하지 않는다', async () => {
  const h1 = makeDeps({ routerOut: '{"slugs":[]}' });
  const out1 = await run(h1, followUp({ message: '가'.repeat(41) }));
  assert.equal(out1.response.answer, MESSAGES.noPosts);
  const h2 = makeDeps({ routerOut: '{"slugs":[]}' });
  const out2 = await run(h2, followUp({ history: [] }));
  assert.equal(out2.response.answer, MESSAGES.noPosts);
  assert.deepEqual(h1.postCalls.concat(h2.postCalls), []);
});

test('기준2: 라우터가 5개를 내도 getPost와 sources는 3개 이하', async () => {
  const h = makeDeps({ routerOut: '{"slugs":["a","b","c","d","e"]}' });
  const out = await run(h, req());
  assert.equal(h.postCalls.length, 3);
  assert.equal(out.response.sources.length, 3);
});

test('readSlugs: index에 있는 것만 <recent_read>에 들어가고 읽는 글은 3편 이하', async () => {
  const h = makeDeps({ routerOut: '{"slugs":["a","b","c","d","e"]}' });
  const out = await run(
    h,
    followUp({ readSlugs: ['x1', 'a', 'b', 'c', 'd', 'e'] })
  );
  const router = h.calls.find((c) => c.call === 'router');
  assert.match(router.user, /<recent_read>\na\nb\nc\nd\ne\n<\/recent_read>/);
  assert.doesNotMatch(router.user, /x1/);
  assert.equal(h.postCalls.length, 3);
  assert.equal(out.response.sources.length, 3);
});

test('폴백: index에 없는 readSlugs는 제외되고 첫 유효 slug를 쓴다', async () => {
  const h = makeDeps({ routerOut: '{"slugs":[]}' });
  const out = await run(h, followUp({ readSlugs: ['zzz', 'a'] }));
  const router = h.calls.find((c) => c.call === 'router');
  assert.doesNotMatch(router.user, /zzz/);
  assert.deepEqual(h.postCalls, ['a']);
  assert.equal(out.response.sources[0].slug, 'a');
});

test('폴백 slug의 getPost가 실패하면 고정 문구', async () => {
  const h = makeDeps({ routerOut: '{"slugs":[]}', failPosts: ['a'] });
  const out = await run(h, followUp());
  assert.equal(out.response.answer, MESSAGES.noPosts);
  assert.deepEqual(out.response.sources, []);
});

test('getIndex 실패는 data 에러이고 아무것도 저장되지 않는다 (첫 턴, 후속)', async () => {
  for (const r of [req(), followUp()]) {
    const h = makeDeps({
      getIndex: async () => {
        throw new Error('db down');
      },
    });
    await assert.rejects(run(h, r), (e) => e.kind === 'data');
    assert.equal(h.cache.stats.stored, 0);
    assert.equal(h.calls.length, 0);
  }
});

test('M1: TTL을 넘긴 캐시 항목은 miss로 보고 새로 계산한다', async () => {
  const keys = [];
  const staleCache = {
    stats: { stored: 0 },
    fn: async (key) => {
      keys.push(key);
      return { answer: 'old', sources: [], cachedAt: 0 };
    },
  };
  const h = makeDeps({
    routerOut: '{"slugs":["a"]}',
    cache: staleCache,
    start: 90_000_000,
  });
  const out = await run(h, req());
  assert.equal(out.response.answer, 'answer');
  assert.equal(out.cacheHit, false);
  assert.ok(h.logs.some((l) => l.fields.result === 'stale'));
  assert.match(keys[0], /^1:/); // 86400s bucket in the key
});

test('L3: 시간이 1초 미만 남으면 라우터를 부르지 않는다', async () => {
  const h = makeDeps({ deadlineMs: 500 });
  await assert.rejects(run(h, req()), (e) => e.kind === 'timeout');
  assert.equal(h.calls.length, 0);
});

test('L3: 마감 안에 끝나지 않는 index 읽기는 timeout', async () => {
  const h = makeDeps({
    deadlineMs: 1100,
    getIndex: () => new Promise(() => {}),
  });
  await assert.rejects(run(h, req()), (e) => e.kind === 'timeout');
  assert.equal(h.calls.length, 0);
});

test('기준3: 없는 slug와 중복은 버리고 읽은 글만 sources', async () => {
  const h = makeDeps({ routerOut: '{"slugs":["a","없는x","a","b"]}' });
  const out = await run(h, req());
  assert.deepEqual(h.postCalls, ['a', 'b']);
  assert.deepEqual(
    out.response.sources.map((s) => s.slug),
    ['a', 'b']
  );
});

test('기준3: getPost 실패한 글은 컨텍스트와 sources에서 빠진다', async () => {
  const h = makeDeps({
    routerOut: '{"slugs":["a","b"]}',
    failPosts: ['b'],
  });
  const out = await run(h, req());
  assert.deepEqual(
    out.response.sources.map((s) => s.slug),
    ['a']
  );
  const answer = h.calls.find((c) => c.call === 'answer');
  assert.doesNotMatch(answer.system, /body of b/);
});

test('기준3: 답변이 다른 slug를 언급해도 sources는 읽은 글 그대로', async () => {
  const h = makeDeps({
    routerOut: '{"slugs":["a"]}',
    answerOut: { content: 'c 글도 보세요 (slug: c)', finishReason: 'stop' },
  });
  const out = await run(h, req());
  assert.deepEqual(out.response.sources, [{ title: 'T-a', slug: 'a' }]);
});

test('라우팅: JSON이 아니거나 slugs가 배열이 아니면 0편', async () => {
  for (const routerOut of [
    'oops',
    '{"slugs":"a"}',
    '{"x":1}',
    '{"slugs":[1,2]}',
  ]) {
    const h = makeDeps({ routerOut });
    const out = await run(h, req());
    assert.equal(out.response.answer, MESSAGES.noPosts);
    assert.equal(h.postCalls.length, 0);
  }
});

test('라우팅: 모든 slug가 index에 없으면 0편', async () => {
  const h = makeDeps({ routerOut: '{"slugs":["zzz"]}' });
  const out = await run(h, req());
  assert.deepEqual(out.response.sources, []);
});

test('0편: 답변 LLM 호출 0회, 고정 문구, sources 빈 배열', async () => {
  const h = makeDeps({ routerOut: '{"slugs":[]}' });
  const out = await run(h, req());
  assert.equal(h.calls.filter((c) => c.call === 'answer').length, 0);
  assert.equal(out.response.answer, MESSAGES.noPosts);
  assert.deepEqual(out.response.sources, []);
});

test('캐시 규칙: history·readSlugs가 비면 첫 턴 경로, 하나라도 있으면 우회', async () => {
  const h1 = makeDeps({ routerOut: '{"slugs":["a"]}' });
  assert.equal((await run(h1, req())).firstTurn, true);
  const h2 = makeDeps({ routerOut: '{"slugs":["a"]}' });
  const o2 = await run(h2, req({ readSlugs: ['a'] }));
  assert.equal(o2.firstTurn, false);
  assert.equal(h2.cache.stats.stored, 0);
  const h3 = makeDeps({ routerOut: '{"slugs":["a"]}' });
  const o3 = await run(h3, req({ history: [{ role: 'user', content: 'x' }] }));
  assert.equal(o3.firstTurn, false);
  assert.equal(h3.cache.stats.stored, 0);
});

test('캐시 저장 안 됨: 0편, 파싱 실패, 일부 읽기 실패, finish_reason length', async () => {
  const cases = [
    { routerOut: '{"slugs":[]}' },
    { routerOut: 'not json' },
    { routerOut: '{"slugs":["a","b"]}', failPosts: ['b'] },
    {
      routerOut: '{"slugs":["a"]}',
      answerOut: { content: 'cut', finishReason: 'length' },
    },
  ];
  for (const c of cases) {
    const h = makeDeps(c);
    const out = await run(h, req());
    assert.equal(h.cache.stats.stored, 0);
    assert.ok(out.response.answer.length > 0);
    // thrown result is used as-is: one router call, at most one answer call
    assert.equal(h.calls.filter((x) => x.call === 'router').length, 1);
    assert.ok(h.calls.filter((x) => x.call === 'answer').length <= 1);
  }
});

test('캐시 저장됨: 1편 이상 + 전부 읽음 + stop, 두 번째는 LLM 없이 hit', async () => {
  const cache = memoryCache();
  const h1 = makeDeps({ routerOut: '{"slugs":["a"]}', cache, start: 1000 });
  const o1 = await run(h1, req({ message: '  Hello   World ' }));
  assert.equal(cache.stats.stored, 1);
  assert.equal(o1.cacheHit, false);
  assert.equal('cachedAt' in o1.response, false);

  const h2 = makeDeps({ routerOut: '{"slugs":["a"]}', cache, start: 5000 });
  const o2 = await run(h2, req({ message: 'hello world' }));
  assert.equal(h2.calls.length, 0);
  assert.equal(o2.cacheHit, true);
  assert.deepEqual(o2.response, o1.response);
  assert.ok(h2.logs.some((l) => l.fields.result === 'hit'));
});

test('마감: 라우터 후 남은 시간이 1초 미만이면 답변 호출 없이 실패', async () => {
  const h = makeDeps({ routerOut: '{"slugs":["a"]}', routerMs: 24_500 });
  await assert.rejects(run(h, req()), (e) => e.kind === 'timeout');
  assert.equal(h.calls.filter((c) => c.call === 'answer').length, 0);
});

test('마감: 두 호출의 timeout이 같은 deadline에서 계산된다', async () => {
  const h = makeDeps({ routerOut: '{"slugs":["a"]}', routerMs: 3000 });
  await run(h, req());
  const [router, answer] = h.calls;
  assert.equal(router.timeoutMs, 25_000);
  assert.equal(answer.timeoutMs, 22_000);
});

test('로그: 필드는 원시값뿐이고 질문·답변·history 텍스트가 없다, miss/skip 기록', async () => {
  const miss = makeDeps({
    routerOut: '{"slugs":["a"]}',
    answerOut: { content: '비밀답변문장', finishReason: 'stop' },
  });
  await run(miss, req({ message: '비밀질문문장' }));
  const skip = makeDeps({ routerOut: '{"slugs":[]}' });
  await run(skip, req({ message: '비밀질문문장' }));
  const follow = makeDeps({ routerOut: '{"slugs":["a"]}' });
  await run(
    follow,
    followUp({ history: [{ role: 'user', content: '비밀히스토리' }] })
  );

  const results = (h) =>
    h.logs.filter((l) => l.event === 'chat_cache').map((l) => l.fields.result);
  assert.deepEqual(results(miss), ['miss']);
  assert.deepEqual(results(skip), ['skip']);

  for (const h of [miss, skip, follow]) {
    assert.ok(h.logs.length > 0);
    for (const { fields } of h.logs) {
      for (const v of Object.values(fields)) {
        assert.ok(
          ['string', 'number', 'boolean'].includes(typeof v) || v === null
        );
      }
    }
    assert.doesNotMatch(
      JSON.stringify(h.logs),
      /비밀질문문장|비밀답변문장|비밀히스토리/
    );
  }
});
