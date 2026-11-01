import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleInboxGet,
  handleInboxPost,
  LIST_LIMIT,
  MAX_BODY_CHARS,
  MAX_REQUEST_BYTES,
} from './handler.ts';

const ITEM = { id: '00000000-0000-4000-8000-000000000001', body: 'x', created_at: '2026-11-01T00:00:00Z' };

function setup({ admin = true, list, insert } = {}) {
  const logs = [];
  const calls = { list: [], insert: [] };
  const deps = {
    isAdmin: async () => admin,
    store: {
      async listUnprocessed(limit) {
        calls.list.push(limit);
        return list ?? { ok: true, value: [ITEM] };
      },
      async insert(body) {
        calls.insert.push(body);
        return insert ?? { ok: true, value: { ...ITEM, body } };
      },
    },
    log: (event, fields) => logs.push({ event, fields }),
  };
  return { deps, logs, calls };
}

const post = (body, headers = {}) =>
  new Request('https://blog.example/api/admin/inbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('GET: admin 아니면 401, 저장소를 부르지 않음', async () => {
  const s = setup({ admin: false });
  const r = await handleInboxGet(s.deps);
  assert.equal(r.status, 401);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(s.calls.list.length, 0);
});

test('GET: 미처리 목록을 50개 제한으로 돌려줌', async () => {
  const s = setup();
  const r = await handleInboxGet(s.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { items: [ITEM] });
  assert.deepEqual(s.calls.list, [LIST_LIMIT]);
  assert.equal(r.headers['Cache-Control'], 'no-store');
});

test('POST: admin 아니면 401, 본문을 읽지 않음', async () => {
  const s = setup({ admin: false });
  const r = await handleInboxPost(post({ body: 'hi' }), s.deps);
  assert.equal(r.status, 401);
  assert.equal(s.calls.insert.length, 0);
});

test('POST: 다른 사이트 Origin이나 Sec-Fetch-Site cross-site는 403', async () => {
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const s = setup();
    const r = await handleInboxPost(post({ body: 'hi' }, headers), s.deps);
    assert.equal(r.status, 403);
    assert.equal(s.calls.insert.length, 0);
  }
});

test('POST: 같은 Origin은 통과', async () => {
  const s = setup();
  const r = await handleInboxPost(post({ body: 'hi' }, { origin: 'https://blog.example' }), s.deps);
  assert.equal(r.status, 201);
});

test('POST: JSON이 아니면 415 (대소문자·charset 허용)', async () => {
  const s = setup();
  assert.equal((await handleInboxPost(post('body=hi', { 'content-type': 'text/plain' }), s.deps)).status, 415);
  const ok = await handleInboxPost(post({ body: 'hi' }, { 'content-type': 'Application/JSON; charset=utf-8' }), s.deps);
  assert.equal(ok.status, 201);
});

test('POST: 16KB 넘으면 413', async () => {
  const s = setup();
  const r = await handleInboxPost(post({ body: 'a'.repeat(MAX_REQUEST_BYTES) }), s.deps);
  assert.equal(r.status, 413);
});

test('POST: 이모지 1000개(UTF-16 2000단위)는 16KB 안이라 저장됨', async () => {
  const s = setup();
  const r = await handleInboxPost(post({ body: '😀'.repeat(MAX_BODY_CHARS / 2) }), s.deps);
  assert.equal(r.status, 201);
});

test('POST: 잘못된 입력은 400', async () => {
  for (const body of ['not json', 'null', { body: 1 }, { body: '   ' }, { body: 'a'.repeat(MAX_BODY_CHARS + 1) }, {}]) {
    const s = setup();
    const r = await handleInboxPost(post(body), s.deps);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(s.calls.insert.length, 0);
  }
});

test('POST: 앞뒤 공백을 지우고 저장, 201', async () => {
  const s = setup();
  const r = await handleInboxPost(post({ body: '  생각 한 줄\n' }), s.deps);
  assert.equal(r.status, 201);
  assert.deepEqual(s.calls.insert, ['생각 한 줄']);
  assert.equal(r.body.item.body, '생각 한 줄');
  assert.equal(r.headers['Cache-Control'], 'no-store');
});

test('저장소 오류: 코드만 로그에 남기고 본문은 남기지 않음', async () => {
  const cases = [
    ['42501', 403],
    ['23514', 400],
    ['XX000', 500],
  ];
  for (const [code, status] of cases) {
    const s = setup({ insert: { ok: false, code } });
    const r = await handleInboxPost(post({ body: 'secret thought' }), s.deps);
    assert.equal(r.status, status);
    assert.equal(r.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(JSON.stringify(r.body), /secret thought/);
    assert.doesNotMatch(JSON.stringify(s.logs), /secret thought/);
    assert.deepEqual(s.logs, [{ event: 'store_error', fields: { op: 'insert', code } }]);
  }
});

test('GET 저장소 오류는 500', async () => {
  const s = setup({ list: { ok: false, code: 'XX000' } });
  const r = await handleInboxGet(s.deps);
  assert.equal(r.status, 500);
});
