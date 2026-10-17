/**
 * Category page - Neural theme layout
 * Displays all posts in a category and its descendants
 * Uses ISR with 1-hour revalidation and static generation
 */

import { notFound } from 'next/navigation';
import { decodeSlug, isValidSlug } from '@/lib/slug';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase-server';
import { getCachedCategoryTree } from '@/lib/supabase/cache';
import {
  buildCategoryMap,
  getCategoryPath,
  getDescendantCategoryIds,
} from '@/lib/utils/category';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: categories } = await supabase
    .from('categories')
    .select('slug')
    .order('level', { ascending: true });

  if (!categories) return [];

  return categories.map((cat) => ({
    slug: cat.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const supabase = await createClient();

  const { data: category } = await supabase
    .from('categories')
    .select('name, description')
    .eq('slug', slug)
    .single();

  return {
    title: category ? `${category.name} - Muse.log` : 'Category - Muse.log',
    description: category?.description || undefined,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  // Route params arrive percent-encoded; decode before validating/querying.
  const slug = decodeSlug(rawSlug);

  if (!isValidSlug(slug)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (categoryError || !category) {
    notFound();
  }

  const allCategories = await getCachedCategoryTree();
  const categoryMap = buildCategoryMap(allCategories);

  const categoryIds = getDescendantCategoryIds(category.id, categoryMap);

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('category_id', categoryIds)
    .eq('published', true)
    .order('created_at', { ascending: false });

  const subcategories = allCategories
    .filter((cat) => cat.parent_id === category.id)
    .map((cat) => ({ name: cat.name, slug: cat.slug }));

  // Build breadcrumb path
  const categoryPath = getCategoryPath(category.id, categoryMap);
  const pathSegments = categoryPath.split(' > ');
  const breadcrumbItems = pathSegments.map((name, index) => {
    const cat = Array.from(categoryMap.values()).find((c) => c.name === name);
    const isLast = index === pathSegments.length - 1;
    return { name, slug: cat?.slug, isLast };
  });

  return (
    <div
      className="relative min-h-screen"
      style={{ background: 'var(--neural-bg)' }}
    >
      {/* Neural dot grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.6' fill='%2300ffc840'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Fixed header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-8 py-5"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,11,16,0.95) 0%, rgba(8,11,16,0.8) 60%, transparent 100%)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
          style={{
            color: 'var(--neural-text-muted)',
            fontFamily: 'var(--font-space-grotesk), sans-serif',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--neural-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          돌아가기
        </Link>
      </header>

      {/* Content */}
      <div className="relative max-w-3xl mx-auto px-8 pt-28 pb-24">
        {/* Category breadcrumb path */}
        <div
          className="flex items-center gap-1.5 mb-6"
          style={{
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontSize: '13px',
          }}
        >
          {breadcrumbItems.map((item, index) => (
            <span key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span
                  style={{ color: 'var(--neural-text-muted)', opacity: 0.5 }}
                >
                  /
                </span>
              )}
              {item.isLast ? (
                <span style={{ color: 'var(--neural-accent)' }}>
                  {item.name}
                </span>
              ) : item.slug ? (
                <Link
                  href={`/category/${item.slug}`}
                  className="transition-colors hover:opacity-80"
                  style={{ color: 'var(--neural-text-muted)' }}
                >
                  {item.name}
                </Link>
              ) : (
                <span style={{ color: 'var(--neural-text-muted)' }}>
                  {item.name}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Category name */}
        <h1
          className="text-4xl font-bold mb-3"
          style={{
            color: 'var(--neural-text-primary)',
            fontFamily: 'var(--font-space-grotesk), sans-serif',
            textShadow: '0 0 30px rgb(var(--accent-rgb) / 0.15)',
          }}
        >
          {category.name}
        </h1>

        {/* Description + post count */}
        <div className="mb-10">
          {category.description && (
            <p
              className="text-sm mb-2"
              style={{ color: 'var(--neural-text-muted)' }}
            >
              {category.description}
            </p>
          )}
          <p
            className="text-sm"
            style={{
              color: 'var(--neural-text-muted)',
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
            }}
          >
            {posts?.length || 0} post{(posts?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Subcategory pills */}
        {subcategories.length > 0 && (
          <div className="mb-12">
            <h2
              className="text-sm mb-4"
              style={{
                color: 'var(--neural-text-muted)',
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
              }}
            >
              Subcategories
            </h2>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Link
                  key={sub.slug}
                  href={`/category/${sub.slug}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'rgb(var(--accent-rgb) / 0.08)',
                    color: 'var(--neural-accent)',
                    border: '1px solid rgb(var(--accent-rgb) / 0.25)',
                    fontFamily: 'var(--font-ibm-plex-mono), monospace',
                    fontSize: '12px',
                  }}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Post cards */}
        <div className="space-y-6">
          {posts &&
            posts.map((post) => (
              <Link
                key={post.slug}
                href={`/posts/${post.slug}`}
                className="block p-6 rounded-2xl border transition-all hover:shadow-[0_0_30px_rgb(var(--accent-rgb)/0.15)]"
                style={{
                  borderColor: 'rgb(var(--accent-rgb) / 0.15)',
                  background: 'rgb(var(--accent-rgb) / 0.03)',
                }}
              >
                <h3
                  className="text-xl mb-2"
                  style={{
                    color: 'var(--neural-text-primary)',
                    fontFamily: 'var(--font-space-grotesk), sans-serif',
                    fontWeight: 600,
                  }}
                >
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p
                    className="text-sm mb-3 line-clamp-2"
                    style={{ color: 'var(--neural-text-muted)' }}
                  >
                    {post.excerpt}
                  </p>
                )}
                <time
                  className="text-xs"
                  style={{
                    color: 'var(--neural-text-muted)',
                    fontFamily: 'var(--font-ibm-plex-mono), monospace',
                  }}
                >
                  {new Date(post.created_at).toLocaleDateString('ko-KR')}
                </time>
              </Link>
            ))}

          {(!posts || posts.length === 0) && (
            <p
              className="text-center py-12 text-sm"
              style={{ color: 'var(--neural-text-muted)' }}
            >
              No posts yet in this category.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
