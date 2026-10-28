'use client';

interface Props {
  data: { title: string; slug: string; view_count: number }[];
}

export default function PopularPosts({ data }: Props) {
  return (
    <div className="adm-panel adm-section">
      <h3 className="adm-section-title">Popular Posts</h3>
      {data.length === 0 ? (
        <div className="adm-sub flex items-center justify-center h-[200px]">
          No view data yet
        </div>
      ) : (
        <div className="-mx-[1.4rem] -mb-[1.25rem]">
          {data.map((post, i) => (
            <a
              key={post.slug}
              href={`/admin/posts/${post.slug}/edit`}
              className="flex items-center gap-3 px-[1.4rem] py-3 no-underline transition-colors hover:bg-[var(--t-sunken)] border-t border-[var(--t-border-soft)] first:border-t-0"
            >
              <span
                className="w-5 text-xs font-semibold flex-shrink-0 tabular-nums"
                style={{ color: i < 3 ? 'var(--t-accent)' : 'var(--t-muted)' }}
              >
                {i + 1}
              </span>
              <span className="text-sm truncate flex-1" style={{ color: 'var(--t-text)' }}>
                {post.title}
              </span>
              <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--t-text2)' }}>
                {post.view_count.toLocaleString()} views
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
