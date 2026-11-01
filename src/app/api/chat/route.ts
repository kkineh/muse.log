import { NextResponse } from 'next/server';
import { CHAT_MODEL, isChatDisabled } from '@/lib/chat/config';
import { firstTurnCache, getIndex, getPost } from '@/lib/chat/data';
import { handleChat } from '@/lib/chat/handler';
import { createOpenAiLlm } from '@/lib/chat/openai';
import { createRateLimiter } from '@/lib/chat/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const limiter = createRateLimiter();

const log = (event: string, fields: Record<string, unknown>) =>
  console.warn(`[chat] ${event}`, JSON.stringify(fields));

// POST /api/chat - route to up to 3 public posts, read them in full, answer
export async function POST(request: Request) {
  const result = await handleChat(request, {
    isDisabled: isChatDisabled,
    getApiKey: () => process.env.OPENAI_API_KEY,
    limiter,
    createChatDeps: (apiKey, deadline) => ({
      getIndex,
      getPost,
      llm: createOpenAiLlm({ apiKey, model: CHAT_MODEL, log }),
      firstTurnCache,
      log,
      now: Date.now,
      deadline,
    }),
    log,
    now: Date.now,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
