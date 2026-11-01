import type { ChatResponse } from '../../types/database.ts';
import {
  ANSWER_MAX_TOKENS,
  CACHE_REVALIDATE_SECONDS,
  MESSAGES,
  MIN_REMAINING_MS,
  ROUTER_MAX_TOKENS,
  normalizeQuestion,
} from './config.ts';
import { ChatError } from './errors.ts';
import type { ChatIndex } from './index-text.ts';
import type { ChatLogger, LlmFn } from './openai.ts';
import {
  buildAnswerPrompt,
  buildRouterPrompt,
  type PromptPost,
} from './prompts.ts';
import type { ParsedChatRequest } from './request.ts';
import { parseRouterOutput, pickFallback } from './router.ts';

export interface CachedFirstTurn extends ChatResponse {
  cachedAt: number;
}

export interface ChatDeps {
  getIndex: () => Promise<ChatIndex>;
  getPost: (slug: string) => Promise<PromptPost>;
  llm: LlmFn;
  /** Stores a successful compute under `key`; a throw must store nothing. */
  firstTurnCache: (
    key: string,
    compute: () => Promise<CachedFirstTurn>
  ) => Promise<CachedFirstTurn>;
  log: ChatLogger;
  now: () => number;
  deadline: number;
}

export interface ChatOutcome {
  response: ChatResponse;
  firstTurn: boolean;
  cacheHit: boolean | null;
}

interface PipelineResult {
  response: ChatResponse;
  cacheable: boolean;
}

/** Thrown inside the cache function so an uncacheable result is not stored. */
export class NotCacheable extends Error {
  result: ChatResponse;

  constructor(result: ChatResponse) {
    super('not cacheable');
    this.name = 'NotCacheable';
    this.result = result;
  }
}

const CACHE_TTL_MS = CACHE_REVALIDATE_SECONDS * 1000;

function ensureTime(deps: ChatDeps) {
  if (deps.deadline - deps.now() < MIN_REMAINING_MS) {
    throw new ChatError('timeout');
  }
}

/** Race a data call against the shared request deadline. */
async function withDeadline<T>(deps: ChatDeps, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ChatError('timeout')),
      Math.max(0, deps.deadline - deps.now())
    );
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}

async function loadIndex(deps: ChatDeps): Promise<ChatIndex> {
  ensureTime(deps);
  try {
    return await withDeadline(deps, deps.getIndex());
  } catch (error) {
    throw error instanceof ChatError ? error : new ChatError('data');
  }
}

async function runPipeline(
  deps: ChatDeps,
  req: ParsedChatRequest,
  index: ChatIndex,
  firstTurn: boolean
): Promise<PipelineResult> {
  ensureTime(deps);
  const indexSlugs = new Set(index.slugs);
  const readSlugs = req.readSlugs.filter((s) => indexSlugs.has(s));

  const routerPrompt = buildRouterPrompt({
    indexText: index.text,
    readSlugs,
    history: req.history,
    question: req.message,
  });
  const routerOut = await deps.llm({
    call: 'router',
    ...routerPrompt,
    temperature: 0,
    maxTokens: ROUTER_MAX_TOKENS,
    json: true,
    timeoutMs: deps.deadline - deps.now(),
  });

  const routed = parseRouterOutput(routerOut.content, indexSlugs);
  let slugs = routed.slugs;
  let usedFallback = false;
  if (slugs.length === 0) {
    const fallback = pickFallback({
      readSlugs,
      historyLength: req.history.length,
      question: req.message,
    });
    if (fallback) {
      slugs = [fallback];
      usedFallback = true;
    }
  }

  const settled = await Promise.all(
    slugs.map((slug) =>
      withDeadline(deps, deps.getPost(slug)).catch((error) => {
        if (error instanceof ChatError) throw error;
        return null;
      })
    )
  );
  const posts = settled.filter((p): p is PromptPost => p !== null);
  deps.log('chat_route', {
    firstTurn,
    picked: slugs.length,
    read: posts.length,
    fallback: usedFallback,
    routerParseFailed: routed.parseFailed,
  });

  if (posts.length === 0) {
    return {
      response: { answer: MESSAGES.noPosts, sources: [] },
      cacheable: false,
    };
  }

  ensureTime(deps);
  const answerPrompt = buildAnswerPrompt({
    posts,
    history: req.history,
    question: req.message,
  });
  const answerOut = await deps.llm({
    call: 'answer',
    ...answerPrompt,
    temperature: 0.7,
    maxTokens: ANSWER_MAX_TOKENS,
    json: false,
    timeoutMs: deps.deadline - deps.now(),
  });

  return {
    response: {
      answer: answerOut.content,
      sources: posts.map((p) => ({ title: p.title, slug: p.slug })),
    },
    cacheable:
      !routed.parseFailed &&
      posts.length === slugs.length &&
      answerOut.finishReason === 'stop',
  };
}

/**
 * Route to up to 3 public posts, read them in full and answer. First turns
 * (no history, no readSlugs) go through the answer cache.
 */
export async function answerChat(
  deps: ChatDeps,
  req: ParsedChatRequest
): Promise<ChatOutcome> {
  const startedAt = deps.now();
  const firstTurn = req.history.length === 0 && req.readSlugs.length === 0;

  // The index is read here, outside the first-turn cache: unstable_cache
  // bypasses inner caches when nested, so reading it inside would always hit
  // Supabase. Post bodies depend on the router and are read inside the cache
  // function (uncached, but only on a first-turn miss whose result is cached).
  const index = await loadIndex(deps);

  if (!firstTurn) {
    const { response } = await runPipeline(deps, req, index, false);
    return { response, firstTurn, cacheHit: null };
  }

  let cached: CachedFirstTurn;
  try {
    // The TTL bucket in the key retires old entries, so Next never serves a
    // stale one and recomputes in the background.
    cached = await deps.firstTurnCache(
      `${Math.floor(startedAt / CACHE_TTL_MS)}:${normalizeQuestion(req.message)}`,
      async () => {
        const result = await runPipeline(deps, req, index, true);
        if (!result.cacheable) throw new NotCacheable(result.response);
        return { ...result.response, cachedAt: deps.now() };
      }
    );
  } catch (error) {
    if (error instanceof NotCacheable) {
      deps.log('chat_cache', { result: 'skip' });
      return { response: error.result, firstTurn, cacheHit: false };
    }
    throw error;
  }

  if (startedAt - cached.cachedAt >= CACHE_TTL_MS) {
    deps.log('chat_cache', { result: 'stale' });
    const { response } = await runPipeline(deps, req, index, true);
    return { response, firstTurn, cacheHit: false };
  }

  const hit = cached.cachedAt < startedAt;
  deps.log('chat_cache', { result: hit ? 'hit' : 'miss' });
  return {
    response: { answer: cached.answer, sources: cached.sources },
    firstTurn,
    cacheHit: hit,
  };
}
