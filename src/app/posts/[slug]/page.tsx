import { notFound } from 'next/navigation';
import { decodeSlug, isValidSlug } from '@/lib/slug';
import type { Metadata } from 'next';
import { createBrowserClient } from '@supabase/ssr';
import { createClient, isAdmin } from '@/lib/supabase-server';
import { getNeuralGraphProps } from '@/lib/neural-graph-data';
import PostDetailView from '@/components/PostDetailView';

// ISR: 24시간마다 재검증
export const revalidate = 86400;

// 빌드타임에 없는 slug도 런타임에 ISR로 생성 허용
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// 빌드타임에 모든 published 게시글 생성
export async function generateStaticParams() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: posts } = await supabase
    .from('posts')
    .select('slug')
    .eq('published', true);

  if (!posts) return [];
  return posts.map((post) => ({ slug: post.slug }));
}

// SEO Metadata
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  // Route params arrive percent-encoded; decode before validating/querying.
  const slug = decodeSlug(rawSlug);

  if (!isValidSlug(slug)) {
    return { title: 'Not Found' };
  }

  const supabase = await createClient();
  const admin = await isAdmin();

  let query = supabase
    .from('posts')
    .select('title, excerpt, created_at, published')
    .eq('slug', slug);

  if (!admin) {
    query = query.eq('published', true);
  }

  const { data: post } = await query.single();

  if (!post) {
    return { title: 'Not Found' };
  }

  return {
    title: `${post.title} - Muse.log`,
    description: post.excerpt || undefined,
    ...(post.published === false && { robots: { index: false, follow: false } }),
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      type: 'article',
      publishedTime: post.created_at,
    },
  };
}

// 게시글 페이지
export default async function PostPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  // Route params arrive percent-encoded; decode before validating/querying.
  const slug = decodeSlug(rawSlug);

  if (!isValidSlug(slug)) {
    notFound();
  }

  const supabase = await createClient();
  const admin = await isAdmin();

  // 현재 게시글 조회 (admin은 draft도 조회 가능)
  let postQuery = supabase
    .from('posts')
    .select(`*, category:categories(*), post_tags(tag_id, tags:tags(*))`)
    .eq('slug', slug);

  if (!admin) {
    postQuery = postQuery.eq('published', true);
  }

  const { data: post } = await postQuery.single();

  if (!post) {
    notFound();
  }

  // 같은 카테고리의 관련 게시글
  let relatedPosts: { title: string; slug: string }[] = [];
  if (post.category_id) {
    const { data: related } = await supabase
      .from('posts')
      .select('title, slug')
      .eq('category_id', post.category_id)
      .eq('published', true)
      .neq('slug', slug)
      .order('created_at', { ascending: false })
      .limit(5);
    if (related) relatedPosts = related;
  }

  // 이전/다음 게시글 (published 기준 유지)
  const isDraft = !post.published;
  let prevPost: { title: string; slug: string } | null = null;
  let nextPost: { title: string; slug: string } | null = null;

  if (!isDraft) {
    const { data: allPosts } = await supabase
      .from('posts')
      .select('title, slug')
      .eq('published', true)
      .order('created_at', { ascending: true });

    if (allPosts) {
      const idx = allPosts.findIndex((p) => p.slug === slug);
      if (idx > 0) prevPost = allPosts[idx - 1];
      if (idx < allPosts.length - 1) nextPost = allPosts[idx + 1];
    }
  }

  // Extract tags from post_tags join
  const tags = (post.post_tags || []).map(
    (pt: { tag_id: string; tags: { id: string; name: string; slug: string; color: string } }) => pt.tags
  );

  // Build category breadcrumb chain (child → root)
  let categoryBreadcrumb: { id: string; name: string; slug: string }[] = [];
  if (post.category) {
    const chain: { id: string; name: string; slug: string }[] = [post.category];
    let currentParentId = post.category.parent_id;
    while (currentParentId) {
      const { data: parent } = await supabase
        .from('categories')
        .select('id, name, slug, parent_id')
        .eq('id', currentParentId)
        .single();
      if (!parent) break;
      chain.unshift(parent);
      currentParentId = parent.parent_id;
    }
    categoryBreadcrumb = chain;
  }

  const { graph, tagPostLinks } = await getNeuralGraphProps();

  return (
    <PostDetailView
      post={{
        title: post.title,
        slug: post.slug,
        content: post.content,
        created_at: post.created_at,
        tags,
      }}
      categoryBreadcrumb={categoryBreadcrumb}
      relatedPosts={relatedPosts}
      prevPost={prevPost}
      nextPost={nextPost}
      isDraft={isDraft}
      isAdmin={admin}
      graph={graph}
      tagPostLinks={tagPostLinks}
    />
  );
}
