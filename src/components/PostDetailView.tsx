'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Copy, Check } from 'lucide-react';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import dynamic from 'next/dynamic';
import TableOfContents from '@/components/TableOfContents';
import AdminToolbar from '@/components/AdminToolbar';
import PageBackground from '@/components/PageBackground';
import PageHeader from '@/components/PageHeader';
import PostListSection, { type PostListItem } from '@/components/PostListSection';
import { isSeriesTag } from '@/lib/series';
import NeuralFooter from '@/components/NeuralFooter';
import { NeuralMiniMap } from '@/components/neural/NeuralMiniMap';
import type { NeuralGraphData } from '@/lib/neural-graph-builder';
import { tagColor, tagMix } from '@/lib/tag-color';

const MermaidDiagram = dynamic(() => import('@/components/MermaidDiagram'), { ssr: false });

interface PostTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface PostData {
  title: string;
  slug: string;
  content: string;
  created_at: string;
  tags?: PostTag[];
}

interface PostDetailViewProps {
  post: PostData;
  categoryBreadcrumb?: { id: string; name: string; slug: string }[];
  recentPosts: PostListItem[];
  series?: { name: string; posts: PostListItem[] } | null;
  isDraft?: boolean;
  isAdmin?: boolean;
  graph?: NeuralGraphData;
  tagPostLinks?: { source: string; target: string; sharedCount: number }[];
  postLinks?: { source: string; target: string }[];
}

export default function PostDetailView({
  post,
  categoryBreadcrumb = [],
  recentPosts,
  series = null,
  isDraft = false,
  isAdmin = false,
  graph,
  tagPostLinks,
  postLinks,
}: PostDetailViewProps) {
  const router = useRouter();
  const visibleTags = (post.tags ?? []).filter((tag) => !isSeriesTag(tag.name));
  const [scrollProgress, setScrollProgress] = useState(0);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const viewCountTracked = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Increment view count (once per session per slug)
  useEffect(() => {
    if (viewCountTracked.current) return;
    viewCountTracked.current = true;

    const key = `viewed:${post.slug}`;
    if (sessionStorage.getItem(key)) {
      fetch(`/api/views?slug=${encodeURIComponent(post.slug)}`)
        .then((res) => res.json())
        .then((data) => setViewCount(data.view_count))
        .catch(() => {});
      return;
    }

    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: post.slug }),
    })
      .then((res) => res.json())
      .then((data) => {
        setViewCount(data.view_count);
        sessionStorage.setItem(key, '1');
      })
      .catch(() => {});
  }, [post.slug]);

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      if (scrollHeight <= clientHeight) {
        setScrollProgress(0);
        return;
      }
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setScrollProgress(Math.min(progress, 100));
    };

    const ref = contentRef.current;
    ref?.addEventListener('scroll', handleScroll);
    return () => ref?.removeEventListener('scroll', handleScroll);
  }, []);

  const extractText = (node: ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      return extractText((node as React.ReactElement<{ children?: ReactNode }>).props.children);
    }
    return '';
  };

  const generateHeadingId = (children: ReactNode): string => {
    return extractText(children)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\w\s-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const CodeBlock = useCallback(({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => {
    const [copied, setCopied] = useState(false);

    // mermaid 블록 감지: <pre><code class="language-mermaid">...</code></pre>
    const child = Array.isArray(children) ? children[0] : children;
    if (
      child &&
      typeof child === 'object' &&
      'props' in child &&
      (child as React.ReactElement<{ className?: string; children?: ReactNode }>).props.className?.includes('language-mermaid')
    ) {
      const chart = extractText((child as React.ReactElement<{ children?: ReactNode }>).props.children);
      return <MermaidDiagram chart={chart} />;
    }

    const handleCopy = () => {
      const code = extractText(children as ReactNode);
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md transition-colors"
          style={{
            position: 'absolute',
            top: '0.8rem',
            right: '0.8rem',
            zIndex: 1,
            background: 'rgba(255, 255, 255, 0.1)',
            color: copied ? 'var(--neural-text-primary)' : 'var(--neural-text-muted)',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <pre {...props}>
          {children}
        </pre>
      </div>
    );
  }, []);

  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 id={generateHeadingId(children)}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 id={generateHeadingId(children)}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 id={generateHeadingId(children)}>{children}</h3>
    ),
    pre: CodeBlock,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 neural-post-detail"
      style={{ background: 'var(--neural-bg)' }}
    >
      <PageBackground scrollProgress={scrollProgress} />

      <PageHeader scrollProgress={scrollProgress} />
      {isAdmin && <AdminToolbar slug={post.slug} />}

      {/* Main content */}
      <motion.div
        ref={contentRef}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-0 overflow-y-auto pt-20 md:pt-32"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--neural-border-glow) transparent',
        }}
      >
        <div className="max-w-3xl mx-auto px-8">
          {/* Category + draft badge */}
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4 flex items-center gap-3"
          >
            {categoryBreadcrumb.length > 0 && (
              <div
                className="flex items-center gap-1.5"
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                  fontSize: '14px',
                }}
              >
                {categoryBreadcrumb.map((cat, index) => (
                  <span key={cat.id} className="flex items-center gap-1.5">
                    {index > 0 && (
                      <span style={{ color: 'var(--neural-text-muted)', opacity: 0.5 }}>/</span>
                    )}
                    <button
                      onClick={() => router.push(`/category/${cat.slug}`)}
                      className="transition-colors hover:opacity-80"
                      style={{
                        color: index === categoryBreadcrumb.length - 1
                          ? 'var(--neural-accent)'
                          : 'var(--neural-text-muted)',
                      }}
                    >
                      {cat.name}
                    </button>
                  </span>
                ))}
              </div>
            )}
            {isDraft && (
              <span
                className="inline-block px-4 py-2 rounded-full border"
                style={{
                  borderColor: '#F59E0B',
                  color: '#F59E0B',
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
                }}
              >
                임시 저장
              </span>
            )}
          </motion.div>

          {/* Title with glow effect */}
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl mb-6 relative"
            style={{
              fontFamily: 'var(--font-space-grotesk), sans-serif',
              color: 'var(--neural-text-primary)',
              fontWeight: 700,
              textShadow: '0 0 30px rgb(var(--accent-rgb) / 0.3)',
            }}
          >
            {post.title}
          </motion.h1>

          {/* Meta line: date */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mb-8"
            style={{
              color: 'var(--neural-text-muted)',
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
              fontSize: '14px',
            }}
          >
            {new Date(post.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, '')}
          </motion.div>

          {/* Tags */}
          {visibleTags.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex flex-wrap gap-2 mb-12"
            >
              {visibleTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => router.push(`/tags/${tag.slug}`)}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-all hover:scale-105"
                  style={{
                    backgroundColor: tagMix(tag.color, 8),
                    color: tagColor(tag.color),
                    border: `1px solid ${tagMix(tag.color, 25)}`,
                    fontFamily: 'var(--font-ibm-plex-mono), monospace',
                    fontSize: '12px',
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </motion.div>
          )}

          {/* Content */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="post-prose"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {post.content}
            </ReactMarkdown>
          </motion.div>

          <PostListSection posts={recentPosts} currentSlug={post.slug} series={series} />
        </div>
        <NeuralFooter />
      </motion.div>

      {graph && <NeuralMiniMap key={post.slug} graph={graph} tagPostLinks={tagPostLinks} postLinks={postLinks} currentSlug={post.slug} />}

      {/* Table of Contents (right side) */}
      <TableOfContents
        content={post.content}
        scrollContainerRef={contentRef}
      />

    </motion.div>
  );
}
