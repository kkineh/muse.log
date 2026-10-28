'use client';

interface Props {
  data: { title: string; slug: string; published: boolean; created_at: string; view_count: number }[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RecentPosts({ data }: Props) {
  return (
    <div className="adm-panel adm-section">
      <h3 className="adm-section-title">Recent Posts</h3>
      {data.length === 0 ? (
        <div className="adm-sub flex items-center justify-center h-[200px]">
          No posts yet
        </div>
      ) : (
        <div className="-mx-[1.4rem] -mb-[1.25rem]">
          {data.map((post) => (
            <a
              key={post.slug}
              href={`/admin/posts/${post.slug}/edit`}
              className="flex items-center justify-between px-[1.4rem] py-3 no-underline transition-colors hover:bg-[var(--t-sunken)] border-t border-[var(--t-border-soft)] first:border-t-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: post.published ? '#34d399' : '#fbbf24' }}
                />
                <span className="text-sm truncate" style={{ color: 'var(--t-text)' }}>
                  {post.title}
                </span>
              </div>
              <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--t-muted)' }}>
                {timeAgo(post.created_at)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
