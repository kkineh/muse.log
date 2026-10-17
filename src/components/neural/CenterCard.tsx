'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Github, User, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { ChatBubble } from './ChatBubble';
import type { ChatResponse } from '@/types/database';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  relatedSlugs?: string[];
  isNew?: boolean;
}

interface CenterCardProps {
  onSlugClick: (slug: string) => void;
  onHighlightPosts: (slugs: string[]) => void;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function CenterCard({ onSlugClick, onHighlightPosts, isCollapsed, onCollapse, onExpand }: CenterCardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: ChatResponse = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        relatedSlugs: data.sources.map((s) => s.slug),
        isNew: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Highlight related posts in the network
      if (data.sources.length > 0) {
        onHighlightPosts(data.sources.map((s) => s.slug));
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content:
          '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        isNew: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 접힌 상태에서 input 클릭 시 펼치기
  const handleInputFocus = () => {
    if (isCollapsed) {
      onExpand();
    }
  };

  return (
    <>
    {!isCollapsed && (
      <div
        className="fixed inset-0 z-40"
        onClick={onCollapse}
      />
    )}
    <div
      className={`fixed z-50 transition-all duration-500 ease-in-out ${
        isCollapsed
          ? 'bottom-8 left-1/2 -translate-x-1/2 w-[600px]'
          : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%]'
      }`}
      style={{
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      {/* Card content */}
      <div className={`relative flex flex-col neural-center-card ${
        isCollapsed ? 'h-[80px] neural-card-collapsed' : 'h-[640px]'
      }`}>
          {/* Collapse/Expand button - only show when expanded */}
          {!isCollapsed && (
            <button
              onClick={onCollapse}
              className="absolute top-4 right-4 z-20 p-2 rounded-lg hover:bg-[rgb(255_255_255/0.1)] transition-colors"
              aria-label="Minimize chat"
            >
              <Minimize2 size={20} style={{ color: 'var(--neural-text-primary)' }} />
            </button>
          )}

        {/* Header - hide when collapsed */}
        {!isCollapsed && (
          <div className="p-8 pb-4">
            <h1
              className="text-3xl mb-2"
              style={{
                fontFamily: 'var(--font-space-grotesk), sans-serif',
                color: 'var(--neural-text-primary)',
                fontWeight: 600,
              }}
            >
              muse.log
            </h1>
            <p
              className="text-sm mb-4"
              style={{
                color: 'var(--neural-text-muted)',
              }}
            >
              사유, 기록, 연결
            </p>

            {/* Links */}
            <div className="flex gap-4">
              <Link
                href="/about"
                className="flex items-center gap-1.5 text-sm hover:text-[var(--neural-accent)] transition-colors"
                style={{ color: 'var(--neural-text-muted)' }}
              >
                <User size={16} />
                <span>About</span>
              </Link>
              <a
                href="https://github.com/kkineh"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm hover:text-[var(--neural-accent)] transition-colors"
                style={{ color: 'var(--neural-text-muted)' }}
              >
                <Github size={16} />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        )}

        {/* Chat History - hide when collapsed */}
        <div
          ref={scrollRef}
          className={`flex-1 px-8 overflow-y-auto ${isCollapsed ? 'hidden' : ''}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--neural-border-glow) transparent',
          }}
        >
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p
                  className="text-center"
                  style={{
                    color: 'var(--neural-text-muted)',
                  }}
                >
                  어떤 이야기가 궁금하신가요?
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatBubble
                  key={index}
                  role={message.role}
                  content={message.content}
                  isNew={message.isNew === true}
                  relatedSlugs={message.relatedSlugs}
                  onSlugClick={onSlugClick}
                />
              ))
            )}
            {isProcessing && (
              <div className="flex justify-start mb-4">
                <div className="px-4 py-3 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--neural-accent)] animate-pulse" />
                    <div
                      className="w-2 h-2 rounded-full bg-[var(--neural-accent)] animate-pulse"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-[var(--neural-accent)] animate-pulse"
                      style={{ animationDelay: '0.4s' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* Input */}
        <div className={isCollapsed ? 'p-4' : 'p-8 pt-0'}>
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="무엇이든 물어보세요..."
              disabled={isProcessing}
              className="w-full px-4 py-3 pr-12 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[var(--neural-line)] focus:outline-none transition-colors"
              style={{
                color: 'var(--neural-text-primary)',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              disabled={isProcessing || !inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-[rgb(255_255_255/0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} style={{ color: 'var(--neural-text-primary)' }} />
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
