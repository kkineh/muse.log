-- Brain Publish Migration (Roadmap ②)
-- Created: 2026-10-29
-- Description: posts.origin, post_sources, post_links, blog_index view, brain post guard trigger, brain/ storage policies

-- ============================================================================
-- TABLE
-- ============================================================================

-- 글 출처 표시 (공개돼도 무방한 값만 posts에 둔다)
ALTER TABLE posts
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'admin'
  CHECK (origin IN ('admin', 'brain'));

-- brain 파일 매핑 (파일명에 비공개 분류가 들어갈 수 있어 posts와 분리, 공개 읽기 없음)
CREATE TABLE post_sources (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL UNIQUE,      -- 'blog/260903-musing-sr-agent-motivation.md'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 글-글 링크 (방향 있음: source 글이 target 글을 가리킴)
CREATE TABLE post_links (
  source_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  target_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_post_id, target_post_id),
  CHECK (source_post_id <> target_post_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_post_links_target ON post_links(target_post_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE post_sources ENABLE ROW LEVEL SECURITY;   -- 정책 없음
ALTER TABLE post_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_links_select_public ON post_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM posts s WHERE s.id = post_links.source_post_id AND s.published)
  AND EXISTS (SELECT 1 FROM posts t WHERE t.id = post_links.target_post_id AND t.published)
);

-- ============================================================================
-- VIEW
-- ============================================================================

-- 블로그 index: 읽는 사람의 RLS를 따르고, 공개 글만 낸다
CREATE VIEW blog_index WITH (security_invoker = true) AS
SELECT
  concat_ws(' > ', c1.name, c2.name, c3.name) AS category_path,  -- 루트 → 잎
  p.title, p.slug, p.excerpt, p.created_at
FROM posts p
LEFT JOIN categories c3 ON c3.id = p.category_id
LEFT JOIN categories c2 ON c2.id = c3.parent_id
LEFT JOIN categories c1 ON c1.id = c2.parent_id
WHERE p.published = true;
-- 주: 잎이 1·2단계면 위 조인이 앞을 NULL로 채우므로 concat_ws가 NULL을 건너뛰어 경로가 맞게 나온다

-- ============================================================================
-- GRANTS
-- ============================================================================

-- 새 객체는 모두 회수한 뒤 필요한 것만 준다 (default privileges가 anon/authenticated에 ALL을 줌)
REVOKE ALL ON post_sources, post_links, blog_index FROM anon, authenticated;
GRANT SELECT ON post_links, blog_index TO anon, authenticated;
GRANT ALL ON post_sources, post_links TO service_role;
GRANT SELECT ON blog_index TO service_role;

-- ============================================================================
-- TRIGGER
-- ============================================================================

-- brain 출신 행 보호. 역할로 먼저 판정하고 그 밖은 막는다(fail closed).
-- 통과: API 역할(anon, authenticated)이 아닌 실행(SQL 에디터·마이그레이션 = postgres,
--       postgres 소유 SECURITY DEFINER 함수 increment_view_count)과 service role.
CREATE OR REPLACE FUNCTION public.guard_brain_posts() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.origin IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'origin must be admin' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.origin = 'brain' THEN
      RAISE EXCEPTION 'brain-managed post cannot be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.origin IS DISTINCT FROM OLD.origin THEN
    RAISE EXCEPTION 'origin is immutable' USING ERRCODE = '42501';
  END IF;

  IF OLD.origin = 'brain' AND (
       NEW.title      IS DISTINCT FROM OLD.title
    OR NEW.slug       IS DISTINCT FROM OLD.slug
    OR NEW.content    IS DISTINCT FROM OLD.content
    OR NEW.excerpt    IS DISTINCT FROM OLD.excerpt
    OR NEW.published  IS DISTINCT FROM OLD.published
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'brain-managed field' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER posts_guard_brain
  BEFORE INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_brain_posts();

-- ============================================================================
-- STORAGE
-- ============================================================================

-- blog-images/brain/*은 발행 스크립트(service role, RLS 우회)만 쓰고 지운다.
-- 001/002의 blog_images_admin_all(PERMISSIVE, FOR ALL)에 RESTRICTIVE 정책을 더해
-- admin 세션(authenticated)의 brain/ 키 생성·수정·삭제를 막는다. 공개 읽기는 그대로다.
CREATE POLICY blog_images_brain_no_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (bucket_id = 'blog-images' AND name LIKE 'brain/%'));

CREATE POLICY blog_images_brain_no_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (bucket_id = 'blog-images' AND name LIKE 'brain/%'))
  WITH CHECK (NOT (bucket_id = 'blog-images' AND name LIKE 'brain/%'));

CREATE POLICY blog_images_brain_no_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (bucket_id = 'blog-images' AND name LIKE 'brain/%'));
