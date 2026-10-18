import { notFound } from 'next/navigation';
import { decodeSlug, isValidSlug } from '@/lib/slug';
import type { Metadata } from 'next';
import { createBrowserClient } from '@supabase/ssr';
import { createClient, isAdmin } from '@/lib/supabase-server';
import { getNeuralGraphProps } from '@/lib/neural-graph-data';
import { isSeriesTag } from '@/lib/series';
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

  // 최근순 글 목록 (published)
  const { data: recentData } = await supabase
    .from('posts')
    .select('title, slug, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });
  const recentPosts = recentData ?? [];

  const isDraft = !post.published;

  // Extract tags from post_tags join
  const tags = (post.post_tags || []).map(
    (pt: { tag_id: string; tags: { id: string; name: string; slug: string; color: string } }) => pt.tags
  );

  // 시리즈: `series:` 태그가 붙은 글이면 같은 시리즈 글을 작성일 오래된 순으로 가져온다
  const seriesTag = tags.find((t: { name: string }) => isSeriesTag(t.name));
  let series: { name: string; posts: { title: string; slug: string; created_at: string }[] } | null = null;
  if (seriesTag) {
    const { data: seriesRows } = await supabase
      .from('post_tags')
      .select('post:posts!inner(title, slug, created_at, published)')
      .eq('tag_id', seriesTag.id)
      .eq('post.published', true);
    const seriesPosts = (seriesRows ?? [])
      .map((row) => row.post as unknown as { title: string; slug: string; created_at: string } | null)
      .filter((p): p is { title: string; slug: string; created_at: string } => !!p)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (seriesPosts.length >= 2) series = { name: seriesTag.name, posts: seriesPosts };
  }

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
      recentPosts={recentPosts}
      series={series}
      isDraft={isDraft}
      isAdmin={admin}
      graph={graph}
      tagPostLinks={tagPostLinks}
    />
  );
}
