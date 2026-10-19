'use client';

import { useState, useCallback } from 'react';
import type { ChatResponse } from '@/types/database';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  relatedSlugs?: string[];
  isNew?: boolean;
}

interface UseChatOptions {
  onSources?: (slugs: string[]) => void;
}

export function useChat({ onSources }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isProcessing) return;

      setMessages((prev) => [...prev, { role: 'user', content }]);
      setIsProcessing(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content }),
        });
        if (!response.ok) throw new Error('Failed to get response');

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
        if (data.sources.length > 0) onSources?.(data.sources.map((s) => s.slug));
      } catch (error) {
        console.error('Chat error:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            isNew: true,
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onSources]
  );

  return { messages, isProcessing, send };
}
