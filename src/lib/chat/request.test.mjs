import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatRequest } from './request.ts';

const post = (body, headers = { 'content-type': 'application/json' }) =>
  new Request('http://x/api/chat', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const status = async (r) => (await parseChatRequest(r)).status;

test('Content-Type이 json이 아니면 415', async () => {
  assert.equal(
    await status(post({ message: 'a' }, { 'content-type': 'text/plain' })),
    415
  );
});

test('JSON 깨짐, 비객체, message 타입/길이 오류는 400', async () => {
  assert.equal(await status(post('{oops')), 400);
  assert.equal(await status(post('[1]')), 400);
  assert.equal(await status(post({ message: 1 })), 400);
  assert.equal(await status(post({ message: ['a'] })), 400);
  assert.equal(await status(post({ message: '   ' })), 400);
  assert.equal(await status(post({ message: 'a'.repeat(501) })), 400);
  assert.equal(
    (await parseChatRequest(post({ message: 'a'.repeat(500) }))).ok,
    true
  );
});

test('Content-Length가 32KB 초과면 413', async () => {
  const r = post(
    { message: 'a' },
    {
      'content-type': 'application/json',
      'content-length': '40000',
    }
  );
  assert.equal(await status(r), 413);
});

test('Content-Length 없이 스트림이 32KB 초과면 413', async () => {
  const big = JSON.stringify({ message: 'a', pad: 'x'.repeat(40000) });
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(big));
      c.close();
    },
  });
  const r = new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  });
  assert.equal(await status(r), 413);
});

test('Content-Length를 작게 속여도 스트림 상한으로 413', async () => {
  const big = JSON.stringify({ message: 'a', pad: 'x'.repeat(40000) });
  const r = post(big, {
    'content-type': 'application/json',
    'content-length': '10',
  });
  assert.equal(await status(r), 413);
});

test('history는 마지막 6개만, content는 1000자로 자른다', async () => {
  const history = Array.from({ length: 8 }, (_, i) => ({
    role: 'user',
    content: i === 7 ? 'x'.repeat(1001) : `m${i}`,
  }));
  const r = await parseChatRequest(post({ message: 'q', history }));
  assert.equal(r.ok, true);
  assert.equal(r.value.history.length, 6);
  assert.equal(r.value.history[0].content, 'm2');
  assert.equal(r.value.history[5].content.length, 1000);
});

test('거대한 history 배열도 자른 뒤에만 항목을 검사한다', async () => {
  const history = [
    ...Array.from({ length: 5000 }, () => 1),
    ...Array.from({ length: 6 }, () => ({ role: 'user', content: 'ok' })),
  ];
  const r = await parseChatRequest(post({ message: 'q', history }));
  assert.equal(r.ok, true);
});

test('history role 오류와 배열 아님은 400', async () => {
  assert.equal(
    await status(
      post({ message: 'q', history: [{ role: 'system', content: 'x' }] })
    ),
    400
  );
  assert.equal(await status(post({ message: 'q', history: 'x' })), 400);
  assert.equal(await status(post({ message: 'q', readSlugs: 'x' })), 400);
});

test('slug: 한글 통과, NFD는 NFC로 변환, 잘못된 형식은 400', async () => {
  const ok = await parseChatRequest(
    post({ message: 'q', readSlugs: ['개발-블로그'] })
  );
  assert.deepEqual(ok.value.readSlugs, ['개발-블로그']);
  const nfd = await parseChatRequest(
    post({ message: 'q', readSlugs: ['개발-블로그'.normalize('NFD')] })
  );
  assert.equal(nfd.ok, true);
  assert.deepEqual(nfd.value.readSlugs, ['개발-블로그'.normalize('NFC')]);
  for (const bad of ['a b', 'a/b', '..', 'a<b', 'a'.repeat(101), '']) {
    assert.equal(
      await status(post({ message: 'q', readSlugs: [bad] })),
      400,
      bad
    );
  }
});

test('readSlugs는 앞 6개만 쓴다', async () => {
  const r = await parseChatRequest(
    post({ message: 'q', readSlugs: ['a', 'b', 'c', 'd', 'e', 'f', '!!bad'] })
  );
  assert.equal(r.ok, true);
  assert.equal(r.value.readSlugs.length, 6);
});

test('Content-Type: 대소문자·charset 허용, 비슷한 타입은 415', async () => {
  const ok = await parseChatRequest(
    post(
      { message: 'a' },
      { 'content-type': 'Application/JSON; charset=utf-8' }
    )
  );
  assert.equal(ok.ok, true);
  assert.equal(
    await status(
      post({ message: 'a' }, { 'content-type': 'application/jsonx' })
    ),
    415
  );
});

test('L1: 본문 스트림이 중간에 끊기면 400', async () => {
  const stream = new ReadableStream({
    start(c) {
      c.error(new Error('aborted'));
    },
  });
  const r = new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  });
  assert.equal(await status(r), 400);
});
