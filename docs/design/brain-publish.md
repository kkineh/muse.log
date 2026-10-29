# 발행·이관 (로드맵 ②) 아키텍처 설계

- 작성: 2026-10-29, design-architecture. 개정: 2026-10-29 (주인 결정, security·cost 검토 반영)
- 상태: 설계 (구현 전). security·cost 필수 변경 반영 완료(§14)
- 전제: `D:\workspace\brain\.omc\specs\deep-interview-brain-muselog.md` 결정 9–14, Constraints, Roadmap ②
- 형식: `.claude/agents/design-architecture.md`의 출력 형식(렌더링·데이터 모델·API·플로우·캐시·파일 구조·비용)에 이번 요청의 항목(frontmatter 매핑, 링크 규칙, 스크립트, admin 잠금, RAG, 테스트)을 더했다. 에이전트 파일은 문서 위치를 정하지 않아서 요청대로 `docs/design/`에 둔다.

## 0. 한눈에

```
[brain 세션] node scripts/brain-publish.mjs --brain D:/workspace/brain [--apply]
   │
   ├─ 0. 환경   .env.local(URL) + .env.brain.local(비밀값) 키 확인 → 없으면 즉시 exit 2
   ├─ 1. 읽기   brain/blog/*.md (최상위만) + DB 현재 상태(service role, select)
   ├─ 2. 검사   필수 필드 · 링크/스킴/주석 규칙 · 이미지 · slug 충돌 → 위반 1건이라도 있으면 전체 중단(exit 1)
   ├─ 3. 쓰기   이미지 업로드 → posts upsert(바뀐 것만) → post_tags → post_sources → post_links   (--apply일 때만)
   ├─ 4. 재검증 POST {SITE_URL}/api/revalidate  (Bearer REVALIDATE_SECRET)
   └─ 5. 보고   파일별 결과 + 막힌 이유(파일:줄) + 쓰기 건수 + RAG 재색인 대상 N
```

기본은 dry-run이다. `--apply`가 있어야 DB와 Storage에 쓴다. git push, 재빌드와 상관없다. blog index는 테이블이 아니라 뷰라서 따로 쓰지 않는다(§2.2).

## 1. 렌더링 전략

새 페이지는 없다. 기존 전략을 그대로 쓰고, 발행 때 on-demand 재검증만 더한다.

| 경로 | 현재 | 발행 후 처리 |
|---|---|---|
| `/` | ISR `revalidate=3600` | `revalidatePath('/', 'layout')` |
| `/posts/[slug]` | ISR `revalidate=86400`, `dynamicParams=true` | 같음. 새 slug는 첫 요청에 생성 |
| `/category/[slug]` | ISR 3600 | 같음 |
| `/tags/[slug]` | ISR 86400, **`dynamicParams=false`** | `dynamicParams = true`로 바꾼다(ISR 86400 유지). 지금은 발행으로 생긴 새 태그 페이지가 재빌드 전까지 404 (C2) |
| `/api/posts`, `/api/tags`, `/api/tags/graph` | `s-maxage=86400` 엣지 캐시 | `revalidatePath`로 각각 무효화 (`src/lib/cache-tags.ts`의 `revalidateCategories()`와 같은 방식) |

스크립트는 Next 프로세스 밖에서 돌아 `revalidatePath`를 직접 부를 수 없다. 그래서 비밀값으로 보호한 재검증 엔드포인트를 하나 둔다(§3.1).

후속 과제(② 범위 밖, C3): 위 페이지들은 `isAdmin()` → `cookies()`를 불러서 실제로는 동적으로 렌더링된다. admin 판정을 클라이언트 쪽으로 옮기면 ISR이 제대로 먹는다. ②에서는 건드리지 않는다. 재검증 호출 하나가 동적·ISR 두 경우 모두를 처리한다.

## 2. 데이터 모델

### 2.1 frontmatter → posts 매핑

발행 대상은 `brain/blog/*.md` 최상위 파일 중 `publish: true`인 것. `blog/drafts/`, `blog/material/`, `voice.md`는 읽지 않는다. 스크립트는 아래 키만 읽는다. 나머지(vault용 `tags`, `status`, `source`, `aliases` 등)는 읽지도 보내지도 않는다.

```yaml
---
title: 개발팀에 묻지 않고 답할 수 있을까     # 필수 → posts.title (공개 제목)
slug: sr-agent-motivation                   # 필수 → posts.slug. isValidSlug 통과. 한번 발행하면 변경 금지
date: 2026-09-03                            # 필수, KST 날짜 → posts.created_at
publish: true                               # 필수 → posts.published
review: done                                # publish:true인데 pending이면 막음
category: dev/projects/muse-log             # 선택, slug 경로 1~3단계 → posts.category_id
public_tags: [SR자동화, ERP]                 # 선택 → tags / post_tags (공개 태그)
tags: [sr-agent, 블로그]                     # vault 분류. 절대 발행하지 않음
series: SR 자동화                            # 선택 → 태그 "series:SR 자동화"
part: 1                                     # series가 있으면 필수
excerpt: 한두 문장 요약                       # 선택 → posts.excerpt (없으면 null)
related:                                    # 선택. 공개 글만 → post_links
  - "[[260910-musing-sr-agent-design]]"
source:                                     # 선택. 비공개 근거. 스크립트가 읽지 않음
  - "[[blog/material/musing/sr-agent-motivation#2026-09-03 ...]]"
---
(본문: 닫는 '---\n' 다음 바이트부터 끝까지 그대로)
```

| 키 | 컬럼 | 규칙 |
|---|---|---|
| `title` | `posts.title` | 항상 brain 소유 |
| `slug` | `posts.slug` | 기존 행과 다르면 막음(URL 보호, admin PATCH의 slug 변경 금지와 같은 규칙) |
| `date` | `posts.created_at` | 삽입 시 `date 00:00 KST + (part-1)초`. 수정 시 DB 값의 KST 날짜가 `date`와 다를 때만 바꿈(이관 글의 원래 시각 보존). 시리즈 순서는 지금처럼 `created_at` 순 |
| `publish` | `posts.published` | 공개 여부는 brain만 정한다. `true`면 공개. `false`나 키 없음이면, 이미 brain 출신 행이 있을 때 `published=false`만 바꾸고 제목·본문 등 다른 내용은 올리지 않는다 |
| `category` | `posts.category_id` | slug 경로를 `categories`에서 부모 체인까지 맞춰 찾음. 없으면 막음(자동 생성 안 함). 키가 없으면 DB 값 유지 |
| `public_tags` + `series` | `post_tags` | 둘 중 하나라도 있으면 태그 집합 = `public_tags ∪ {"series:"+series}`로 맞춤(차집합만 insert/delete해서 `tag_relations` 트리거 변동 최소화). 없는 태그는 이름으로 생성(slug는 `generateSlug` 규칙, 색은 기본값). 둘 다 없으면 DB 값 유지 |
| `excerpt` | `posts.excerpt` | 항상 brain 소유 |
| `related` | `post_links` | §2.3 |

**소유 규칙**: 내용 필드(title, slug, content, excerpt, created_at, published)는 brain 소유다. 표시 필드(category, tags)는 frontmatter에 키가 있으면 brain이 이기고, 없으면 admin 값을 유지한다.

**변경 감지**: `--apply`는 쓸 값(본문 재작성·이미지 URL 치환 후)과 DB의 brain 소유 컬럼, 그리고 키가 있는 표시 필드를 직접 비교한다. 해시는 저장하지 않는다. 다른 경로로 생긴 차이도 다음 실행에서 되돌아온다.

**초안 템플릿 가드**: `publish: true`인데 본문에 초안 절 제목(`## 제목`, `## Excerpt`, `## 태그`, `# 본문`)이 있으면 막는다.

### 2.2 마이그레이션 `supabase/migrations/006_brain_publish.sql`

```sql
-- 1) 글 출처 표시 (공개돼도 무방한 값만 posts에 둔다)
ALTER TABLE posts
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'admin'
  CHECK (origin IN ('admin', 'brain'));

-- 2) brain 파일 매핑 (파일명에 비공개 분류가 들어갈 수 있어 posts와 분리, 공개 읽기 없음)
CREATE TABLE post_sources (
  post_id     UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL UNIQUE,      -- 'blog/260903-musing-sr-agent-motivation.md'
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3) 글-글 링크 (방향 있음: source 글이 target 글을 가리킴)
CREATE TABLE post_links (
  source_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  target_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_post_id, target_post_id),
  CHECK (source_post_id <> target_post_id)
);
CREATE INDEX idx_post_links_target ON post_links(target_post_id);

ALTER TABLE post_sources ENABLE ROW LEVEL SECURITY;   -- 정책 없음
ALTER TABLE post_links   ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_links_select_public ON post_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM posts s WHERE s.id = post_links.source_post_id AND s.published)
  AND EXISTS (SELECT 1 FROM posts t WHERE t.id = post_links.target_post_id AND t.published)
);

-- 4) 블로그 index: 테이블 대신 security_invoker 뷰. 읽는 사람의 RLS를 따르고, 공개 글만 낸다
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

-- 5) 권한: 새 객체는 모두 회수한 뒤 필요한 것만 준다 (default privileges가 anon/authenticated에 ALL을 줌)
REVOKE ALL ON post_sources, post_links, blog_index FROM anon, authenticated;
GRANT SELECT ON post_links, blog_index TO anon, authenticated;
GRANT ALL ON post_sources, post_links TO service_role;
GRANT SELECT ON blog_index TO service_role;

-- 6) brain 출신 행 보호 트리거 (service role 외 경로에서의 변경을 DB가 막음)
CREATE OR REPLACE FUNCTION guard_brain_posts() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- auth.role()이 NULL(SQL 에디터, 마이그레이션 = postgres)이거나 service_role이면 통과
  IF auth.role() IS NULL OR auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
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
  BEFORE UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION guard_brain_posts();
```

- 트리거는 위에 적은 컬럼만 본다. 그래서 `increment_view_count`(view_count)와 `update_updated_at`(updated_at)은 영향을 받지 않는다. admin의 category_id 변경도 통과한다.
- `blog_index`는 security_invoker라 `posts`·`categories` RLS가 그대로 적용되고, `WHERE published`로 admin이 읽어도 공개 글만 나온다. ④의 채팅은 이 행들을 읽어 index 마크다운을 그때 조립한다. 발행 스크립트는 index를 쓰지 않는다.
- 인덱스: 행 수가 수십 개 규모라 `post_links.target_post_id` 하나면 된다(③ 그래프의 역방향 조회용).

### 2.3 링크·내용 검사와 "비공개" 판정

**공개 집합 P**: 이번 실행이 끝났을 때 공개 상태일 글이다. 검사를 통과한 `publish: true` brain 파일과, DB에서 `origin='admin'`이고 `published=true`인 글을 합친 것이다. 검사는 이 최종 상태를 기준으로 한다. 그래서 A가 링크한 B를 `publish: false`로 내리면 A가 막힌다.

**검사 대상 필드**: 본문, `title`, `excerpt`, `public_tags`, `series`. `related:`는 따로 본다. 모두 아래 규칙을 같이 적용한다.

**URL 스킴: 기본은 거부.** 허용하는 것만 통과시킨다.

| 형태 | 판정 |
|---|---|
| `http://`, `https://` (외부) | 통과 |
| `mailto:` | 통과 |
| `#anchor` | 통과 |
| 루트 상대 `/...` | `/posts/{slug}`면 slug가 P에 있어야 통과, 아니면 **막음**. 다른 루트 경로(`/category/…`, `/tags/…`)는 통과 |
| `{SITE_URL}/...` | 루트 상대와 같음 |
| `file:`, `obsidian:`, `data:`, `javascript:` 등 위에 없는 스킴 | **막음** |
| 상대 경로(`x.md`, `../a`, `img/b.png`) | **막음**. 이미지 embed만 예외(§2.4) |

**vault 링크**

| 형태 | 판정 |
|---|---|
| `[[name]]`, `[[name\|label]]`, `[[name#h]]` | vault 전체에서 파일명 `name.md`(경로가 있으면 그 경로)로 찾는다. `.obsidian`, `.git`, `.omc`는 제외. 대상이 P에 속한 brain 글이면 통과하고, DB 사본에서 `[label](/posts/{slug})`로 바꾼다(label이 없으면 대상 title). 그 밖의 노트이거나 못 찾으면 **막음** |
| `![[x.png]]` 등 이미지 embed | §2.4 |
| `![[note]]`, `![[x.pdf]]` 등 이미지가 아닌 embed | **막음** |
| `related:` 각 항목 | wikilink로 해석. P에 속한 brain 글이면 링크, 아니면 **막음** |
| `source:` | 읽지 않음. DB로 가지 않음 |

**주석**: `%%…%%`(Obsidian 주석)와 `<!-- … -->`가 있으면 **막는다**. 렌더링 때 숨겨져도 DB 본문과 공개 API에는 그대로 남기 때문이다.

**코드 블록·인라인 코드 안 링크**: 바꾸지 않는다. 다만 그 링크(`[[x]]`나 `[t](x.md)`)가 vault에 실제로 있는 노트이고 그 노트가 P에 없으면 **막는다**. 노트 이름이 노출되기 때문이다. vault에 없는 이름(예시 코드)이면 통과다.

**raw HTML**: `<a href>`, `<img src>`의 값에도 위 규칙을 똑같이 적용한다.

**그 밖에 막는 조건**: 필수 키 누락, `review: pending`, slug 형식 오류, slug가 admin 출신 글과 겹침, 두 파일이 같은 slug, 발행된 글의 slug 변경, 없는 category 경로, `series`인데 `part` 없음, 초안 템플릿 제목 줄.

**막힘 처리**: 링크를 지우거나 고치지 않는다. 위반이 한 건이라도 있으면 어떤 쓰기도 하지 않는다. `파일:줄  사유  원문` 목록을 찍고 exit 1로 끝낸다.

**`publish: false` 파일**: 검사하지 않는다. 내용과 이미지를 올리지 않는다. 이미 brain 출신 행이 있으면 `published=false`만 쓴다.

**post_links 생성**: P에 속한 brain 글마다 대상 집합(본문 링크 ∪ related)을 만든다. 쓰기는 brain 출신 글을 source로 하는 행을 지우고 다시 넣는 방식이다. admin 출신 글에서는 링크를 뽑지 않는다(이관 후에는 모든 글이 brain 출신이 된다).

### 2.4 이미지 자동 업로드

검사를 통과한 `publish: true` 글 안의 이미지 embed만 다룬다.

1. **해석**: `![[x.png]]`(`![[x.png|300]]`의 크기 표시는 무시)는 vault에서 파일명으로 찾는다. `![alt](rel/path.png)`는 글이 있는 폴더 기준으로 먼저 찾고, 없으면 vault 루트 기준으로 찾는다. 못 찾으면 **막음**.
2. **형식 제한**: 확장자가 png, jpg, jpeg, gif, webp 중 하나여야 한다. 파일 앞부분(magic bytes)도 같은 형식이어야 한다. 크기는 5MB 이하. svg를 포함해 그 밖의 형식은 **막음**.
3. **업로드**(`--apply`, 검사 전체 통과 후 posts 쓰기 전): `blog-images` 버킷의 `brain/{sha256}.{ext}`에 `upsert: false`로 올린다. 이미 있으면(중복 응답) 건너뛴다. 내용 주소라 다시 실행해도 결과가 같다.
4. **media 행**: `src/app/api/media/route.ts`처럼 `filename`(원래 파일명), `url`, `size`, `mime_type`, `alt_text`를 넣는다. 같은 `url` 행이 이미 있으면 넣지 않는다.
5. **치환**: DB 사본만 `![alt](public URL)`로 바꾼다. alt는 원래 alt가 있으면 그것, 없으면 확장자를 뺀 파일명. brain 파일은 손대지 않는다.
6. EXIF는 지우지 않는다. 사진은 주인이 확인한다.
7. dry-run은 올릴 이미지 목록을 보여 준다(vault 경로, 크기, 대상 키, 새로 올림/이미 있음).

위험(기록만): 기존 `DELETE`/`PATCH /api/posts`는 본문이 참조하는 Storage 이미지를 지운다. admin 글이 `brain/…` 이미지 URL을 복사해 쓰고 그 글을 지우면 공유 이미지가 사라진다. brain 글 쪽 DELETE와 본문 PATCH는 막혀 있어 brain 글끼리는 문제가 없다.

## 3. API 명세

### 3.1 `POST /api/revalidate` (신규)

```typescript
// Request
// Method: POST만 (다른 메서드는 405)
// Header: Authorization: Bearer <REVALIDATE_SECRET>   (쿼리·본문의 비밀값은 받지 않음)
// Body: 없음

// Response 200
interface RevalidateResponse { ok: true; paths: string[] }
// 401 { ok: false } — 서버 비밀값이 없거나 32바이트 미만, 또는 불일치
```

- 비교: 받은 값과 서버 값을 각각 sha256 한 뒤 `crypto.timingSafeEqual`로 비교한다(길이 차이로 새는 정보 없음).
- 처리: `revalidatePath('/', 'layout')`, `revalidatePath('/api/posts')`, `revalidatePath('/api/tags')`, `revalidatePath('/api/tags/graph')`. `export const dynamic = 'force-dynamic'`. 멱등이다.
- 응답에는 `{ok, paths}`만 담는다. 에러 상세나 환경 정보는 넣지 않는다. 비밀값은 `CRON_SECRET`과 따로 둔다.
- 스크립트 쪽: `SITE_URL`은 `https://`여야 한다(`http://localhost`만 예외). `fetch(..., { redirect: 'error' })`로 부르고, 요청 헤더는 절대 로그에 남기지 않는다.

### 3.2 `/api/posts` 수정

- **POST**: `origin`은 서버에서 `'admin'`으로 정한다. body의 `origin`은 무시한다.
- **PATCH**:
  - 모든 행에서 updates의 `origin` 키를 버린다.
  - 대상이 `origin='brain'`이면 body에 `id`, `category_id`, `tag_ids` 말고 다른 키가 하나라도 있을 때 `409 { error: 'brain에서 관리하는 글입니다' }`.
  - DB 트리거(§2.2)가 같은 규칙을 한 번 더 지킨다.
- **DELETE**:
  - `?id=`와 `?slug=` 두 경로 모두(admin 목록은 `src/app/admin/posts/page.tsx:180`에서 `?slug=`로 부름) 이미 하고 있는 사전 조회에 `origin`을 함께 가져온다. `origin='brain'`이면 409. 지워도 다음 발행에서 새 id로 다시 생기고 조회수가 초기화되기 때문이다. 내리려면 brain에서 `publish: false`로 한다.
  - 트리거도 DELETE를 막는다.
- **GET**: admin 분기(전체 글 조회)는 `Cache-Control: private, no-store`로 응답한다. 지금은 admin 응답에도 `public, s-maxage=86400`이 붙어 비공개 글 목록이 엣지에 캐시될 수 있다. 공개 분기는 그대로 둔다.

## 4. 데이터 플로우

```
brain/blog/*.md ──┐
                  ├─> brain-core.plan()  ──(위반)──> 보고 + exit 1, 쓰기 0
DB select ────────┘         │(통과, --apply)
 (posts, post_sources,      v
  categories, tags,   이미지 업로드 + media → posts upsert(달라진 것만) → post_tags 차집합
  media)                    → post_sources → post_links 재작성 → POST /api/revalidate → 보고

④ 채팅 ──> blog_index 뷰(공개 글만) ──> index 마크다운 조립
```

쓰기는 트랜잭션이 아니다. 중간에 실패하면 다시 실행해서 수렴시킨다. 모든 단계가 멱등이다.

**파일이 사라졌을 때**: `post_sources`에는 있는데 디스크에 없는 경로를 찾는다. 같은 slug를 다른 파일이 갖고 있으면 이름이 바뀐 것으로 보고 `source_path`만 갱신한다. 그렇지 않으면 `published=false`로 내리고 보고한다. 행은 지우지 않는다(조회수 보존).

**보고**: 파일별 상태(insert / update / unchanged / unpublish / orphan-unpublish / blocked), 쓰기 건수, 업로드한 이미지 수, 재검증 결과를 찍는다. RAG 재색인 안내는 대상 N(새로 공개됐거나 title·content·excerpt가 바뀐 글)이 1 이상일 때만 찍는다(§9).

## 5. 캐시 전략

- L1 (Browser): 변경 없음. 업로드 이미지는 내용 주소 경로라 오래 캐시해도 안전하다.
- L2 (Edge): ISR 페이지와 `s-maxage=86400` API는 발행 때 `/api/revalidate`로 무효화한다. 재검증 호출이 실패해도 데이터는 이미 들어가 있고, 최대 24시간 뒤에는 반영된다. 이 경우 보고에 경고와 재시도 명령(`--revalidate-only`)을 찍는다. admin GET `/api/posts`는 `private, no-store`.
- L3 (App): 없음. `blog_index` 뷰를 읽을 때의 캐시는 ④ 설계에서 정한다(발행 때만 바뀌므로 발행 재검증으로 무효화하면 된다).

## 6. 파일 구조

```
supabase/migrations/006_brain_publish.sql
scripts/
├── brain-publish.mjs          # CLI: --brain <dir> [--apply] [--revalidate-only]
├── brain-export.mjs           # CLI: --brain <dir> [--apply]   (1회용)
└── lib/
    ├── brain-core.mjs         # 순수 함수: frontmatter 파싱/직렬화, 링크·스킴·주석 스캔, 이미지 해석, plan()
    ├── brain-core.test.mjs    # node --test
    └── brain-env.mjs          # .env.local + .env.brain.local 읽기, service role 클라이언트
src/app/api/revalidate/route.ts           # 신규
src/app/api/posts/route.ts                # POST origin 고정, PATCH 허용 목록, DELETE 가드, admin GET no-store
src/app/admin/posts/[slug]/edit/EditPostForm.tsx   # 본문 잠금
src/app/tags/[slug]/page.tsx              # dynamicParams = true
src/types/database.ts                     # Post.origin
.env.local.example                        # .env.brain.local 안내 주석
package.json                              # devDependency: yaml (MIT)
```

- 스크립트는 DB 스키마를 아는 muse.log 저장소에 둔다. brain 세션에서 `node D:/workspace/muse.log/scripts/brain-publish.mjs --brain D:/workspace/brain`으로 부른다. 환경 파일은 스크립트 위치 기준 경로로 읽으므로 어느 cwd에서 불러도 된다.
- frontmatter 파싱에는 `yaml` 패키지를 쓴다. 따옴표 wikilink가 든 블록 목록은 손으로 짠 파서가 틀리기 쉽다. 빌드에는 들어가지 않는다.
- `plan(files, dbState)`은 순수 함수로 두어 DB 없이 테스트한다.

### 6.1 비밀값

| 변수 | 파일 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (이미 있음) | 스크립트가 키 이름으로만 읽음 |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.brain.local` | 스크립트의 읽기·쓰기. Vercel에는 넣지 않음 |
| `SITE_URL` | `.env.brain.local` | 재검증 호출, 절대 URL 링크 판정. https(localhost 예외) |
| `REVALIDATE_SECRET` | `.env.brain.local` + Vercel(Production) | 재검증 엔드포인트. 32바이트 이상 |

- `.env.brain.local`은 `.gitignore`의 `.env*.local`로 커밋에서 빠진다. Next는 `.env`, `.env.local`, `.env.{mode}[.local]`만 읽으므로 앱에는 실리지 않는다. 이 파일은 스크립트만 읽는다.
- `scripts/lib/brain-env.mjs`의 동작:
  - 두 파일을 직접 파싱한다. 키 이름만 확인하고, 값은 로그·보고·에러 메시지 어디에도 찍지 않는다.
  - `brain-publish`(dry-run 포함. dry-run도 비공개 행과 `post_sources`를 읽어야 함)와 `brain-export`는 시작하자마자 필요한 키를 검사한다. 없으면 vault나 DB에 손대기 전에 멈춘다. 이때 exit 2와 함께 다음 메시지를 낸다: `SUPABASE_SERVICE_ROLE_KEY가 D:\workspace\muse.log\.env.brain.local에 없습니다. Supabase 대시보드 → Project Settings → API Keys의 service_role(secret) 키를 추가하세요.` 다른 키도 같은 형식으로 알린다.
  - `--revalidate-only`는 `SITE_URL`, `REVALIDATE_SECRET`만 요구한다.
  - publishable key로 넘어가지 않는다. `evaluate-rag.mjs`처럼 넘어가면 RLS에 막혀 조용히 실패한다.
- 주인이 할 일:
  - `D:\workspace\muse.log\.env.brain.local`을 만들고 service_role 키를 직접 붙여 넣는다.
  - `REVALIDATE_SECRET`은 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`로 만든다. 이 파일과 Vercel 두 곳에 넣는다.
  - 키는 명령줄 인자로 넘기지 않는다. Claude 세션은 이 파일을 열어 보지 않는다.

## 7. 이관: 기존 글 export

`scripts/brain-export.mjs --brain D:/workspace/brain [--apply]`

1. service role로 12편 전부(비공개 2편 포함)를 category, tags와 함께 읽는다.
2. 파일 경로는 `blog/{YYMMDD}-muselog-{slug}.md`(YYMMDD는 created_at의 KST 날짜). 같은 파일이 이미 있으면 덮지 않고 멈춘다.
3. 파일 내용은 `---\n` + frontmatter + `---\n` + `posts.content` 그대로다. 앞뒤 공백 정리, 줄바꿈 변환, 끝 개행 추가를 하지 않고 바이트 그대로 쓴다.
   - frontmatter 키: `title`, `slug`, `date`, `publish`(= published), `category`(경로), `public_tags`(series: 제외), `series`/`part`(series 태그가 있으면, created_at 순), `excerpt`. 공개 글은 `review: done`도 넣는다.
   - `related`는 넣지 않는다. 나중에 제안 → 승인 → `related:` 순서로 채운다.
4. 검증: 쓴 파일을 다시 읽어 `brain-core`의 같은 파서로 본문을 뽑고, DB `content`와 바이트 단위로 비교한다. 12편 모두 차이가 0이어야 다음 단계로 간다. 하나라도 다르면 해당 글의 첫 차이 위치를 찍고 exit 1.
5. 차이가 0이면 `posts.origin='brain'`과 `post_sources.source_path`를 기록한다(service role이라 트리거를 통과한다). 이때부터 admin 본문 잠금이 걸린다.
6. 이어서 `brain-publish.mjs` dry-run을 돌려 이관 글이 검사를 통과하는지 본다. 막히는 글이 있어도 본문은 고치지 않고 보고만 한다(주인이 판단).

dry-run(기본)은 만들 파일 목록과 frontmatter만 보여 준다. 이관 글의 본문에는 vault 링크나 상대 이미지가 없어서 첫 발행에서 DB 값과 같게 나온다. 그래서 `posts` 행이 다시 쓰이지 않는다.

위험: brain 저장소를 다른 PC에서 `core.autocrlf=true`로 받으면 본문이 CRLF로 바뀐다. 그 상태로 발행하면 본문이 바뀐 것으로 잡힌다. 이 PC에서의 검증에는 영향이 없다.

## 8. admin 본문 잠금

- `EditPostForm`: `post.origin === 'brain'`이면 제목·excerpt 입력과 공개 체크박스를 `disabled`로 두고, 본문 에디터는 미리보기 전용으로 둔다. 위에 "brain에서 관리하는 글입니다. 본문과 공개 여부는 brain에서 고치세요." 한 줄을 띄운다. 저장할 때는 `id`, `category_id`, `tag_ids`만 보낸다.
- 막는 곳은 세 겹이다. UI, API 허용 목록(§3.2), DB 트리거(§2.2).
- 편집 페이지는 이미 `select('*')`라 `origin`이 따라온다. 목록·대시보드는 바꾸지 않는다.
- 이 PATCH는 content/title을 보내지 않으므로 재임베딩도 일어나지 않는다.

## 9. ④ 전까지 RAG와의 관계

- 지금 색인은 `/api/posts`의 POST/PATCH와 `/api/embeddings/bulk`에서만 일어난다. 스크립트는 DB에 바로 쓰므로 이 훅을 지나지 않는다.
- 그 결과:
  - 새 글은 청크가 없어 채팅이 찾지 못한다.
  - 바뀐 글은 옛 본문으로 답한다.
  - 내린 글의 청크는 남지만 `search_chunks`가 `published=true`로 거르므로 새지 않는다.
- 최소 처리: 스크립트에 임베딩 코드를 넣지 않는다. 넣으려면 `src/lib/rag`를 .mjs로 중복시키고 OpenAI 키를 로컬에 둬야 하는데, ④에서 버릴 코드다. 대신 재색인 대상 N(새로 공개됐거나 title·content·excerpt가 바뀐 글)이 1 이상일 때만 보고 끝에 "RAG 재색인 필요: N편 → /admin/rag에서 일괄 재생성"을 찍는다. N이 0이면 아무것도 찍지 않는다. 주인이 admin에서 버튼 하나를 누르면 기존 `/api/embeddings/bulk`가 공개 글 전체를 다시 만든다. 글이 12~20편이면 비용은 1센트 미만이다.
- 이관은 본문을 바꾸지 않으므로 N=0이다.

## 10. 비용 분석

- Supabase:
  - 발행 1회에 select 6회 안팎, 바뀐 글 수만큼 쓰기, links 몇 회가 든다. 보고에 쓰기 건수를 찍는다.
  - 월 수십 회 발행해도 무료 한도와 거리가 멀다.
  - Storage는 이미지당 최대 5MB이고 내용 주소라 중복이 없다. 1GB 한도의 50%는 대략 이미지 수백 장에 해당하므로 주인이 대시보드로 확인한다.
  - `blog_index`는 뷰라 저장 공간을 쓰지 않는다.
- Vercel: 재검증 호출 1회와, 그 뒤 첫 요청에서의 페이지 재생성 정도다. 무시할 수준이다.
- OpenAI: 스크립트는 0이다. N>0일 때 수동으로 일괄 재색인하면 1센트 미만이다.
- 새 인프라나 유료 의존성은 없다. 새 의존성은 `yaml`(MIT, dev) 하나다.

## 11. 테스트 계획

저장소에 테스트 러너가 없어서 스크립트 쪽은 `node --test`(내장)로 하고 의존성을 늘리지 않는다. Next 쪽 변경과 RLS는 수동으로 확인한다.

| 통과 기준 / 대상 | 테스트 | 방법 |
|---|---|---|
| **② 기준 1: 비공개 링크가 든 시험 글은 발행이 막힘** | 픽스처 vault에서 `publish: true` 글의 본문이 `[[일하는 방식과 판단 원칙]]`(blog 밖 노트)을 링크 → `plan()`이 blocked를 내고, 사유에 파일:줄이 들어 있음 | 단위 |
| 〃 | 같은 픽스처로 `brain-publish.mjs --apply` 실행 → exit 1. 실행 전후 posts/post_links/media 행 수, `updated_at`, Storage 객체 수가 같음 | 실DB 1회 수동 |
| 〃 | 다음 각각이 막힘: `related:`의 비공개 노트, `[[없는파일]]`, `![[note]]`, `![[x.pdf]]`, `![[x.svg]]`, 5MB 초과 이미지, 확장자와 magic bytes가 다른 이미지, `/posts/없는slug`, `publish: false` 글로의 링크, `file:`/`obsidian:`/상대 `.md` 링크, `%%주석%%`, `<!-- -->`, excerpt·title·public_tags·series 안의 비공개 wikilink | 단위 |
| 〃 | 코드 블록 안 `[[실제 비공개 노트]]` → 막힘. 코드 블록 안 `[[없는이름]]` → 통과 | 단위 |
| 〃 | B를 `publish: false`로 내리면 B를 링크한 공개 글 A가 막힘 | 단위 |
| 〃 | 외부 URL, `mailto:`, `#a`, `/tags/x`, `source:`의 비공개 링크, vault `tags:` → 통과하고 vault `tags:`는 DB로 가지 않음 | 단위 |
| **② 기준 2: 이관 후 DB 본문과 마크다운 차이 0** | 직렬화 → 파싱 왕복이 바이트 단위로 같음: 빈 본문, 앞 개행, 끝 개행 없음, CRLF, 본문 안 `---`, 한글 NFD | 단위 |
| 〃 | `brain-export.mjs --apply` 후 검증 단계가 12/12 차이 0을 보고 | 실DB 1회 |
| 이미지 | `![[a.png]]`, `![x](img/a.png)` → `brain/{sha256}.png` 업로드, DB 사본에만 URL 치환, brain 파일은 그대로, media 1행. 두 번째 실행에서는 업로드 0, media 추가 0. dry-run은 목록만 보여 줌 | 단위 + 실DB |
| publish:false | 이미 있는 brain 행이 `published=false`로만 바뀌고, 본문 변경이나 이미지 업로드는 일어나지 않음 | 단위 |
| 멱등 | 같은 vault로 `--apply`를 두 번째 실행하면 모든 글이 "unchanged", 쓰기 0, RAG 안내 없음 | 단위(plan) + 실DB |
| slug 보호 | 발행된 글의 slug 변경, 두 파일이 같은 slug, admin 글과 slug 충돌 → 막힘. 파일 이름만 바뀌면 source_path만 갱신 | 단위 |
| 파일 삭제 | 파일을 지우면 해당 글이 `published=false`가 되고 행은 남음 | 단위 |
| 환경 | `.env.brain.local`이 없거나 키가 빠지면 exit 2와 안내 메시지. 출력에 값이 없음 | 단위 |
| RLS·권한 | anon: `post_sources` select 거부, `post_links` insert 거부, `posts`/`post_links` truncate 거부. 공개 글을 내린 뒤 anon으로 `blog_index`를 select하면 그 글이 빠짐. 비공개 글이 낀 링크는 보이지 않음 | SQL 수동 |
| 트리거 | admin JWT로 brain 행의 content/published/origin을 update하거나 delete → 예외. category_id update → 성공. admin 행 origin 변경 → 예외. 공개 글 조회수 증가 → 성공 | SQL 수동 |
| API | PATCH: brain 글에 content나 published를 보내면 409, `origin`은 모든 행에서 무시. DELETE `?slug=`·`?id=`로 brain 글 → 409. POST body의 `origin:'brain'`은 무시. admin GET 응답 헤더 `private, no-store` | 수동 |
| 재검증 | 비밀값 없음/틀림/서버 값이 32바이트 미만 → 401, GET → 405, 맞으면 200 `{ok, paths}`. 발행 후 글 페이지에 새 본문이 바로 보임. 새 태그 페이지가 404가 아님(C2) | 수동 |
| admin 잠금 | brain 출신 글 편집 화면에서 본문·제목·excerpt·공개가 잠기고, 카테고리·태그는 저장됨 | 수동 |

## 12. 주인 결정 (해결됨, 2026-10-29)

1. **공개 여부**: brain의 `publish:`만 정한다. brain 출신 글은 admin 공개 토글을 잠근다. → §2.1, §3.2, §8, 트리거 §2.2
2. **공개 태그**: 별도 키 `public_tags:`를 쓴다. vault `tags:`는 발행하지 않는다. `public_tags`도 같은 검사를 받는다. → §2.1, §2.3
3. **index**: 카테고리 경로 + excerpt. 테이블 대신 `blog_index` 뷰(R5). → §2.2
4. **이미지**: 발행 스크립트가 자동으로 올린다. png/jpg/jpeg/gif/webp, 5MB 이하, svg 불가, `blog-images/brain/{sha256}.{ext}`, DB 사본만 치환, media 행. EXIF는 지우지 않는다. → §2.4
5. **이관 파일 이름**은 `blog/YYMMDD-muselog-{slug}.md`. 파일을 지우면 비공개로 내리고 행은 남긴다. → §7, §4
6. **비밀값**: service key, `SITE_URL`, `REVALIDATE_SECRET`은 `.env.brain.local`에 둔다. `REVALIDATE_SECRET`은 Vercel에도 넣는다. → §6.1

## 13. 후속 과제 (② 범위 밖)

- **brain 저장소**: blog-writer 초안 템플릿을 바꾼다. 공개 제목·excerpt·태그는 frontmatter(`title`, `excerpt`, `public_tags`)로, 비공개 근거는 `related:`가 아닌 `source:`로 옮긴다. 지금 두 초안은 `related:`에 비공개 노트가 있어 그대로는 막힌다.
- **muse.log (C3)**: `isAdmin()`의 `cookies()` 호출 때문에 ISR 페이지가 동적으로 렌더링된다. admin 판정을 클라이언트 쪽으로 옮긴다.

## 14. 검토 반영

| 항목 | 내용 | 반영 위치 |
|---|---|---|
| R1 | PATCH 허용 목록(brain 행은 id·category_id·tag_ids만), 모든 행에서 origin 제거, POST는 서버가 origin 지정 | §3.2, §8 |
| R2 | DELETE `?slug=` 경로도 같은 조회로 막음 | §3.2 |
| R3 | service role이 아닐 때 brain 행 보호와 origin 불변을 지키는 BEFORE UPDATE OR DELETE 트리거 | §2.2 (6) |
| R4 | 새 객체 REVOKE ALL 후 필요한 SELECT만 GRANT, service_role에 명시적으로 GRANT | §2.2 (5) |
| R5 | `blog_index`를 security_invoker 뷰로 | §2.2 (4), §4 |
| R6a | URL 스킴 기본 거부, 상대 경로 막음(이미지 embed 예외) | §2.3 |
| R6b | title·excerpt·public_tags·series도 검사 | §2.3 |
| R6c | `%%…%%`, `<!-- -->` 막음 | §2.3 |
| R6d | 코드 안 링크가 P에 없는 실제 노트면 막음 | §2.3 |
| R6e | publish:false는 `published=false`만 씀 | §2.1, §2.3 |
| R6f | `public_tags` 분리(결정 2) | §2.1 |
| R7 | 재검증: sha256 + timingSafeEqual, 32바이트 미만 401, 헤더만, POST만, `{ok, paths}`만. 스크립트는 https, `redirect:'error'`, 헤더 로그 금지 | §3.1 |
| R8 | admin GET `/api/posts`는 `private, no-store` | §3.2, §5 |
| R-선택 | `--apply`에서 해시 대신 컬럼 직접 비교 / RLS·트리거 테스트 | §2.1 변경 감지 / §11 |
| C1 | RAG 안내는 N>0일 때만, 보고에 쓰기 건수와 N | §4, §9 |
| C2 | `/tags/[slug]` `dynamicParams = true` (ISR 86400 유지) | §1, §6 |
| C3 | `isAdmin()` cookies() 문제는 후속 과제로 | §1, §13 |

## 헌법 체크리스트

- [x] 정적 생성 가능 여부 검토: 새 페이지 없음, 기존 ISR 유지 + on-demand 재검증, 태그 페이지 dynamicParams
- [x] 모든 데이터 플로우에 캐시 전략: §5
- [x] 비용 영향 분석: §10
- [x] 무료 플랜 제약: 새 인프라 없음, 로컬 스크립트 + 기존 Supabase/Vercel

## 다음 단계

1. 적용 순서:
   1. 006 마이그레이션(SQL 에디터)
   2. 앱 배포(재검증 엔드포인트, `/api/posts` 가드, admin 잠금, 태그 페이지, Vercel `REVALIDATE_SECRET`)
   3. `.env.brain.local` 작성
   4. export `--apply`
   5. publish dry-run
   6. publish `--apply`
2. 구현 전 code-quality, 구현 후 test agent(§11)
