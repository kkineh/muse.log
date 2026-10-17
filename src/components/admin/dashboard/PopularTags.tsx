'use client';

import { tagColor } from '@/lib/tag-color';

interface Props {
  data: { name: string; color: string; post_count: number }[];
}

export default function PopularTags({ data }: Props) {
  const maxCount = Math.max(...data.map((t) => t.post_count), 1);

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Popular Tags
      </h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]" style={{ color: 'var(--text-secondary)' }}>
          No tags yet
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((tag) => (
            <div key={tag.name} className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: tagColor(tag.color) }}
              />
              <span
                className="text-sm flex-shrink-0 w-24 truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {tag.name}
              </span>
              <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(tag.post_count / maxCount) * 100}%`,
                    background: tagColor(tag.color),
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-sm font-medium flex-shrink-0 w-8 text-right" style={{ color: 'var(--text-secondary)' }}>
                {tag.post_count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
