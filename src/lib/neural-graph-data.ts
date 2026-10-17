import { createClient } from '@/lib/supabase-server';
import type { Category, CategoryWithChildren, Post } from '@/types/database';
import { buildNeuralGraph, type NeuralGraphData } from '@/lib/neural-graph-builder';

// Helper function to build category tree
function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const tree: CategoryWithChildren[] = [];
  const map = new Map<string, CategoryWithChildren>();

  // First pass: create all nodes
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: build tree structure
  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parent_id) {
      const parent = map.get(cat.parent_id);
      if (parent) {
        parent.children?.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  return tree;
}

// --- Mock data for development / empty DB ---
function getMockData(): { categories: Category[]; posts: Post[] } {
  const now = new Date().toISOString();

  const categories: Category[] = [
    // depth 1 — 카테고리
    { id: 'cat-dev', name: 'IT / 개발', slug: 'dev', parent_id: null, level: 1, order: 0, description: null, created_at: now, updated_at: now },
    { id: 'cat-idea', name: '아이디어', slug: 'idea', parent_id: null, level: 1, order: 1, description: null, created_at: now, updated_at: now },
    { id: 'cat-stock', name: '주식', slug: 'stock', parent_id: null, level: 1, order: 2, description: null, created_at: now, updated_at: now },
    { id: 'cat-life', name: '생활', slug: 'life', parent_id: null, level: 1, order: 3, description: null, created_at: now, updated_at: now },
    { id: 'cat-rel', name: '관계', slug: 'rel', parent_id: null, level: 1, order: 4, description: null, created_at: now, updated_at: now },

    // depth 2 — 서브카테고리
    { id: 'sub-frontend', name: 'Frontend', slug: 'frontend', parent_id: 'cat-dev', level: 2, order: 0, description: null, created_at: now, updated_at: now },
    { id: 'sub-backend', name: 'Backend', slug: 'backend', parent_id: 'cat-dev', level: 2, order: 1, description: null, created_at: now, updated_at: now },
    { id: 'sub-devops', name: 'DevOps', slug: 'devops', parent_id: 'cat-dev', level: 2, order: 2, description: null, created_at: now, updated_at: now },
    { id: 'sub-thinking', name: '사고법', slug: 'thinking', parent_id: 'cat-idea', level: 2, order: 0, description: null, created_at: now, updated_at: now },
    { id: 'sub-product', name: '프로덕트', slug: 'product', parent_id: 'cat-idea', level: 2, order: 1, description: null, created_at: now, updated_at: now },
    { id: 'sub-invest', name: '투자철학', slug: 'invest', parent_id: 'cat-stock', level: 2, order: 0, description: null, created_at: now, updated_at: now },
    { id: 'sub-review', name: '종목리뷰', slug: 'review', parent_id: 'cat-stock', level: 2, order: 1, description: null, created_at: now, updated_at: now },
    { id: 'sub-daily', name: '일상', slug: 'daily', parent_id: 'cat-life', level: 2, order: 0, description: null, created_at: now, updated_at: now },
    { id: 'sub-health', name: '건강', slug: 'health', parent_id: 'cat-life', level: 2, order: 1, description: null, created_at: now, updated_at: now },
    { id: 'sub-human', name: '인간관계', slug: 'human', parent_id: 'cat-rel', level: 2, order: 0, description: null, created_at: now, updated_at: now },
  ];

  const posts: Post[] = [
    // IT / 개발 > Frontend
    { id: 'post-ts', title: '타입스크립트 제네릭이 갑자기 이해된 날', slug: 'typescript-generics', content: '', excerpt: null, category_id: 'sub-frontend', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },
    { id: 'post-ai', title: 'AI 코드 어시스턴트 6개월 후기', slug: 'ai-code-assistant-review', content: '', excerpt: null, category_id: 'sub-frontend', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },
    { id: 'post-react19', title: 'React 19 액션 패턴 실험', slug: 'react-19-actions', content: '', excerpt: null, category_id: 'sub-frontend', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // IT / 개발 > Backend
    { id: 'post-docker', title: 'Docker 없이 살 수 없는 이유', slug: 'docker-essential', content: '', excerpt: null, category_id: 'sub-backend', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // IT / 개발 > DevOps
    { id: 'post-cicd', title: 'CI/CD 파이프라인 자동화 여정', slug: 'cicd-automation', content: '', excerpt: null, category_id: 'sub-devops', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 아이디어 > 사고법
    { id: 'post-think1', title: '생각을 소유하는 것과 떠내려가는 것', slug: 'owning-thoughts', content: '', excerpt: null, category_id: 'sub-thinking', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },
    { id: 'post-think2', title: '두 번째 뇌 구축 방법론', slug: 'second-brain', content: '', excerpt: null, category_id: 'sub-thinking', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 아이디어 > 프로덕트
    { id: 'post-mvp', title: 'MVP에서 배운 것들', slug: 'mvp-lessons', content: '', excerpt: null, category_id: 'sub-product', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 주식 > 투자철학
    { id: 'post-loss', title: '손실을 기록하는 것의 의미', slug: 'recording-losses', content: '', excerpt: null, category_id: 'sub-invest', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 주식 > 종목리뷰
    { id: 'post-etf', title: 'ETF 포트폴리오 1년 결산', slug: 'etf-portfolio-review', content: '', excerpt: null, category_id: 'sub-review', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 생활 > 일상
    { id: 'post-dawn', title: '새벽 4시의 고요함에 대하여', slug: 'dawn-silence', content: '', excerpt: null, category_id: 'sub-daily', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 생활 > 건강
    { id: 'post-run', title: '러닝 100일 후 달라진 것들', slug: 'running-100-days', content: '', excerpt: null, category_id: 'sub-health', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },

    // 관계 > 인간관계
    { id: 'post-cold', title: '가까운 사람에게 더 차가워지는 이유', slug: 'cold-to-close-ones', content: '', excerpt: null, category_id: 'sub-human', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },
    { id: 'post-dist', title: '거리의 미학', slug: 'aesthetics-of-distance', content: '', excerpt: null, category_id: 'sub-human', created_at: now, updated_at: now, published: true, author_id: null, view_count: 0 },
  ];

  return { categories, posts };
}

export async function getNeuralGraphProps(): Promise<{
  graph: NeuralGraphData;
  tagPostLinks: { source: string; target: string; sharedCount: number }[];
}> {
  let categories: Category[] = [];
  let posts: Post[] = [];

  try {
    const supabase = await createClient();

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('level')
      .order('order');

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (categoriesError || postsError) {
      console.error('DB fetch error, falling back to mock data');
    }

    categories = categoriesData || [];
    posts = postsData || [];
  } catch (error) {
    console.error('Supabase connection failed, using mock data:', error);
  }

  // DB가 비어있으면 mock 데이터로 폴백
  if (categories.length === 0 && posts.length === 0) {
    const mock = getMockData();
    categories = mock.categories;
    posts = mock.posts;
  }

  // Compute tag-based post-to-post links
  let tagPostLinks: { source: string; target: string; sharedCount: number }[] = [];
  try {
    const supabase = await createClient();
    const { data: postTags } = await supabase
      .from('post_tags')
      .select('post_id, tag_id');

    if (postTags && postTags.length > 0) {
      // Only include published post IDs
      const publishedIds = new Set(posts.filter(p => p.published).map(p => p.id));

      // Group tags by post
      const tagsByPost = new Map<string, string[]>();
      for (const pt of postTags) {
        if (!publishedIds.has(pt.post_id)) continue;
        const tags = tagsByPost.get(pt.post_id) || [];
        tags.push(pt.tag_id);
        tagsByPost.set(pt.post_id, tags);
      }

      // Invert: group posts by tag
      const postsByTag = new Map<string, string[]>();
      for (const [postId, tags] of tagsByPost) {
        for (const tagId of tags) {
          const ps = postsByTag.get(tagId) || [];
          ps.push(postId);
          postsByTag.set(tagId, ps);
        }
      }

      // Count shared tags for each post pair
      const pairMap = new Map<string, number>();
      for (const postIds of postsByTag.values()) {
        for (let i = 0; i < postIds.length; i++) {
          for (let j = i + 1; j < postIds.length; j++) {
            const key = [postIds[i], postIds[j]].sort().join('::');
            pairMap.set(key, (pairMap.get(key) || 0) + 1);
          }
        }
      }

      tagPostLinks = Array.from(pairMap.entries()).map(([key, count]) => {
        const [source, target] = key.split('::');
        return { source, target, sharedCount: count };
      });
    }
  } catch (error) {
    console.error('Failed to fetch post_tags for tag links:', error);
  }

  const categoryTree = buildCategoryTree(categories);
  const neuralGraph = buildNeuralGraph(categoryTree, posts);

  return { graph: neuralGraph, tagPostLinks };
}
