'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { seriesLabel } from '@/lib/series';

export interface PostListItem {
  title: string;
  slug: string;
  created_at: string;
}

interface PostListSectionProps {
  posts: PostListItem[];
  currentSlug: string;
  series?: { name: string; posts: PostListItem[] } | null;
}

const PAGE_SIZE = 5;

export function pageItems(total: number, current: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

const pageButtonClass =
  'flex items-center justify-center min-w-8 h-8 px-2 rounded-lg text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 disabled:hover:bg-transparent';

function PostRows({ items, currentSlug }: { items: PostListItem[]; currentSlug: string }) {
  return (
      <ul style={{ borderTop: '1px solid var(--neural-line)' }}>
        {items.map((post) => {
          const current = post.slug === currentSlug;
          return (
            <li key={post.slug} style={{ borderBottom: '1px solid var(--neural-line)' }}>
              <Link
                href={`/posts/${post.slug}`}
                aria-current={current ? 'page' : undefined}
                className="flex items-baseline gap-6 py-2.5 transition-colors hover:text-[var(--neural-text-primary)]"
                style={{ color: current ? 'var(--neural-text-primary)' : 'var(--neural-text-muted)' }}
              >
                <span className="min-w-0 flex-1 truncate">{post.title}</span>
                <span
                  className="shrink-0 text-sm"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  {new Date(post.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
  );
}

export default function PostListSection({ posts, currentSlug, series }: PostListSectionProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const visible = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (posts.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mt-24 text-sm"
    >
      {series && (
        <div className="mb-16">
          <h3
            className="text-sm mb-6"
            style={{
              fontFamily: 'var(--font-space-grotesk), sans-serif',
              color: 'var(--neural-text-muted)',
              fontWeight: 600,
            }}
          >
            시리즈 · {seriesLabel(series.name)}
          </h3>
          <PostRows items={series.posts} currentSlug={currentSlug} />
        </div>
      )}

      <h3
        className="text-sm mb-6"
        style={{
          fontFamily: 'var(--font-space-grotesk), sans-serif',
          color: 'var(--neural-text-muted)',
          fontWeight: 600,
        }}
      >
        최근 글
      </h3>

      <PostRows items={visible} currentSlug={currentSlug} />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-1" aria-label="글 목록 페이지">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="이전 페이지"
            className={pageButtonClass}
            style={{ color: 'var(--neural-text-muted)' }}
          >
            <ChevronLeft size={16} />
          </button>
          {pageItems(totalPages, page).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-sm" style={{ color: 'var(--neural-text-muted)' }}>
                …
              </span>
            ) : (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={pageButtonClass}
              style={{
                color: n === page ? 'var(--neural-text-primary)' : 'var(--neural-text-muted)',
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
                background: n === page ? 'rgba(255,255,255,0.08)' : undefined,
              }}
            >
              {n}
            </button>
            )
          )}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="다음 페이지"
            className={pageButtonClass}
            style={{ color: 'var(--neural-text-muted)' }}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </motion.section>
  );
}
