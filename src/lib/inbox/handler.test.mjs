import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleInboxGet,
  handleInboxPatch,
  handleInboxPost,
  LIST_LIMIT,
  MAX_BODY_CHARS,
  MAX_REQUEST_BYTES,
} from './handler.ts';

const ITEM = { id: '00000000-0000-4000-8000-000000000001', body: 'x', created_at: '2026-11-01T00:00:00Z' };

function setup({ admin = true, list, insert, update } = {}) {
  const logs = [];
  const calls = { list: [], insert: [], update: [] };
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
      async update(id, body) {
        calls.update.push([id, body]);
        return update ?? { ok: true, value: { ...ITEM, id, body } };
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

const ID = ITEM.id;

const patch = (body, headers = {}) =>
  new Request('https://blog.example/api/admin/inbox', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('PATCH: admin 아니면 401, 저장소를 부르지 않음', async () => {
  const s = setup({ admin: false });
  const r = await handleInboxPatch(patch({ id: ID, body: 'hi' }), s.deps);
  assert.equal(r.status, 401);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(s.calls.update.length, 0);
});

test('PATCH: 다른 사이트 요청(Sec-Fetch-Site, 다른 Origin host, 깨진 Origin)은 403', async () => {
  const cases = [{ 'sec-fetch-site': 'cross-site' }, { origin: 'https://evil.example' }, { origin: 'not a url' }];
  for (const headers of cases) {
    const s = setup();
    const r = await handleInboxPatch(patch({ id: ID, body: 'hi' }, headers), s.deps);
    assert.equal(r.status, 403, JSON.stringify(headers));
    assert.equal(r.headers['Cache-Control'], 'no-store');
    assert.equal(s.calls.update.length, 0);
  }
});

test('PATCH: JSON이 아니면 415, 16KB 넘으면 413, 깨진 JSON은 400', async () => {
  const s = setup();
  const r415 = await handleInboxPatch(patch('x', { 'content-type': 'text/plain' }), s.deps);
  assert.equal(r415.status, 415);
  const r413 = await handleInboxPatch(patch({ id: ID, body: 'a'.repeat(MAX_REQUEST_BYTES) }), s.deps);
  assert.equal(r413.status, 413);
  const r400 = await handleInboxPatch(patch('not json'), s.deps);
  assert.equal(r400.status, 400);
  for (const r of [r415, r413, r400]) assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(s.calls.update.length, 0);
});

test('PATCH: body가 숫자·null·공백뿐·2001자면 400', async () => {
  for (const body of [1, null, '   ', 'a'.repeat(MAX_BODY_CHARS + 1)]) {
    const s = setup();
    const r = await handleInboxPatch(patch({ id: ID, body }), s.deps);
    assert.equal(r.status, 400, String(body).slice(0, 10));
    assert.equal(r.headers['Cache-Control'], 'no-store');
    assert.equal(s.calls.update.length, 0);
  }
});

test('PATCH: id가 없거나 uuid가 아니거나 문자열이 아니면 400, DB 호출 전에 막음', async () => {
  for (const id of [undefined, 'abc', '123', '', ID + 'x', 5, null, [ID], { a: 1 }]) {
    const s = setup();
    const r = await handleInboxPatch(patch({ id, body: 'hi' }), s.deps);
    assert.equal(r.status, 400, JSON.stringify(id));
    assert.equal(s.calls.update.length, 0);
  }
});

test('PATCH: 검사 순서 401 < 403, 415 < 413 < 400', async () => {
  const bad = { 'sec-fetch-site': 'cross-site' };
  const s1 = setup({ admin: false });
  assert.equal((await handleInboxPatch(patch('x', { ...bad, 'content-type': 'text/plain' }), s1.deps)).status, 401);
  const s2 = setup();
  assert.equal((await handleInboxPatch(patch('x', { ...bad, 'content-type': 'text/plain' }), s2.deps)).status, 403);
  const big = 'a'.repeat(MAX_REQUEST_BYTES + 1);
  assert.equal((await handleInboxPatch(patch(big, { 'content-type': 'text/plain' }), s2.deps)).status, 415);
  assert.equal((await handleInboxPatch(patch(big), s2.deps)).status, 413);
  assert.equal((await handleInboxPatch(patch('not json'), s2.deps)).status, 400);
});

test('PATCH: 앞뒤 공백을 지우고 저장, 200 {item}', async () => {
  const s = setup();
  const r = await handleInboxPatch(patch({ id: ID, body: '  고친 생각\n' }), s.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(s.calls.update, [[ID, '고친 생각']]);
  assert.equal(r.body.item.body, '고친 생각');
  assert.equal(r.headers['Cache-Control'], 'no-store');
});

test('PATCH: 대상 행이 없으면 404, 응답에 id·본문을 싣지 않음', async () => {
  const s = setup({ update: { ok: true, value: null } });
  const r = await handleInboxPatch(patch({ id: ID, body: 'secret thought' }), s.deps);
  assert.equal(r.status, 404);
  assert.deepEqual(r.body, { error: 'Not Found' });
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(r.body), new RegExp(`${ID}|secret thought`));
});

test('PATCH 저장소 오류: 42501→403, 23514→400, 나머지 500, 로그에 코드만', async () => {
  for (const [code, status] of [['42501', 403], ['23514', 400], ['XX000', 500]]) {
    const s = setup({ update: { ok: false, code } });
    const r = await handleInboxPatch(patch({ id: ID, body: 'secret thought' }), s.deps);
    assert.equal(r.status, status);
    assert.equal(r.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(JSON.stringify(r.body), /secret thought/);
    assert.doesNotMatch(JSON.stringify(s.logs), /secret thought|message/);
    assert.deepEqual(s.logs, [{ event: 'store_error', fields: { op: 'update', code } }]);
  }
});
