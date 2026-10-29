import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MIN_SECRET_BYTES = 32;
// brain 발행 스크립트가 쓴 뒤 무효화할 경로 (응답 paths도 이 배열)
const REVALIDATE_PATHS = ['/', '/api/posts', '/api/tags', '/api/tags/graph'];

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || Buffer.byteLength(secret) < MIN_SECRET_BYTES) return false;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  // 양쪽을 sha256으로 같은 길이로 만든 뒤 비교한다
  return timingSafeEqual(sha256(token), sha256(secret));
}

// POST /api/revalidate - brain 발행 후 ISR 페이지와 엣지 캐시 API를 무효화한다
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  for (const path of REVALIDATE_PATHS) {
    // '/'는 layout 단위로 무효화해 글·카테고리·태그 페이지를 모두 덮는다
    if (path === '/') revalidatePath(path, 'layout');
    else revalidatePath(path);
  }

  return NextResponse.json({ ok: true, paths: REVALIDATE_PATHS });
}
