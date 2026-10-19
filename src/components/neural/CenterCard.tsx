'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Github, User, Mail, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { CiLinkedin } from 'react-icons/ci';
import { GITHUB_URL, LINKEDIN_URL, MAIL_URL } from '@/lib/social-links';
import { ChatBubble } from './ChatBubble';
import { MuseLogo } from './MuseLogo';
import { useChat } from '@/hooks/useChat';

interface CenterCardProps {
  onSlugClick: (slug: string) => void;
  onHighlightPosts: (slugs: string[]) => void;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function CenterCard({ onSlugClick, onHighlightPosts, isCollapsed, onCollapse, onExpand }: CenterCardProps) {
  const { messages, isProcessing, send } = useChat({ onSources: onHighlightPosts });
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const text = inputValue;
    setInputValue('');
    if (isCollapsed) {
      onExpand();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    void send(text);
  };

  // 접힌 상태에서 input 클릭 시 펼치기
  const handleInputFocus = () => {
    if (isCollapsed) {
      onExpand();
    }
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (isCollapsed || !vv) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty('--vv-h', `${vv.height}px`);
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      root.style.removeProperty('--vv-h');
      root.style.removeProperty('--vv-top');
    };
  }, [isCollapsed]);

  return (
    <>
    {!isCollapsed && (
      <div
        className="fixed inset-0 z-40 max-md:touch-none max-md:bg-[var(--neural-bg)]"
        onClick={onCollapse}
      />
    )}
    <div
      className={`fixed z-50 md:transition-all md:duration-500 md:ease-in-out ${
        isCollapsed
          ? 'bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] md:w-[600px]'
          : 'top-[var(--vv-top,0px)] left-0 w-full h-[var(--vv-h,100dvh)] md:h-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[60%]'
      }`}
      style={{
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      {/* Card content */}
      <div className={`relative flex flex-col neural-center-card max-md:transition-none! ${
        isCollapsed ? 'h-[80px] neural-card-collapsed' : 'max-md:h-full max-md:rounded-none! max-md:border-0! md:h-[min(640px,calc(100dvh-4rem))]'
      }`}>
          {/* Collapse/Expand button - only show when expanded */}
          {!isCollapsed && (
            <button
              onClick={onCollapse}
              className="absolute top-[19px] right-3.5 md:top-4 md:right-4 z-20 p-1.5 md:p-2 rounded-lg hover:bg-[rgb(255_255_255/0.1)] transition-colors"
              aria-label="Minimize chat"
            >
              <Minimize2 size={20} className="max-md:size-4" style={{ color: 'var(--neural-text-primary)' }} />
            </button>
          )}

        {/* Header - hide when collapsed */}
        {!isCollapsed && (
          <div className="p-5 pb-2 md:p-8 md:pb-4">
            <MuseLogo className="max-md:text-[20px]! md:text-3xl mb-0 md:mb-2" />
            <p
              className="text-sm mb-4 max-md:hidden"
              style={{
                color: 'var(--neural-text-muted)',
              }}
            >
              사유, 기록, 연결
            </p>

            {/* Links */}
            <div className="flex flex-wrap items-center gap-5 max-md:hidden">
              <Link
                href="/about"
                aria-label="About"
                title="About"
                className="flex items-center text-sm hover:text-[var(--neural-accent)] transition-colors"
                style={{ color: 'var(--neural-text-muted)' }}
              >
                <User size={16} />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="flex items-center text-sm hover:text-[var(--neural-accent)] transition-colors"
                style={{ color: 'var(--neural-text-muted)' }}
              >
                <Github size={16} />
              </a>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
                className="flex items-center text-sm hover:text-[var(--neural-accent)] transition-colors"
                style={{ color: 'var(--neural-text-muted)' }}
              >
                <CiLinkedin size={18} />
              </a>
              <a
                href={MAIL_URL}
                aria-label="Email"
                title="Email"
                className="flex items-center text-sm hover:text-[var(--neural-accent)] transition-colors"
                style={{ color: 'var(--neural-text-muted)' }}
              >
                <Mail size={16} />
              </a>
            </div>
          </div>
        )}

        {/* Chat History - hide when collapsed */}
        <div
          ref={scrollRef}
          className={`flex-1 px-5 md:px-8 overflow-y-auto overscroll-contain ${isCollapsed ? 'hidden' : ''}`}
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
        <div className={isCollapsed ? 'p-4' : 'p-5 pt-0 md:p-8 md:pt-0'}>
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="무엇이든 물어보세요..."
              disabled={isProcessing}
              className="w-full px-4 py-2 md:py-3 pr-12 rounded-lg text-base md:text-[14px] bg-[rgba(255,255,255,0.05)] border border-[var(--neural-line)] focus:outline-none transition-colors"
              style={{
                color: 'var(--neural-text-primary)',
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
