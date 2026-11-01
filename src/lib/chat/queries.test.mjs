import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchIndex, fetchPost } from './queries.ts';

// Minimal chainable stand-in for the supabase query builder.
const client = (result) => {
  const q = {
    select: () => q,
    order: () => q,
    eq: () => q,
    maybeSingle: () => q,
    then: (resolve) => resolve(result),
  };
  return { from: () => q };
};

test('fetchIndex: error와 빈 결과는 throw', async () => {
  await assert.rejects(
    fetchIndex(client({ data: null, error: { message: 'x' } }))
  );
  await assert.rejects(fetchIndex(client({ data: [], error: null })));
});

test('fetchIndex: 행을 텍스트와 slug 목록으로 만든다', async () => {
  const idx = await fetchIndex(
    client({
      data: [
        {
          category_path: null,
          title: 't',
          slug: 'a',
          excerpt: null,
          created_at: '2026-01-02T00:00:00Z',
        },
      ],
      error: null,
    })
  );
  assert.deepEqual(idx.slugs, ['a']);
});

test('fetchPost: error와 null은 throw', async () => {
  await assert.rejects(
    fetchPost(client({ data: null, error: { message: 'x' } }), 'a')
  );
  await assert.rejects(fetchPost(client({ data: null, error: null }), 'a'));
});

test('fetchPost: 글을 돌려준다', async () => {
  const post = { slug: 'a', title: 't', content: 'c' };
  assert.deepEqual(
    await fetchPost(client({ data: post, error: null }), 'a'),
    post
  );
});
