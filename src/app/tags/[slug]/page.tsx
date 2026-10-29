import { notFound } from 'next/navigation';
import { decodeSlug } from '@/lib/slug';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase-server';
import { tagColor, tagMix } from '@/lib/tag-color';

export const revalidate = 86400;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: tags } = await supabase.from('tags').select('slug');
  if (!tags) return [];
  return tags.map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const supabase = await createClient();

  const { data: tag } = await supabase
    .from('tags')
    .select('name')
    .eq('slug', slug)
    .single();

  if (!tag) return { title: 'Not Found' };

  return {
    title: `Tag: ${tag.name} - Muse.log`,
    description: `Posts tagged with ${tag.name}`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const supabase = await createClient();

  // Fetch tag
  const { data: tag } = await supabase
    .from('tags')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!tag) notFound();

  // Fetch posts with this tag
  const { data: postTags } = await supabase
    .from('post_tags')
    .select('post_id')
    .eq('tag_id', tag.id);

  const postIds = (postTags || []).map((pt) => pt.post_id);

  let posts: { title: string; slug: string; excerpt: string | null; created_at: string }[] = [];
  if (postIds.length > 0) {
    const { data } = await supabase
      .from('posts')
      .select('title, slug, excerpt, created_at')
      .in('id', postIds)
      .eq('published', true)
      .order('created_at', { ascending: false });
    if (data) posts = data;
  }

  // Fetch related tags
  const { data: relations } = await supabase
    .from('tag_relations')
    .select('tag_a, tag_b, strength')
    .or(`tag_a.eq.${tag.id},tag_b.eq.${tag.id}`)
    .order('strength', { ascending: false })
    .limit(8);

  let relatedTags: { id: string; name: string; slug: string; color: string; strength: number }[] = [];
  if (relations && relations.length > 0) {
    const otherIds = relations.map((r) =>
      r.tag_a === tag.id ? r.tag_b : r.tag_a
    );
    const { data: otherTags } = await supabase
      .from('tags')
      .select('*')
      .in('id', otherIds);

    if (otherTags) {
      const tagMap = new Map(otherTags.map((t) => [t.id, t]));
      relatedTags = relations
        .map((r) => {
          const otherId = r.tag_a === tag.id ? r.tag_b : r.tag_a;
          const t = tagMap.get(otherId);
          if (!t) return null;
          return { ...t, strength: r.strength };
        })
        .filter(Boolean) as typeof relatedTags;
    }
  }

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

      <div className="relative max-w-3xl mx-auto px-8 pt-28 pb-24">

        {/* Tag header */}
        <div className="mb-12">
          <span
            className="inline-block px-4 py-2 rounded-full text-lg font-medium mb-4"
            style={{
              backgroundColor: tagMix(tag.color, 8),
              color: tagColor(tag.color),
              border: `1px solid ${tagMix(tag.color, 25)}`,
              fontFamily: 'var(--font-space-grotesk), sans-serif',
            }}
          >
            {tag.name}
          </span>
          <p
            className="text-sm mt-2"
            style={{
              color: 'var(--neural-text-muted)',
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
            }}
          >
            {posts.length} post{posts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Related tags */}
        {relatedTags.length > 0 && (
          <div className="mb-12">
            <h2
              className="text-sm mb-4"
              style={{
                color: 'var(--neural-text-muted)',
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
              }}
            >
              Related Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedTags.map((rt) => (
                <Link
                  key={rt.id}
                  href={`/tags/${rt.slug}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-all hover:scale-105"
                  style={{
                    backgroundColor: tagMix(rt.color, 8),
                    color: tagColor(rt.color),
                    border: `1px solid ${tagMix(rt.color, 25)}`,
                    fontFamily: 'var(--font-ibm-plex-mono), monospace',
                    fontSize: '12px',
                  }}
                >
                  {rt.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/posts/${p.slug}`}
              className="block p-6 rounded-2xl border transition-all hover:shadow-[0_0_30px_rgb(var(--accent-rgb)/0.15)]"
              style={{
                borderColor: tagMix(tag.color, 19),
                background: tagMix(tag.color, 2),
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
                {p.title}
              </h3>
              {p.excerpt && (
                <p
                  className="text-sm mb-3 line-clamp-2"
                  style={{ color: 'var(--neural-text-muted)' }}
                >
                  {p.excerpt}
                </p>
              )}
              <time
                className="text-xs"
                style={{
                  color: 'var(--neural-text-muted)',
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                }}
              >
                {new Date(p.created_at).toLocaleDateString('ko-KR')}
              </time>
            </Link>
          ))}

          {posts.length === 0 && (
            <p
              className="text-center py-12 text-sm"
              style={{ color: 'var(--neural-text-muted)' }}
            >
              No posts with this tag yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
