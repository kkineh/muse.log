// Pure helper (no imports, erasable TS only) so it can be unit-tested with `node --test`.

export interface TagPostLink {
  source: string;
  target: string;
  sharedCount: number;
}

export interface PostLink {
  source: string;
  target: string;
}

/**
 * Dedupe explicit post links as undirected pairs (self-links dropped) and
 * remove those pairs from the tag-based edges so one pair draws a single edge.
 */
export function mergePostLinks(
  tagPostLinks: TagPostLink[],
  rawLinks: { source_post_id: string; target_post_id: string }[]
): { postLinks: PostLink[]; tagPostLinks: TagPostLink[] } {
  const pairs = new Map<string, PostLink>();
  for (const r of rawLinks) {
    if (r.source_post_id === r.target_post_id) continue;
    const [source, target] = [r.source_post_id, r.target_post_id].sort();
    pairs.set(`${source}::${target}`, { source, target });
  }
  return {
    postLinks: Array.from(pairs.values()),
    tagPostLinks: tagPostLinks.filter(
      (t) => !pairs.has([t.source, t.target].sort().join('::'))
    ),
  };
}
