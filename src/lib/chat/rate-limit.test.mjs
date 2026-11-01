import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, getClientKey } from './rate-limit.ts';

test('분당 8회, 9번째는 거부되고 Retry-After가 있다', () => {
  let t = 0;
  const rl = createRateLimiter({ now: () => t });
  for (let i = 0; i < 8; i++) assert.equal(rl.check('ip').allowed, true);
  const r = rl.check('ip');
  assert.equal(r.allowed, false);
  assert.ok(r.retryAfterSeconds >= 1);
  t += 60_001;
  assert.equal(rl.check('ip').allowed, true);
});

test('키가 상한을 넘으면 오래된 키부터 제거되고 크기가 상한을 넘지 않는다', () => {
  const rl = createRateLimiter({ maxKeys: 5, now: () => 0 });
  for (let i = 0; i < 20; i++) rl.check(`k${i}`);
  assert.equal(rl.size(), 5);
});

test('60초 지난 항목은 청소된다', () => {
  let t = 0;
  const rl = createRateLimiter({ now: () => t });
  for (let i = 0; i < 10; i++) rl.check(`k${i}`);
  t = 61_000;
  rl.check('new');
  assert.equal(rl.size(), 1);
});

test('IP 키: x-vercel-forwarded-for 우선, 없으면 x-real-ip, 없으면 공용 버킷', () => {
  const h = (o) => new Headers(o);
  assert.equal(
    getClientKey(
      h({
        'x-vercel-forwarded-for': '1.1.1.1, 2.2.2.2',
        'x-real-ip': '3.3.3.3',
      })
    ),
    '1.1.1.1'
  );
  assert.equal(getClientKey(h({ 'x-real-ip': '3.3.3.3, 4.4.4.4' })), '3.3.3.3');
  assert.equal(getClientKey(h({})), 'unknown');
});
