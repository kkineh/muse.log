import { FALLBACK_MAX_QUESTION_CHARS, MAX_ROUTED_POSTS } from './config.ts';

export interface RouterResult {
  slugs: string[];
  parseFailed: boolean;
}

/**
 * Parse the router's JSON output into at most 3 distinct slugs present in the
 * index. A shape failure is flagged so the result is not cached.
 */
export function parseRouterOutput(
  raw: string,
  indexSlugs: ReadonlySet<string>
): RouterResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { slugs: [], parseFailed: true };
  }
  const list =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { slugs?: unknown }).slugs
      : undefined;
  if (!Array.isArray(list)) return { slugs: [], parseFailed: true };

  const strings = list.filter((s): s is string => typeof s === 'string');
  if (list.length > 0 && strings.length === 0) {
    return { slugs: [], parseFailed: true };
  }
  const slugs = [...new Set(strings.map((s) => s.normalize('NFC')))]
    .filter((s) => indexSlugs.has(s))
    .slice(0, MAX_ROUTED_POSTS);
  return { slugs, parseFailed: false };
}

/**
 * When the router picks nothing on a short follow-up, reuse the most recently
 * read post. Never applies on a first turn.
 */
export function pickFallback(input: {
  readSlugs: readonly string[];
  historyLength: number;
  question: string;
}): string | null {
  if (input.historyLength === 0 || input.readSlugs.length === 0) return null;
  if (Array.from(input.question).length > FALLBACK_MAX_QUESTION_CHARS) {
    return null;
  }
  return input.readSlugs[0];
}
