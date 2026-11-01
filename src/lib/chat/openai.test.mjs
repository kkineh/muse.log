import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiLlm } from './openai.ts';

const llmReq = {
  call: 'answer',
  system: '시스템비밀',
  user: '사용자비밀',
  temperature: 0,
  maxTokens: 10,
  json: false,
  timeoutMs: 1000,
};
const respond = (status, body) => async () =>
  new Response(JSON.stringify(body), { status });

function make(fetchFn) {
  const logs = [];
  const llm = createOpenAiLlm({
    apiKey: 'sk-test-secret',
    model: 'm',
    fetchFn,
    log: (event, fields) => logs.push({ event, fields }),
  });
  return { llm, logs };
}

test('429 insufficient_quota는 quota 에러로 바뀌고 업스트림 메시지는 새지 않는다', async () => {
  const { llm, logs } = make(
    respond(429, {
      error: { code: 'insufficient_quota', message: '카드 만료됨' },
    })
  );
  await assert.rejects(
    llm(llmReq),
    (e) => e.kind === 'quota' && !/카드/.test(e.message)
  );
  assert.doesNotMatch(JSON.stringify(logs), /카드|sk-test|비밀/);
  assert.equal(logs[0].fields.errorCode, 'insufficient_quota');
});

test('일반 429도 quota, 그 밖의 비 2xx는 upstream', async () => {
  const a = make(respond(429, {}));
  await assert.rejects(a.llm(llmReq), (e) => e.kind === 'quota');
  const b = make(respond(500, {}));
  await assert.rejects(b.llm(llmReq), (e) => e.kind === 'upstream');
});

test('성공: cached_tokens, 토큰 수, finish_reason을 기록하고 본문은 기록하지 않는다', async () => {
  const { llm, logs } = make(
    respond(200, {
      choices: [{ message: { content: '답변본문' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 64 },
      },
    })
  );
  const out = await llm(llmReq);
  assert.deepEqual(out, { content: '답변본문', finishReason: 'stop' });
  assert.equal(logs[0].fields.cachedTokens, 64);
  assert.equal(logs[0].fields.promptTokens, 100);
  assert.equal(logs[0].fields.finishReason, 'stop');
  assert.doesNotMatch(JSON.stringify(logs), /답변본문|시스템비밀|사용자비밀/);
});

test('네트워크 오류는 upstream, 타임아웃은 timeout', async () => {
  const a = make(async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(a.llm(llmReq), (e) => e.kind === 'upstream');
  const b = make(async () => {
    const e = new Error('t');
    e.name = 'TimeoutError';
    throw e;
  });
  await assert.rejects(b.llm(llmReq), (e) => e.kind === 'timeout');
});

test('요청 형태: 헤더, max_completion_tokens, json일 때만 response_format, timeout signal', async () => {
  const seen = [];
  const { llm } = make(async (url, init) => {
    seen.push({ url, init, body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: 'x' }, finish_reason: 'stop' }],
      }),
      { status: 200 }
    );
  });
  await llm({ ...llmReq, json: true, maxTokens: 100 });
  await llm({ ...llmReq, json: false, maxTokens: 300 });
  assert.equal(seen[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer sk-test-secret');
  assert.deepEqual(seen[0].body.response_format, { type: 'json_object' });
  assert.equal(seen[0].body.max_completion_tokens, 100);
  assert.equal('response_format' in seen[1].body, false);
  assert.equal(seen[1].body.max_completion_tokens, 300);
  assert.equal(seen[0].body.messages[0].role, 'system');
  assert.ok(seen[0].init.signal instanceof AbortSignal);
});

test('JSON이 아닌 본문과 문자열이 아닌 content는 upstream', async () => {
  const a = make(async () => new Response('<html>', { status: 200 }));
  await assert.rejects(a.llm(llmReq), (e) => e.kind === 'upstream');
  const b = make(respond(200, { choices: [{ message: { content: null } }] }));
  await assert.rejects(b.llm(llmReq), (e) => e.kind === 'upstream');
});

test('402는 quota', async () => {
  const { llm } = make(respond(402, {}));
  await assert.rejects(llm(llmReq), (e) => e.kind === 'quota');
});

test('본문을 읽는 중 타임아웃은 timeout', async () => {
  const { llm } = make(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      const e = new Error('t');
      e.name = 'TimeoutError';
      throw e;
    },
  }));
  await assert.rejects(llm(llmReq), (e) => e.kind === 'timeout');
});
