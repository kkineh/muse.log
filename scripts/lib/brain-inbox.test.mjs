import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DONE_LIMIT,
  InboxError,
  LIST_LIMIT,
  countUnprocessed,
  listUnprocessed,
  markDone,
  sanitizeBody,
  validateIds,
} from './brain-inbox.mjs';

const ID1 = '00000000-0000-4000-8000-000000000001';
const ID2 = '00000000-0000-4000-8000-000000000002';

// supabase-js 체인을 흉내 낸다. 호출을 기록하고 마지막에 result로 끝난다
function fakeClient(result) {
  const calls = [];
  const chain = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') return (resolve) => resolve(result);
        return (...args) => {
          calls.push([prop, ...args]);
          return chain;
        };
      },
    }
  );
  return { client: { from: (t) => (calls.push(['from', t]), chain) }, calls };
}

test('count: head 요청으로 본문을 받지 않고 건수만', async () => {
  const f = fakeClient({ count: 3, error: null });
  assert.equal(await countUnprocessed(f.client), 3);
  assert.deepEqual(f.calls, [
    ['from', 'inbox'],
    ['select', 'id', { count: 'exact', head: true }],
    ['is', 'processed_at', null],
  ]);
});

test('count: error 없이 404나 건수 없음으로 와도 0이 아니라 실패', async () => {
  await assert.rejects(countUnprocessed(fakeClient({ count: null, error: null, status: 404 }).client), InboxError);
  await assert.rejects(countUnprocessed(fakeClient({ count: null, error: null, status: 200 }).client), InboxError);
});

test('list: 미처리만 오래된 순 50개, 본문 정리', async () => {
  const f = fakeClient({
    data: [{ id: ID1, created_at: 't', body: 'a\u001b[31mred\u202e\u0007\nb\tc', extra: 1 }],
    error: null,
  });
  const items = await listUnprocessed(f.client);
  assert.deepEqual(items, [{ id: ID1, created_at: 't', body: 'ared\nb\tc' }]);
  assert.deepEqual(f.calls.slice(2), [
    ['is', 'processed_at', null],
    ['order', 'created_at', { ascending: true }],
    ['limit', LIST_LIMIT],
  ]);
});

test('sanitizeBody: 한글·이모지·줄바꿈은 그대로', () => {
  assert.equal(sanitizeBody('생각 😀\n둘째 줄'), '생각 😀\n둘째 줄');
});

test('validateIds: 비었거나, 너무 많거나, uuid가 아니면 거부', () => {
  assert.match(validateIds([]), /하나 이상/);
  assert.match(validateIds(Array(DONE_LIMIT + 1).fill(ID1)), /까지/);
  assert.match(validateIds([ID1, "x' or 1=1"]), /uuid/);
  assert.equal(validateIds([ID1, ID2.toUpperCase()]), null);
});

test('done: 미처리인 것만, 중복 제거, 바뀐 건수 반환', async () => {
  const f = fakeClient({ data: [{ id: ID1 }], error: null });
  const now = new Date('2026-11-01T00:00:00Z');
  assert.equal(await markDone(f.client, [ID1, ID1, ID2], now), 1);
  assert.deepEqual(f.calls.slice(1), [
    ['update', { processed_at: '2026-11-01T00:00:00.000Z' }],
    ['in', 'id', [ID1, ID2]],
    ['is', 'processed_at', null],
    ['select', 'id'],
  ]);
});

test('오류: 코드만 담고 Supabase 메시지·details(본문 포함 가능)는 버림', async () => {
  const f = fakeClient({
    data: null,
    error: { code: '23514', message: 'violates check', details: 'Failing row contains (secret thought)' },
  });
  await assert.rejects(listUnprocessed(f.client), (err) => {
    assert.ok(err instanceof InboxError);
    assert.equal(err.code, '23514');
    assert.doesNotMatch(err.message, /secret|violates/);
    return true;
  });
});
