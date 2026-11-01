export const CHAT_MODEL = process.env.CHAT_MODEL ?? 'gpt-4o-mini';
export const PROMPT_VERSION = 'v1';
export const BLOG_CHAT_TAG = 'blog-chat';

export const MAX_BODY_BYTES = 32768;
export const MAX_MESSAGE_CHARS = 500;
export const MAX_HISTORY_ITEMS = 6;
export const MAX_HISTORY_CHARS = 1000;
export const MAX_READ_SLUGS = 6;
export const MAX_SLUG_CHARS = 100;

export const MAX_ROUTED_POSTS = 3;
export const MAX_POST_CHARS = 6000;
export const ROUTER_HISTORY_ITEMS = 4;
export const ROUTER_HISTORY_CHARS = 300;
export const FALLBACK_MAX_QUESTION_CHARS = 40;

export const ROUTER_MAX_TOKENS = 100;
export const ANSWER_MAX_TOKENS = 300;
export const DEADLINE_MS = 25_000;
export const MIN_REMAINING_MS = 1_000;
export const CACHE_REVALIDATE_SECONDS = 86_400;

export const RATE_LIMIT_PER_MINUTE = 8;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_KEYS = 5000;

export const MESSAGES = {
  disabled: '채팅이 잠시 중단되었습니다.',
  unavailable: '지금은 답변을 만들 수 없어요. 잠시 후 다시 시도해주세요.',
  noPosts: '이 블로그에서 관련된 글을 찾지 못했어요. 다른 질문을 해주시겠어요?',
  badRequest: '요청 형식이 올바르지 않습니다.',
  tooLarge: '요청이 너무 큽니다.',
  unsupportedType: 'Content-Type은 application/json이어야 합니다.',
  rateLimited: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  internal: '답변을 생성하는 중 오류가 발생했습니다.',
} as const;

/** True when the CHAT_DISABLED kill switch is on. Evaluated per request. */
export function isChatDisabled(): boolean {
  return process.env.CHAT_DISABLED === '1';
}

/** Cut to at most `max` code points without splitting a surrogate pair. */
export function truncateChars(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join('') : value;
}

/** Cache key for first-turn answers: NFC, trimmed, single-spaced, lowercase. */
export function normalizeQuestion(question: string): string {
  return question.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}
