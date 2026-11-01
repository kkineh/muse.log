'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatResponse } from '@/types/database';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  relatedSlugs?: string[];
  isNew?: boolean;
  isError?: boolean;
}

const HISTORY_LIMIT = 6;
const ERROR_TEXT =
  '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

class ChatRequestError extends Error {
  userMessage: string | null;

  constructor(userMessage: string | null) {
    super('Failed to get response');
    this.userMessage = userMessage;
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isProcessing) return;

      const prior = messagesRef.current
        .filter((m) => !m.isError)
        .slice(-HISTORY_LIMIT);
      const history = prior.map(({ role, content }) => ({ role, content }));
      const readSlugs = [
        ...new Set([...prior].reverse().flatMap((m) => m.relatedSlugs ?? [])),
      ].slice(0, 6);

      setMessages((prev) => [...prev, { role: 'user', content }]);
      setIsProcessing(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, history, readSlugs }),
        });
        if (!response.ok) {
          // 429 and 503 carry a fixed, user-facing message from the server
          const fixed =
            response.status === 429 || response.status === 503
              ? await response
                  .json()
                  .then((b: { error?: unknown }) =>
                    typeof b.error === 'string' ? b.error : null
                  )
                  .catch(() => null)
              : null;
          throw new ChatRequestError(fixed);
        }

        const data: ChatResponse = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            relatedSlugs: data.sources.map((s) => s.slug),
            isNew: true,
          },
        ]);
      } catch (error) {
        console.error('Chat error:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              error instanceof ChatRequestError && error.userMessage
                ? error.userMessage
                : ERROR_TEXT,
            isNew: true,
            isError: true,
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing]
  );

  return { messages, isProcessing, send };
}
