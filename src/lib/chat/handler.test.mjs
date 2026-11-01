import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat } from './handler.ts';
import { ChatError } from './errors.ts';
import { MESSAGES } from './config.ts';
import { createRateLimiter } from './rate-limit.ts';
import { makeDeps } from './test-helpers.mjs';

function setup(opts = {}) {
  const h = makeDeps({ routerOut: '{"slugs":["a"]}', ...opts.chat });
  const errLogs = [];
  let created = 0;
  const deps = {
    isDisabled: () => opts.disabled ?? false,
    getApiKey: () => ('apiKey' in opts ? opts.apiKey : 'sk-test'),
    limiter: opts.limiter ?? createRateLimiter(),
    createChatDeps: () => {
      created++;
      return h.deps;
    },
    log: (event, fields) => errLogs.push({ event, fields }),
    now: () => 1000,
  };
  return { h, deps, errLogs, created: () => created };
}

const post = (body, headers = {}) =>
  new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const NO_STORE = 'no-store';

test('CHAT_DISABLED: 503 고정 문구, DB·LLM 호출 없음', async () => {
  const s = setup({ disabled: true });
  const r = await handleChat(post({ message: 'q' }), s.deps);
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { error: MESSAGES.disabled });
  assert.equal(r.headers['Cache-Control'], NO_STORE);
  assert.equal(s.created(), 0);
  assert.equal(s.h.calls.length, 0);
  assert.equal(s.h.postCalls.length, 0);
});

test('OPENAI_API_KEY 없음: 503', async () => {
  const s = setup({ apiKey: undefined });
  const r = await handleChat(post({ message: 'q' }), s.deps);
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { error: MESSAGES.unavailable });
  assert.equal(s.created(), 0);
});

test('성공: 200, answer와 sources, no-store', async () => {
  const s = setup();
  const r = await handleChat(post({ message: 'q' }), s.deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.answer, 'answer');
  assert.deepEqual(r.body.sources, [{ title: 'T-a', slug: 'a' }]);
  assert.equal(r.headers['Cache-Control'], NO_STORE);
});

test('ChatError quota는 503 고정 문구, 그 밖의 kind와 일반 에러는 500, 로그는 kind만', async () => {
  const q = setup({ chat: { llmError: new ChatError('quota') } });
  const rq = await handleChat(post({ message: 'q' }), q.deps);
  assert.equal(rq.status, 503);
  assert.deepEqual(rq.body, { error: MESSAGES.unavailable });
  assert.deepEqual(q.errLogs, [
    { event: 'chat_error', fields: { kind: 'quota' } },
  ]);

  for (const err of [
    new ChatError('upstream'),
    new ChatError('timeout'),
    new Error('secret upstream detail'),
  ]) {
    const s = setup({ chat: { llmError: err } });
    const r = await handleChat(post({ message: 'q' }), s.deps);
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: MESSAGES.internal });
    assert.equal(r.headers['Cache-Control'], NO_STORE);
    assert.doesNotMatch(JSON.stringify([r.body, s.errLogs]), /secret/);
    assert.deepEqual(Object.keys(s.errLogs[0].fields), ['kind']);
  }
});

test('검증 오류 415/413/400도 no-store', async () => {
  const s = setup();
  const cases = [
    new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x',
    }),
    post({ message: 'a' }, { 'content-length': '99999' }),
    post('{oops'),
  ];
  const statuses = [];
  for (const c of cases) {
    const r = await handleChat(c, s.deps);
    statuses.push(r.status);
    assert.equal(r.headers['Cache-Control'], NO_STORE);
  }
  assert.deepEqual(statuses, [415, 413, 400]);
});

test('429: Retry-After와 no-store, 한도 카운트는 호출 사이에 유지된다', async () => {
  const s = setup({ limiter: createRateLimiter({ limit: 2, now: () => 0 }) });
  const ip = { 'x-vercel-forwarded-for': '9.9.9.9' };
  assert.equal(
    (await handleChat(post({ message: 'q' }, ip), s.deps)).status,
    200
  );
  assert.equal(
    (await handleChat(post({ message: 'q' }, ip), s.deps)).status,
    200
  );
  const r = await handleChat(post({ message: 'q' }, ip), s.deps);
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers['Retry-After']) >= 1);
  assert.equal(r.headers['Cache-Control'], NO_STORE);
  const other = await handleChat(
    post({ message: 'q' }, { 'x-vercel-forwarded-for': '8.8.8.8' }),
    s.deps
  );
  assert.equal(other.status, 200);
});
