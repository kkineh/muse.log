# 발행·이관 (로드맵 ②) 구현 품질 기준

- 작성: 2026-10-29, code-quality (구현 전 가이드)
- 대상 설계: `docs/design/brain-publish.md`
- 근거로 읽은 것: `eslint.config.mjs`, `tsconfig.json`, `.prettierrc.json`, `package.json`, `src/app/api/posts/route.ts`, `src/app/api/media/route.ts`, `src/app/api/cron/keep-alive/route.ts`, `src/app/admin/posts/*`, `src/app/tags/[slug]/page.tsx`, `src/lib/slug.ts`, `src/lib/cache-tags.ts`, `scripts/evaluate-rag.mjs`, `supabase/migrations/005_post_chunks.sql`

설계는 바꾸지 않는다. 아래는 구현자가 지킬 규칙, 설계 대비 과하다고 보는 지점(표시만), 그리고 설계에 빠진 보완점이다.

## 0. 현재 저장소 상태 (먼저 알아 둘 것)

- 이 작업 트리에는 `node_modules`가 없다. 구현 시작 전에 `npm install`부터 한다. 그래서 lint·tsc 기준선(현재 에러 수)은 이번에 재지 못했다. 구현자가 **변경 전에 한 번** 돌려서 기존 에러 수를 기록하고, 변경 후 그 수가 늘지 않았는지로 판정한다.
- `package.json`에 `type-check`, `validate`, `test` 스크립트가 없다(`.claude/agents/code-quality.md`의 명령 중 `lint`, `format`만 실제로 있다). `"type"` 필드도 없어서 `.js`는 CommonJS다. 그래서 ESM 스크립트는 `.mjs`여야 한다.
- `npm run lint`는 `eslint src/`만 본다. `npm run format`도 `src/`만 본다. `tsconfig.json`의 `include`는 `**/*.ts(x)`뿐이라 `scripts/*.mjs`는 타입 검사 대상이 아니다.
- `eslint-config-next`가 15.1.6이고 `next`는 16이다. 기존 문제이고 ② 범위 밖이다. 건드리지 않는다.

## 1. 검증 명령 (구현 후 이 순서로, 전부 통과해야 test agent로 넘김)

```bash
npm install                                   # yaml devDependency 추가 포함
npx tsc --noEmit                              # TS 0 errors (기준선 대비 증가 0)
npm run lint                                  # src/ ESLint 0 errors
npx eslint scripts/brain-publish.mjs scripts/brain-export.mjs scripts/lib/
npx prettier --check scripts/brain-publish.mjs scripts/brain-export.mjs scripts/lib/ src/app/api/revalidate/route.ts
node --test scripts/lib/brain-core.test.mjs   # 단위 테스트 전부 통과, skip·only 0
node --check scripts/brain-publish.mjs && node --check scripts/brain-export.mjs
```

- `package.json`에는 설계대로 `yaml`(devDependency)만 추가한다. 위 명령을 감싸는 새 npm 스크립트는 만들지 않는다(설계에 없음).
- 기존 파일(`route.ts`, `EditPostForm.tsx`, `page.tsx`)에는 `prettier --write`를 통째로 돌리지 않는다. 고친 줄과 상관없는 줄이 바뀌면 diff가 흐려진다. 주변 스타일을 손으로 맞춘다. 새 파일만 prettier로 포맷한다.

## 2. 공통 스타일

`.prettierrc.json` 그대로: 작은따옴표, 세미콜론, 2칸 들여쓰기, `trailingComma: es5`, 80열.

| 대상 | 규칙 | 예 |
|---|---|---|
| 파일 | kebab-case | `brain-core.mjs`, `brain-core.test.mjs` |
| 함수·변수 | camelCase, 동사로 시작 | `parseFrontmatter`, `scanLinks`, `resolveImage`, `plan` |
| 상수 | UPPER_SNAKE_CASE, 파일 맨 위 | `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `ALLOWED_IMAGE_EXTS`, `BRAIN_STORAGE_PREFIX = 'brain/'` |
| 차단 사유 코드 | 짧은 kebab-case 문자열 상수 | `'private-link'`, `'bad-scheme'`, `'comment'`, `'slug-changed'` |
| SQL 객체 | snake_case, 기존 접두 규칙 | `idx_post_links_target`, `post_links_select_public` |
| 주석·보고 문구 | 한국어(설계 문서와 같은 말투). 코드 식별자는 영어 | |

- `any` 금지(TS). 불가피하면 `unknown` 후 좁힌다.
- 매직 넘버·매직 문자열(`'brain/'`, 5MB, 스킴 목록)은 상수 하나에만 둔다. 같은 값을 두 파일에 복붙하지 않는다.
- 함수 50줄, 파일 300줄을 넘기면 나눈다(`brain-core.mjs`가 커지면 `scan`/`plan`으로 쪼개도 됨. 단 새 파일은 `scripts/lib/` 안에만).

## 3. scripts/ (`brain-publish.mjs`, `brain-export.mjs`, `lib/*`)

### 3.1 언어·모듈

- **ESM `.mjs`, 순수 JS.** TS로 쓰지 않는다. `tsx`/`ts-node` 같은 실행기 의존성을 늘리지 않고, `node`만으로 돈다(설계 §6, `evaluate-rag.mjs`와 같음).
- 타입 보조는 JSDoc으로 공개 함수 시그니처에만 단다(`@param`, `@returns`). `// @ts-check`는 넣어도 되지만 tsc 대상이 아니므로 검증 근거로 삼지 않는다.
- Node 내장은 `node:` 접두로 import한다(`node:fs/promises`, `node:path`, `node:crypto`, `node:test`, `node:assert/strict`).
- 최상위 `await` 허용. 진입점은 `main()` 하나로 감싸고 마지막에 `process.exitCode = await main()` 형태로 끝낸다. `process.exit()`를 중간에서 부르지 않는다(출력이 잘릴 수 있음). env 누락의 exit 2도 같은 방식으로 반환한다.

### 3.2 레이어 (의존 방향: CLI → env, core / core는 아무것도 import하지 않음)

| 파일 | 해도 되는 것 | 하면 안 되는 것 |
|---|---|---|
| `lib/brain-core.mjs` | 문자열·Buffer·평범한 객체를 받아 결과 객체를 돌려줌. `yaml`, `node:crypto`(sha256), `node:path`의 `posix`만 | `fs`, `process.env`, `console.*`, supabase, `fetch`, `Date.now()` |
| `lib/brain-env.mjs` | 두 env 파일 파싱, 키 검사, service role 클라이언트 생성 | 값 출력, publishable key로 대체 |
| `brain-publish.mjs`, `brain-export.mjs` | 인자 파싱, vault 읽기, DB select/쓰기, Storage, `fetch`, 출력 | 링크·스킴 판정 로직(전부 core에 둠) |

- `plan(files, dbState)`의 입력: `files`는 `{ path, text, mtime? }[]`(vault 상대 posix 경로), 이미지 해석에 필요한 vault 파일 목록과 이미지 바이트는 CLI가 미리 읽어 넘긴다. 출력: `{ blocked: Violation[], actions: Action[], uploads: Upload[], reindexCount }`. 쓰기 단계는 `actions`만 보고 실행한다.
- `Violation`은 `{ file, line, reason, excerpt }`. `line`은 **파일 기준 줄 번호**(frontmatter 줄 수를 더한 값)다. 본문 기준으로 찍으면 Obsidian에서 바로 못 찾는다.
- 경로 키(`source_path`, vault 색인)는 항상 vault 상대 **posix** 경로, 파일명은 **NFC**로 정규화한다. Windows `\`가 DB에 들어가면 다른 PC에서 고아로 잡힌다.

### 3.3 Supabase·Storage

- 클라이언트: `createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })`.
- 모든 호출은 `{ data, error }`를 받아 `error`가 있으면 바로 던진다. `data ?? []`로 삼키지 않는다(`evaluate-rag.mjs`의 `data || []` 패턴 따라 하지 말 것).
- 이미지 업로드는 `contentType`을 **반드시** 명시한다(Buffer를 넘기면 supabase-js 기본값이 `text/plain`이다). `cacheControl: '31536000'`(기존 `api/media`와 같음), `upsert: false`. 확장자는 magic bytes로 판정한 형식에서 정한다(같은 바이트가 `.jpg`/`.jpeg` 두 키로 올라가지 않게).
- "이미 있음" 응답은 Storage 에러의 상태 코드 409(또는 `Duplicate`)일 때만 건너뛴다. 그 밖의 에러는 실패다.
- 쓰기 순서는 설계 §4를 지킨다. 중간 실패 시 이미 쓴 것을 되돌리려 하지 않는다(설계: 재실행으로 수렴). 실패 보고에 "다시 실행하세요"를 찍는다.

### 3.4 에러 처리·종료 코드

| 상황 | 동작 |
|---|---|
| env 키 없음 | vault·DB 접근 전 exit 2, 설계 §6.1 문구 |
| 검사 위반 1건 이상 / export 검증 차이 | 쓰기 0, 목록 출력 후 exit 1 |
| 그 밖의 실행 중 오류(DB, Storage, 파일 읽기) | `main()`의 최상위 catch에서 한 줄 요약 출력 후 exit 1 |
| 재검증 실패 | 데이터는 들어갔으므로 exit 0 + 경고 + `--revalidate-only` 재시도 명령 출력(설계 §5) |
| 알 수 없는 CLI 인자, `--brain` 누락 | 사용법 출력 후 exit 2 |

- `--apply` 없이는 Storage·DB에 쓰는 코드 경로에 아예 들어가지 않는다. 쓰기 함수는 `apply` 플래그를 인자로 받지 말고, 호출 자체를 `if (args.apply)` 안에 둔다.

### 3.5 비밀값 로그 금지

- `console.*`에 넘겨도 되는 것: 메시지 문자열, `error.message`, `error.code`, 파일 경로, slug, 건수.
- 넘기면 안 되는 것: env 객체, supabase 클라이언트, `fetch`의 요청 옵션·헤더, `Response`/`Error` 객체 통째(`console.error(err)` 금지 → `console.error(err.message)`), 스택에 요청 옵션이 실릴 수 있는 객체.
- env 누락 메시지는 키 **이름**과 파일 경로만 찍는다. "값이 짧다" 같은 검사도 길이·값을 찍지 않는다.
- 키를 명령줄 인자로 받는 옵션을 만들지 않는다(설계 §6.1).
- 테스트에서 env 검사(설계 §11 "환경")는 가짜 값 문자열을 넣고, 캡처한 stdout/stderr에 그 문자열이 **없음**을 단언한다.

### 3.6 테스트 (`node --test`)

- 파일: `scripts/lib/brain-core.test.mjs` 하나로 시작. 커지면 `scripts/lib/*.test.mjs`로 나눈다. `import { test } from 'node:test'`, `import assert from 'node:assert/strict'`.
- 테스트 이름은 설계 §11 표의 행을 그대로 한국어로 쓴다. 그래야 test agent가 표와 1:1로 대조한다.
- `plan()` 테스트는 **메모리 픽스처**(문자열·객체)로 한다. 디스크 픽스처 vault를 커밋하지 않는다(비공개 노트 이름 예시가 저장소에 남음). 실제 파일이 필요한 env·이미지 해석 테스트는 `fs.mkdtemp(os.tmpdir())`에 만들고 `t.after`에서 지운다.
- 5MB 초과·magic bytes 불일치 이미지는 테스트 안에서 `Buffer.alloc`으로 만든다. 바이너리 픽스처를 커밋하지 않는다.
- 왕복 테스트(설계 §11 기준 2)는 `Buffer.compare(...) === 0`으로 바이트 비교한다. 문자열 `===`만으로 끝내지 않는다(CRLF·NFD가 섞임).
- `test.skip`, `test.only`, `todo` 금지. 실DB 1회 수동 항목은 테스트 파일에 넣지 않고 test agent 체크리스트로 남긴다.
- 테스트는 네트워크·`.env*` 파일을 건드리지 않는다.

## 4. Next 쪽 변경

### 4.1 `src/app/api/revalidate/route.ts` (신규)

- `cron/keep-alive/route.ts`와 같은 모양: `export const dynamic = 'force-dynamic'`, `export async function POST(request: Request)`만. GET 등은 export하지 않는다(Next가 405를 낸다, 핸들러를 따로 쓰지 않는다).
- `import { createHash, timingSafeEqual } from 'node:crypto'`. 비교는 설계 §3.1대로 양쪽 sha256 후 `timingSafeEqual`.
- 재검증 경로 목록은 파일 안 상수 배열 하나로 두고 응답 `paths`도 그 배열을 그대로 쓴다.
- 응답은 `{ ok: true, paths }` / `{ ok: false }`뿐. `console.error`에 헤더나 비밀값을 넘기지 않는다.

### 4.2 `src/app/api/posts/route.ts`

- 기존 스타일 유지: 번호 단 주석(`// 1. ...`), `NextResponse.json({ error }, { status })`. 새 409 문구는 설계 그대로 `'brain에서 관리하는 글입니다'`.
- **실패하면 닫힘(fail closed)**: DELETE·PATCH의 사전 조회가 `error`이거나 행이 없으면 404/500으로 끝낸다. 지금 DELETE는 조회 에러를 무시하고 바로 지우는데, origin 가드가 이 조회에 걸리므로 조회 실패를 "admin 글"로 취급하면 안 된다.
- PATCH는 이제 `content`가 없어도 항상 사전 조회한다(`select('origin, content')` 한 번). 조회를 두 번 하지 않는다.
- 허용 목록은 상수로: `const BRAIN_EDITABLE_KEYS = new Set(['id', 'category_id', 'tag_ids'])`. body 키 검사로 판정한다(값이 같아도 키가 있으면 409, 설계 그대로).
- DB 트리거 에러(`error.code === '42501'`)는 500이 아니라 409로 돌려준다. 메시지에 DB 원문을 붙이지 않는다.
- `origin` 제거는 구조 분해에서 꺼내 버린다(`const { id, slug: _slug, tag_ids, origin: _origin, ...updates } = body`). 기존 `_slug` 패턴과 같다. 이 줄이 lint 경고를 내면 `void _origin`보다 기존 방식대로 두고 경고 수가 기준선 대비 늘지 않았는지만 본다.
- admin GET의 `Cache-Control`은 `admin` 분기로 헤더 값만 바꾼다. 쿼리 로직은 건드리지 않는다.
- Storage 삭제 보호는 §6.1.

### 4.3 `src/types/database.ts`

- `Post`에 `origin: 'admin' | 'brain'`. `CreatePostRequest`, `UpdatePostRequest`에는 **넣지 않는다**(클라이언트가 보낼 수 있는 값처럼 보이면 안 됨).

### 4.4 `EditPostForm.tsx`

- `const isBrain = post.origin === 'brain'` 하나로 분기. 잠금 대상 입력에 `disabled={isBrain}`, 기존 slug 입력의 잠금 클래스(`cursor-not-allowed opacity-60`)를 그대로 쓴다.
- 저장 body는 분기에서 객체를 따로 만든다(`isBrain ? { id, category_id, tag_ids } : {...기존}`). brain 글에서는 `uploadPendingImages`도 부르지 않는다(본문을 안 보내므로 올릴 이유가 없고, 올리면 고아 이미지가 생긴다).
- 새 상태·새 컴포넌트를 만들지 않는다. 안내 문구는 기존 `adm-hint` 클래스로.

### 4.5 `src/app/tags/[slug]/page.tsx`

- `export const dynamicParams = true;` 한 줄만 바꾼다. 다른 줄은 손대지 않는다.

## 5. 마이그레이션 `supabase/migrations/006_brain_publish.sql`

- 파일명은 `00N_snake_case.sql` 규칙대로 `006_brain_publish.sql`. 한 파일에 설계 §2.2 전체를 담는다(나누지 않음).
- 머리말은 005와 같은 형식:
  ```sql
  -- Brain Publish Migration (Roadmap ②)
  -- Created: 2026-10-29
  -- Description: posts.origin, post_sources, post_links, blog_index view, brain post guard trigger
  ```
  절 구분은 005처럼 `-- ====` 줄 + 대문자 제목(TABLE / INDEXES / ROW LEVEL SECURITY / VIEW / GRANTS / TRIGGER).
- SQL 키워드 대문자, 식별자 snake_case, 2칸 들여쓰기(005와 같음).
- 설계 SQL을 그대로 옮긴다. `IF NOT EXISTS` 같은 재실행 대비 구문을 덧붙이지 않는다(기존 001~005도 SQL 에디터 1회 실행 전제).
- 005의 `GRANT ALL ... TO anon, authenticated`를 따라 하지 않는다. 006은 설계 §2.2 (5)의 REVOKE → 최소 GRANT가 기준이다.
- 되돌리기(down) 파일은 만들지 않는다(기존 관례 없음).

## 6. 설계 보완점 (구현 시 반영 필요)

### 6.1 admin 쪽 Storage 삭제가 `blog-images/brain/`을 지우면 안 된다 (필수)

설계 §2.4 "위험(기록만)"은 brain 글끼리는 문제없다고 보지만, 삭제 경로가 둘 더 있다.

1. `src/app/api/posts/route.ts`의 PATCH(본문에서 빠진 이미지 삭제)와 DELETE(글이 참조한 이미지 삭제). admin 글이 `brain/…` URL을 복사해 쓰다가 고치거나 지우면 brain 글의 이미지가 사라진다.
2. `src/app/api/media/route.ts`의 DELETE. brain 업로드는 `media` 행을 만든다(설계 §2.4-4). 그래서 admin 미디어 라이브러리(`src/app/admin/media/page.tsx`)의 삭제 버튼으로 brain 이미지를 바로 지울 수 있다.

규칙:

- **어느 admin 경로도 `brain/`으로 시작하는 Storage 키를 `remove()`에 넘기지 않는다.**
- `posts/route.ts`: `extractStoragePaths()` 결과에서 `brain/` 접두를 걸러 낸다. PATCH와 DELETE가 둘 다 이 함수를 지나므로 한 곳만 고치면 된다. 접두는 상수(`BRAIN_STORAGE_PREFIX`)로.
- `media/route.ts` DELETE: `filepath`가 `brain/`으로 시작하면 Storage도 `media` 행도 지우지 않고 `409 { error: 'brain에서 관리하는 이미지입니다' }`. 행만 지우면 다음 발행에서 다시 생기고, 화면에선 지운 것처럼 보였다가 돌아온다.
- 판정은 `remove()`에 넘길 바로 그 문자열에 `startsWith(BRAIN_STORAGE_PREFIX)`로 한다. 판정한 값과 넘기는 값이 다르면(중간에 디코딩·정규화) 우회 여지가 생긴다.
- 테스트(수동, test agent 표에 추가): admin 글 본문에 brain 이미지 URL을 넣고 저장 → 그 줄 삭제 후 저장 → 글 삭제 → 미디어 라이브러리에서 해당 이미지 삭제 시도(409). 각 단계 뒤 Storage에 객체가 남아 있음.

### 6.2 admin 목록의 삭제가 409를 삼킨다

`src/app/admin/posts/page.tsx:180`은 `fetch(...).then(() => window.location.reload())`라 응답을 보지 않는다. brain 글 DELETE가 409를 내도 화면은 조용히 새로고침만 한다. 설계는 "목록은 바꾸지 않는다"고 했지만, 이 한 군데는 `res.ok`가 아니면 `alert(에러 문구)`를 띄우도록 최소 수정이 필요하다. (`admin/media/page.tsx:51`도 같은 패턴이므로 6.1의 409를 보이려면 같은 수정.)

### 6.3 wikilink 이름이 vault에서 겹칠 때

설계 §2.3은 `[[name]]`을 "파일명 `name.md`로 찾는다"고만 한다. vault에 같은 이름 파일이 둘 이상이면 어느 쪽인지 정해지지 않는다. 구현 규칙: **경로 없는 링크가 2개 이상에 맞으면 막는다**(사유 `'ambiguous-link'`). 대소문자는 Obsidian처럼 무시하고 비교하되, 그 결과 겹치면 역시 막는다. 단위 테스트 1건 추가.

## 7. 설계 대비 과하다고 보는 지점 (표시만, 설계는 그대로)

1. **이미지 경로 해석의 2단 폴백**(§2.4-1: 글 폴더 기준 → 없으면 vault 루트 기준). 한 규칙(글 폴더 기준)이면 충분하고, 두 규칙이 같은 이름을 다르게 잡는 경우를 따로 테스트해야 한다.
2. **파일 이름 변경 자동 감지**(§4 "같은 slug를 다른 파일이 갖고 있으면 source_path만 갱신"). 이관 직후 12~20편 규모에서 이름 변경은 드물다. "고아 + 같은 slug 새 파일"을 slug 충돌로 막고 주인이 한 번 정리하게 해도 된다. 그대로 구현한다면 테스트(§11 slug 보호)가 이미 있으니 유지 비용은 작다.
3. **brain 이미지의 `media` 행 생성**(§2.4-4). 대시보드 Storage 집계 외에는 쓰임이 없는데, 6.1처럼 admin 삭제 경로를 하나 더 열어 버린다. 행을 만들지 않으면 6.1의 `media/route.ts` 가드가 필요 없어진다(대신 Storage 게이지가 brain 이미지를 세지 못함).
4. **`brain-export.mjs`를 별도 CLI로**. 1회용이라 파서·env를 공유하는 지금 구조는 괜찮지만, 이관이 끝나면 지울 파일임을 파일 머리 주석에 적어 둔다.
5. **EditPostForm의 미리보기 전용 에디터**(§8). 막는 곳이 API 허용 목록과 DB 트리거로 이미 두 겹이다. 본문 영역은 `MDEditor`를 그대로 두고 `preview="preview"`만 주는 정도로 끝내고, 새 읽기 전용 컴포넌트를 만들지 않는다.

## 8. 체크리스트 (구현 후 code-quality 재검증 때 이 항목으로 본다)

- [ ] §1 명령 전부 통과, 기준선 대비 lint·tsc 에러 증가 0
- [ ] `scripts/lib/brain-core.mjs`에 `fs`/`process`/`console`/supabase import 없음
- [ ] `console.error(err)`처럼 객체 통째 출력 없음(scripts, 새 route)
- [ ] `.env.brain.local` 값·Authorization 헤더가 어떤 출력에도 없음(테스트로 확인)
- [ ] 업로드에 `contentType`, `cacheControl`, `upsert: false`
- [ ] PATCH·DELETE 사전 조회 실패 시 닫힘, 42501 → 409
- [ ] `brain/` 키가 `remove()`에 갈 수 있는 경로 0 (`posts/route.ts`, `media/route.ts`)
- [ ] admin 목록·미디어 삭제가 409를 화면에 띄움
- [ ] `test.skip`/`.only`/TODO 없음, 바이너리·비공개 이름 픽스처 커밋 없음
- [ ] 기존 파일 diff에 상관없는 포맷 변경 없음
