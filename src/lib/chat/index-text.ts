import { truncateChars } from './config.ts';

export interface IndexRow {
  category_path: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  created_at: string;
}

export interface ChatIndex {
  text: string;
  slugs: string[];
}

const TITLE_MAX = 60;
const EXCERPT_MAX = 120;

function clean(value: string | null | undefined, max: number): string {
  const flat = (value ?? '').replace(/[\r\n|]/g, ' ').trim();
  return truncateChars(flat, max);
}

/** One router-index line per post: slug | category | title | excerpt | YYYY-MM. */
export function buildIndexLine(row: IndexRow): string {
  const fields = [
    clean(row.slug, 100),
    clean(row.category_path, 100) || '-',
    clean(row.title, TITLE_MAX),
    clean(row.excerpt, EXCERPT_MAX),
    row.created_at.slice(0, 7),
  ];
  return fields.join(' | ');
}

/** Router index text and its slug list, one line per post. */
export function buildIndex(rows: readonly IndexRow[]): ChatIndex {
  return {
    text: rows.map(buildIndexLine).join('\n'),
    slugs: rows.map((r) => r.slug),
  };
}
