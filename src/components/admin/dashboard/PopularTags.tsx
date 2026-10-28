'use client';

import { tagColor } from '@/lib/tag-color';

interface Props {
  data: { name: string; color: string; post_count: number }[];
}

export default function PopularTags({ data }: Props) {
  const maxCount = Math.max(...data.map((t) => t.post_count), 1);

  return (
    <div className="adm-panel adm-section">
      <h3 className="adm-section-title">Popular Tags</h3>
      {data.length === 0 ? (
        <div className="adm-sub flex items-center justify-center h-[200px]">
          No tags yet
        </div>
      ) : (
        <div className="-mx-[1.4rem] -mb-[1.25rem]">
          {data.map((tag) => (
            <div
              key={tag.name}
              className="flex items-center gap-3 px-[1.4rem] py-3 transition-colors hover:bg-[var(--t-sunken)] border-t border-[var(--t-border-soft)] first:border-t-0"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: tagColor(tag.color) }}
              />
              <span
                className="text-sm flex-shrink-0 w-24 truncate"
                style={{ color: 'var(--t-text)' }}
              >
                {tag.name}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--t-sunken)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(tag.post_count / maxCount) * 100}%`,
                    background: tagColor(tag.color),
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className="text-sm flex-shrink-0 w-8 text-right tabular-nums" style={{ color: 'var(--t-text2)' }}>
                {tag.post_count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
