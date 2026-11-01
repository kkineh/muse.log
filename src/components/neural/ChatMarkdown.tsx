'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// raw HTML은 react-markdown 기본값대로 렌더하지 않고, URL은 defaultUrlTransform이 javascript: 등을 막는다.
// 첫 턴 답변은 사용자 간에 캐시로 공유되므로 외부 이미지 로드는 막는다.
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-1">{children}</ol>,
  h1: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--neural-accent)] underline">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 last:mb-0 overflow-x-auto rounded-lg bg-[rgba(0,0,0,0.35)] p-3 text-xs">{children}</pre>
  ),
  code: ({ className, children }) => (
    <code
      className={className ?? 'rounded bg-[rgba(255,255,255,0.08)] px-1 py-0.5 text-[0.85em]'}
      style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
    >
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-[rgba(255,255,255,0.15)] px-2 py-1 text-left">{children}</th>,
  td: ({ children }) => <td className="border border-[rgba(255,255,255,0.15)] px-2 py-1">{children}</td>,
};

export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} disallowedElements={['img']} unwrapDisallowed>
      {text}
    </ReactMarkdown>
  );
}
