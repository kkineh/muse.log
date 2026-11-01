import { answerChat, type ChatDeps } from './chat.ts';
import { DEADLINE_MS, MESSAGES } from './config.ts';
import { ChatError } from './errors.ts';
import { getClientKey, type RateLimiter } from './rate-limit.ts';
import { parseChatRequest } from './request.ts';

export interface HandlerDeps {
  isDisabled: () => boolean;
  getApiKey: () => string | undefined;
  limiter: RateLimiter;
  createChatDeps: (apiKey: string, deadline: number) => ChatDeps;
  log: (event: string, fields: Record<string, unknown>) => void;
  now: () => number;
}

export interface HandlerResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(
  status: number,
  error: string,
  headers: Record<string, string> = {}
): HandlerResult {
  return { status, body: { error }, headers: { ...NO_STORE, ...headers } };
}

/**
 * Whole /api/chat request flow as a pure function of its dependencies:
 * kill switch, key, validation, rate limit, then the chat pipeline.
 * Every result carries Cache-Control: no-store.
 */
export async function handleChat(
  request: Request,
  deps: HandlerDeps
): Promise<HandlerResult> {
  const started = deps.now();

  if (deps.isDisabled()) return fail(503, MESSAGES.disabled);
  const apiKey = deps.getApiKey();
  if (!apiKey) return fail(503, MESSAGES.unavailable);

  const parsed = await parseChatRequest(request);
  if (!parsed.ok) return fail(parsed.status, parsed.error);

  const limit = deps.limiter.check(getClientKey(request.headers));
  if (!limit.allowed) {
    return fail(429, MESSAGES.rateLimited, {
      'Retry-After': String(limit.retryAfterSeconds),
    });
  }

  try {
    const outcome = await answerChat(
      deps.createChatDeps(apiKey, started + DEADLINE_MS),
      parsed.value
    );
    return { status: 200, body: outcome.response, headers: { ...NO_STORE } };
  } catch (error) {
    const kind = error instanceof ChatError ? error.kind : 'unknown';
    deps.log('chat_error', { kind });
    return kind === 'quota'
      ? fail(503, MESSAGES.unavailable)
      : fail(500, MESSAGES.internal);
  }
}
