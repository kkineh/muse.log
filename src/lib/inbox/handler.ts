// /api/admin/inbox 요청 흐름. 의존성을 주입받는 순수 함수라 route 없이 시험한다.
// 본문은 응답 외에는 어디에도 남기지 않는다 (로그에는 에러 코드만).

export const MAX_BODY_CHARS = 2000;
export const MAX_REQUEST_BYTES = 16 * 1024;
export const LIST_LIMIT = 50;

export interface InboxItem {
  id: string;
  body: string;
  created_at: string;
}

export type StoreResult<T> = { ok: true; value: T } | { ok: false; code: string };

export interface InboxStore {
  listUnprocessed(limit: number): Promise<StoreResult<InboxItem[]>>;
  insert(body: string): Promise<StoreResult<InboxItem>>;
}

export interface InboxDeps {
  isAdmin: () => Promise<boolean>;
  store: InboxStore;
  log: (event: string, fields: Record<string, unknown>) => void;
}

export interface HandlerResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

const result = (status: number, body: unknown): HandlerResult => ({
  status,
  body,
  headers: { ...NO_STORE },
});
const fail = (status: number, error: string) => result(status, { error });

function storeFailure(code: string, deps: InboxDeps, op: string): HandlerResult {
  deps.log('store_error', { op, code });
  if (code === '42501') return fail(403, 'Forbidden');
  if (code === '23514') return fail(400, 'Invalid body');
  return fail(500, 'Internal error');
}

// 다른 사이트에서 보낸 요청은 막는다 (Origin이 있으면 같은 host여야 함)
function isCrossSite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

export async function handleInboxGet(deps: InboxDeps): Promise<HandlerResult> {
  if (!(await deps.isAdmin())) return fail(401, 'Unauthorized');
  const r = await deps.store.listUnprocessed(LIST_LIMIT);
  if (!r.ok) return storeFailure(r.code, deps, 'list');
  return result(200, { items: r.value });
}

export async function handleInboxPost(
  request: Request,
  deps: InboxDeps
): Promise<HandlerResult> {
  if (!(await deps.isAdmin())) return fail(401, 'Unauthorized');
  if (isCrossSite(request)) return fail(403, 'Forbidden');

  const type = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!type.startsWith('application/json')) return fail(415, 'Unsupported Media Type');

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, 'Invalid body');
  }
  if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) return fail(413, 'Payload Too Large');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail(400, 'Invalid body');
  }
  const value = (parsed as { body?: unknown } | null)?.body;
  if (typeof value !== 'string') return fail(400, 'Invalid body');
  const body = value.trim();
  if (body.length < 1 || body.length > MAX_BODY_CHARS) return fail(400, 'Invalid body');

  const r = await deps.store.insert(body);
  if (!r.ok) return storeFailure(r.code, deps, 'insert');
  return result(201, { item: r.value });
}
