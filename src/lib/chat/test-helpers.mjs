// Shared fakes for the chat tests (not a test file itself).
import { answerChat } from './chat.ts';

export const INDEX = {
  text: 'a | - | A | | 2026-01\nb | - | B | | 2026-01\nc | - | C | | 2026-01',
  slugs: ['a', 'b', 'c', 'd', 'e'],
};

export function memoryCache() {
  const store = new Map();
  const stats = { stored: 0 };
  const fn = async (key, compute) => {
    if (store.has(key)) return store.get(key);
    const value = await compute();
    store.set(key, value);
    stats.stored++;
    return value;
  };
  return { fn, store, stats };
}

/**
 * routerOut: string | (userPrompt) => string. answerOut: { content, finishReason }.
 */
export function makeDeps(opts = {}) {
  const calls = [];
  const postCalls = [];
  const logs = [];
  const cache = opts.cache ?? memoryCache();
  let clock = opts.start ?? 1000;
  const deps = {
    getIndex: opts.getIndex ?? (async () => INDEX),
    getPost: async (slug) => {
      postCalls.push(slug);
      if (opts.failPosts?.includes(slug)) throw new Error('boom');
      return { slug, title: `T-${slug}`, content: `body of ${slug}` };
    },
    llm: async (req) => {
      calls.push(req);
      if (opts.llmError) throw opts.llmError;
      if (req.call === 'router') {
        const out =
          typeof opts.routerOut === 'function'
            ? opts.routerOut(req)
            : (opts.routerOut ?? '{"slugs":[]}');
        clock += opts.routerMs ?? 0;
        return { content: out, finishReason: 'stop' };
      }
      return opts.answerOut ?? { content: 'answer', finishReason: 'stop' };
    },
    firstTurnCache: cache.fn,
    log: (event, fields) => logs.push({ event, fields }),
    now: () => clock,
    deadline: (opts.start ?? 1000) + (opts.deadlineMs ?? 25_000),
  };
  return { deps, calls, postCalls, logs, cache, tick: (ms) => (clock += ms) };
}

export const req = (over = {}) => ({
  message: '질문',
  history: [],
  readSlugs: [],
  ...over,
});

export const run = (h, r) => answerChat(h.deps, r);
