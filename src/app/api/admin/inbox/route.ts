// brain inbox (admin only) - see docs/design/brain-inbox.md
import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase-server';
import { handleInboxGet, handleInboxPost, type InboxDeps } from '@/lib/inbox/handler';
import { createInboxStore } from '@/lib/inbox/store';

export const dynamic = 'force-dynamic';

const log = (event: string, fields: Record<string, unknown>) =>
  console.warn(`[inbox] ${event}`, JSON.stringify(fields));

async function deps(): Promise<InboxDeps> {
  return { isAdmin, store: createInboxStore(await createClient()), log };
}

export async function GET() {
  const r = await handleInboxGet(await deps());
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}

export async function POST(request: Request) {
  const r = await handleInboxPost(request, await deps());
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}
