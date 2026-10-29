'use client';

// Posts management page
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { PostWithCategory, Category } from '@/types/database';
import {
  buildCategoryMap,
  getCategoryPath,
  getCachedCategories,
  setCachedCategories,
} from '@/lib/utils/category';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  });
}

// 카테고리 트리 평탄화
interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

function flattenCategories(tree: CategoryWithChildren[]): Category[] {
  const result: Category[] = [];

  function traverse(nodes: CategoryWithChildren[]) {
    for (const node of nodes) {
      const { children, ...category } = node;
      result.push(category as Category);
      if (children && children.length > 0) {
        traverse(children);
      }
    }
  }

  traverse(tree);
  return result;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 캐시 조회
        const cached = getCachedCategories();
        if (cached) {
          setCategories(cached);
        }

        // 병렬 fetch (posts + categories)
        const [postsRes, categoriesRes] = await Promise.all([
          fetch('/api/posts'),
          cached ? null : fetch('/api/categories'),
        ]);

        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData);
        }

        if (categoriesRes?.ok) {
          const categoriesData = await categoriesRes.json();
          // 트리 구조를 평탄화
          const flatCategories = flattenCategories(categoriesData);
          setCategories(flatCategories);
          setCachedCategories(flatCategories);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // 카테고리 맵 생성
  const categoryMap = useMemo(
    () => buildCategoryMap(categories),
    [categories]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--color-primary)' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="adm-h1">Posts</h1>
          <p className="adm-sub mt-1">{posts.length} total</p>
        </div>
        <Link href="/admin/posts/new" className="adm-btn adm-btn-primary">
          <Plus size={15} /> New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div
          className="adm-panel p-12 text-center"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p className="mb-3">No posts yet.</p>
          <Link href="/admin/posts/new" style={{ color: 'var(--color-primary)' }}>
            Create your first post
          </Link>
        </div>
      ) : (
        <div className="adm-panel">
          <div className="adm-row adm-row-head">
            <span className="adm-label">Title</span>
            <span className="adm-label c-cat">Category</span>
            <span className="adm-label c-date">Date</span>
            <span className="adm-label c-status">Status</span>
            <span className="c-act" />
          </div>
          {posts.map((post) => (
            <div key={post.id} className="adm-row">
              <div className="c-title">
                <Link
                  href={`/posts/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium hover:underline"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {post.title}
                </Link>
                <div className="adm-sub truncate">/{post.slug}</div>
              </div>

              <div className="c-cat">
                {getCategoryPath(post.category_id, categoryMap)}
              </div>
              <div className="c-date">
                {formatDate(post.created_at)}
              </div>
              <div className="c-status">
                <span className={`adm-badge ${post.published ? 'ok' : 'draft'}`}>
                  {post.published ? 'Published' : 'Draft'}
                </span>
              </div>

              <div className="c-act">
                <Link
                  href={`/admin/posts/${post.slug}/edit`}
                  className="adm-icon-btn"
                  title="Edit"
                  aria-label={`Edit ${post.title}`}
                >
                  <Pencil size={15} />
                </Link>
                <button
                  className="adm-icon-btn danger"
                  title="Delete"
                  aria-label={`Delete ${post.title}`}
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${post.title}"?`)) {
                      fetch(`/api/posts?slug=${post.slug}`, {
                        method: 'DELETE',
                      }).then(async (res) => {
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          alert(body.error || 'Failed to delete post');
                          return;
                        }
                        window.location.reload();
                      });
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
