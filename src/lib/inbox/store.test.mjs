import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxStore } from './store.ts';

const ID = '00000000-0000-4000-8000-000000000001';
const ROW = { id: ID, body: 'new', created_at: '2026-11-01T00:00:00Z' };

// update().eq().is().select() 체인을 흉내 내는 mock 클라이언트
function mockClient(response) {
  const seen = { payload: null, eq: null, is: null, select: null };
  const chain = {
    update(payload) {
      seen.payload = payload;
      return chain;
    },
    eq(...args) {
      seen.eq = args;
      return chain;
    },
    is(...args) {
      seen.is = args;
      return chain;
    },
    select(cols) {
      seen.select = cols;
      return Promise.resolve(response);
    },
  };
  return { client: { from: () => chain }, seen };
}

test('update: body만 보내고 미처리 행만 대상으로 함', async () => {
  const { client, seen } = mockClient({ data: [ROW], error: null });
  const r = await createInboxStore(client).update(ID, 'new');
  assert.deepEqual(r, { ok: true, value: ROW });
  assert.deepEqual(seen.payload, { body: 'new' });
  assert.deepEqual(seen.eq, ['id', ID]);
  assert.deepEqual(seen.is, ['processed_at', null]);
  assert.equal(seen.select, 'id, body, created_at');
});

test('update: 0행이면 오류가 아니라 value null', async () => {
  const { client } = mockClient({ data: [], error: null });
  assert.deepEqual(await createInboxStore(client).update(ID, 'new'), { ok: true, value: null });
});

test('update: 오류는 코드만 돌려줌', async () => {
  const { client } = mockClient({ data: null, error: { code: '42501', message: 'secret' } });
  assert.deepEqual(await createInboxStore(client).update(ID, 'new'), { ok: false, code: '42501' });
});
