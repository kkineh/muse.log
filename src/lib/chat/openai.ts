import { ChatError } from './errors.ts';

export interface LlmRequest {
  call: 'router' | 'answer';
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  json: boolean;
  timeoutMs: number;
}

export interface LlmResult {
  content: string;
  finishReason: string | null;
}

export type LlmFn = (request: LlmRequest) => Promise<LlmResult>;

export type LogFields = Record<string, string | number | boolean | null>;
export type ChatLogger = (event: string, fields: LogFields) => void;

interface OpenAiBody {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { code?: string | null };
}

/**
 * Chat Completions caller. Logs status, latency, token usage and error code
 * only; request text, response text and upstream messages are never logged.
 */
export function createOpenAiLlm(options: {
  apiKey: string;
  model: string;
  log: ChatLogger;
  fetchFn?: typeof fetch;
}): LlmFn {
  const fetchFn = options.fetchFn ?? fetch;

  return async (request) => {
    const started = Date.now();
    let response: Response;
    try {
      response = await fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          temperature: request.temperature,
          max_completion_tokens: request.maxTokens,
          ...(request.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(Math.max(1, request.timeoutMs)),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      options.log('llm_error', {
        call: request.call,
        errorCode: name,
        ms: Date.now() - started,
      });
      throw new ChatError(
        name === 'TimeoutError' || name === 'AbortError'
          ? 'timeout'
          : 'upstream'
      );
    }

    let body: OpenAiBody = {};
    try {
      body = (await response.json()) as OpenAiBody;
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      if (name === 'TimeoutError' || name === 'AbortError') {
        options.log('llm_error', {
          call: request.call,
          errorCode: name,
          ms: Date.now() - started,
        });
        throw new ChatError('timeout');
      }
      // Non-JSON body: treated as an upstream failure below.
    }

    const ms = Date.now() - started;
    if (!response.ok) {
      options.log('llm_error', {
        call: request.call,
        status: response.status,
        errorCode: body.error?.code ?? null,
        ms,
      });
      // Quota, billing and plain rate limits all surface as "unavailable".
      throw new ChatError(
        response.status === 429 || response.status === 402
          ? 'quota'
          : 'upstream'
      );
    }

    const choice = body.choices?.[0];
    const content = choice?.message?.content;
    options.log('llm_call', {
      call: request.call,
      status: response.status,
      ms,
      promptTokens: body.usage?.prompt_tokens ?? null,
      completionTokens: body.usage?.completion_tokens ?? null,
      cachedTokens: body.usage?.prompt_tokens_details?.cached_tokens ?? null,
      finishReason: choice?.finish_reason ?? null,
    });
    if (typeof content !== 'string') throw new ChatError('upstream');
    return { content, finishReason: choice?.finish_reason ?? null };
  };
}
