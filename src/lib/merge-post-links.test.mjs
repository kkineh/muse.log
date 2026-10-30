// Run: node --test src/lib/merge-post-links.test.mjs  (Node >= 22.18 strips TS types natively)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePostLinks } from './merge-post-links.ts';

const raw = (a, b) => ({ source_post_id: a, target_post_id: b });

test('A->B and B->A collapse to one pair', () => {
  const r = mergePostLinks([], [raw('b', 'a'), raw('a', 'b')]);
  assert.deepEqual(r.postLinks, [{ source: 'a', target: 'b' }]);
});

test('linked pair is removed from tag edges even with shared tags', () => {
  const r = mergePostLinks([{ source: 'a', target: 'b', sharedCount: 3 }], [raw('b', 'a')]);
  assert.deepEqual(r.tagPostLinks, []);
  assert.equal(r.postLinks.length, 1);
});

test('unlinked tag pair is kept with sharedCount', () => {
  const tags = [
    { source: 'a', target: 'b', sharedCount: 2 },
    { source: 'a', target: 'c', sharedCount: 4 },
  ];
  const r = mergePostLinks(tags, [raw('a', 'b')]);
  assert.deepEqual(r.tagPostLinks, [{ source: 'a', target: 'c', sharedCount: 4 }]);
});

test('self-links are ignored', () => {
  const r = mergePostLinks([], [raw('a', 'a')]);
  assert.deepEqual(r.postLinks, []);
});

test('empty links leave tag edges unchanged', () => {
  const tags = [{ source: 'a', target: 'b', sharedCount: 1 }];
  const r = mergePostLinks(tags, []);
  assert.deepEqual(r, { postLinks: [], tagPostLinks: tags });
});
