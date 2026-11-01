import type { ChatHistoryItem } from '../../types/database.ts';
import { isValidSlug } from '../slug.ts';
import {
  MAX_BODY_BYTES,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_ITEMS,
  MAX_MESSAGE_CHARS,
  MAX_READ_SLUGS,
  MAX_SLUG_CHARS,
  MESSAGES,
  truncateChars,
} from './config.ts';

export interface ParsedChatRequest {
  message: string;
  history: ChatHistoryItem[];
  readSlugs: string[];
}

export type ParseResult =
  | { ok: true; value: ParsedChatRequest }
  | { ok: false; status: 400 | 413 | 415; error: string };

const fail = (status: 400 | 413 | 415, error: string): ParseResult => ({
  ok: false,
  status,
  error,
});

type BodyResult = { text: string } | { status: 400 | 413 };

async function readBody(request: Request): Promise<BodyResult> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { status: 413 };
  }
  if (!request.body) return { status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel();
        return { status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    // client abort or broken stream
    return { status: 400 };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { status: 400 };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read and validate a chat request body: size caps first, then shape.
 * Arrays are cut before their items are inspected.
 */
export async function parseChatRequest(request: Request): Promise<ParseResult> {
  const mediaType = (request.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (mediaType !== 'application/json') {
    return fail(415, MESSAGES.unsupportedType);
  }

  const body = await readBody(request);
  if ('status' in body) {
    return fail(
      body.status,
      body.status === 413 ? MESSAGES.tooLarge : MESSAGES.badRequest
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return fail(400, MESSAGES.badRequest);
  }
  if (!isPlainObject(json)) return fail(400, MESSAGES.badRequest);

  if (typeof json.message !== 'string') return fail(400, MESSAGES.badRequest);
  const message = json.message.trim();
  if (message.length === 0 || Array.from(message).length > MAX_MESSAGE_CHARS) {
    return fail(400, MESSAGES.badRequest);
  }

  const rawHistory = json.history ?? [];
  const rawSlugs = json.readSlugs ?? [];
  if (!Array.isArray(rawHistory) || !Array.isArray(rawSlugs)) {
    return fail(400, MESSAGES.badRequest);
  }

  const history: ChatHistoryItem[] = [];
  for (const item of rawHistory.slice(-MAX_HISTORY_ITEMS)) {
    if (!isPlainObject(item)) return fail(400, MESSAGES.badRequest);
    const { role, content } = item;
    if (
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string'
    ) {
      return fail(400, MESSAGES.badRequest);
    }
    history.push({ role, content: truncateChars(content, MAX_HISTORY_CHARS) });
  }

  const readSlugs: string[] = [];
  for (const item of rawSlugs.slice(0, MAX_READ_SLUGS)) {
    if (typeof item !== 'string') return fail(400, MESSAGES.badRequest);
    const slug = item.normalize('NFC');
    if (Array.from(slug).length > MAX_SLUG_CHARS || !isValidSlug(slug)) {
      return fail(400, MESSAGES.badRequest);
    }
    readSlugs.push(slug);
  }

  return { ok: true, value: { message, history, readSlugs } };
}
