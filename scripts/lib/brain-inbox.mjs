// inbox 테이블만 다룬다 (로드맵 ⑤, docs/design/brain-inbox.md). 클라이언트는 주입받는다.
// 에러는 코드만 내보낸다. Supabase 에러 메시지·details에는 본문이 들어갈 수 있다.

export const LIST_LIMIT = 50;
export const DONE_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 제어 문자(줄바꿈·탭 제외), ANSI 이스케이프, bidi·폭 없는 문자, 줄·문단 구분자를 지운다
const UNSAFE = /\u001b\[[0-9;?]*[ -/]*[@-~]|[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g;

export function sanitizeBody(body) {
  return String(body).replace(UNSAFE, '');
}

export class InboxError extends Error {
  constructor(op, code) {
    super(`inbox ${op} 실패 (code ${code || 'unknown'})`);
    this.code = code;
  }
}

function check(op, { data, error, count, status }) {
  if (error) throw new InboxError(op, error.code);
  if (status >= 400) throw new InboxError(op, `http ${status}`);
  return { data, count };
}

// HEAD 요청은 본문이 없어 404여도 error가 비어 올 수 있다. 건수가 없으면 실패로 본다
export async function countUnprocessed(client) {
  const { count } = check(
    'count',
    await client.from('inbox').select('id', { count: 'exact', head: true }).is('processed_at', null)
  );
  if (typeof count !== 'number') throw new InboxError('count', 'no count');
  return count;
}

/** 오래된 순. 본문은 정리해서 돌려준다 */
export async function listUnprocessed(client) {
  const { data } = check(
    'list',
    await client
      .from('inbox')
      .select('id, created_at, body')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(LIST_LIMIT)
  );
  return (data ?? []).map((r) => ({ id: r.id, created_at: r.created_at, body: sanitizeBody(r.body) }));
}

/** 형식이 틀린 id가 하나라도 있으면 아무것도 바꾸지 않는다 */
export function validateIds(ids) {
  if (ids.length === 0) return '처리할 id를 하나 이상 주세요.';
  if (ids.length > DONE_LIMIT) return `한 번에 ${DONE_LIMIT}개까지 처리할 수 있습니다.`;
  const bad = ids.filter((id) => !UUID.test(id));
  if (bad.length) return `uuid 형식이 아닌 id: ${bad.length}개`;
  return null;
}

export async function markDone(client, ids, now = new Date()) {
  const { data } = check(
    'done',
    await client
      .from('inbox')
      .update({ processed_at: now.toISOString() })
      .in('id', [...new Set(ids)])
      .is('processed_at', null)
      .select('id')
  );
  return (data ?? []).length;
}
