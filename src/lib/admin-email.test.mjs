import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmail } from './admin-email.ts';

test('같은 이메일은 대소문자와 관계없이 admin', () => {
  assert.equal(isAdminEmail('Me@Example.com', 'me@example.com'), true);
});

test('다른 이메일은 admin 아님', () => {
  assert.equal(isAdminEmail('you@example.com', 'me@example.com'), false);
});

test('환경 변수가 없고 사용자 이메일도 없으면 admin 아님', () => {
  assert.equal(isAdminEmail(undefined, undefined), false);
  assert.equal(isAdminEmail(null, undefined), false);
  assert.equal(isAdminEmail('', ''), false);
});

test('한쪽만 비어 있어도 admin 아님', () => {
  assert.equal(isAdminEmail('me@example.com', undefined), false);
  assert.equal(isAdminEmail(undefined, 'me@example.com'), false);
});
