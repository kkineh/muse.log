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
  /** 미처리 항목의 body만 바꾼다. 대상 행이 없으면 value가 null */
  update(id: string, body: string): Promise<StoreResult<InboxItem | null>>;
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

// POST·PATCH가 같이 쓰는 쓰기 요청 검사. 순서: 401 → 403 → 415 → 413 → 400(JSON)
async function readWriteRequest(
  request: Request,
  deps: InboxDeps
): Promise<{ ok: true; json: unknown } | { ok: false; res: HandlerResult }> {
  if (!(await deps.isAdmin())) return { ok: false, res: fail(401, 'Unauthorized') };
  if (isCrossSite(request)) return { ok: false, res: fail(403, 'Forbidden') };

  const type = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!type.startsWith('application/json')) {
    return { ok: false, res: fail(415, 'Unsupported Media Type') };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, res: fail(400, 'Invalid body') };
  }
  if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) {
    return { ok: false, res: fail(413, 'Payload Too Large') };
  }

  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch {
    return { ok: false, res: fail(400, 'Invalid body') };
  }
}

/** trim 후 1~2000자 문자열이면 trim한 값, 아니면 null */
function parseBody(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  return body.length < 1 || body.length > MAX_BODY_CHARS ? null : body;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleInboxPost(
  request: Request,
  deps: InboxDeps
): Promise<HandlerResult> {
  const req = await readWriteRequest(request, deps);
  if (!req.ok) return req.res;

  const body = parseBody((req.json as { body?: unknown } | null)?.body);
  if (body === null) return fail(400, 'Invalid body');

  const r = await deps.store.insert(body);
  if (!r.ok) return storeFailure(r.code, deps, 'insert');
  return result(201, { item: r.value });
}

export async function handleInboxPatch(
  request: Request,
  deps: InboxDeps
): Promise<HandlerResult> {
  const req = await readWriteRequest(request, deps);
  if (!req.ok) return req.res;

  const json = req.json as { id?: unknown; body?: unknown } | null;
  const id = json?.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return fail(400, 'Invalid id');
  const body = parseBody(json?.body);
  if (body === null) return fail(400, 'Invalid body');

  const r = await deps.store.update(id, body);
  if (!r.ok) return storeFailure(r.code, deps, 'update');
  if (r.value === null) return fail(404, 'Not Found'); // 없거나 이미 처리됨
  return result(200, { item: r.value });
}
