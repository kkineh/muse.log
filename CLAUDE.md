# CLAUDE.md - Multi-Agent System Constitution

## ⚡ 필수 행동 규칙 (매 작업마다 이것을 따르라)

### Agent 위임 규칙 (MANDATORY)

다음 작업은 **반드시** 해당 sub-agent에게 위임하라:

| 작업 유형 | 사용 Agent | 조건 |
|-----------|-----------|------|
| 아이디어 구체화, 요구사항 불명확한 경우 | `planner` | design-architecture 전 필수 |
| 새 기능 추가, 데이터 모델 변경, API 설계 | `design-architecture` | 구현 전 필수 |
| UI 페이지 추가, 레이아웃 변경 | `design-ui-ux` | Architecture 설계 후 |
| DB 테이블, API 엔드포인트, 인증 추가 | `security` | 구현 전 필수 |
| 코드 작성 전 품질 기준 확인 | `code-quality` | 구현 직전 필수 |
| 기능 구현, 코드 작성 | `feature-development` | 설계 완료 후 |
| 테스트 작성 및 실행 | `test` | 구현 완료 후 필수 |
| 복잡도 감소, 코드 중복 제거 | `refactoring` | 선택적 |
| 문서 업데이트, CHANGELOG 작성 | `documentation` | 테스트 통과 후 필수 |
| Vercel 배포, CI/CD 설정 | `deployment-automation` | 문서화 후 필수 |
| Git commit, 릴리스 태그 | `vcs` | **예외 없음. 직접 git 명령 실행 금지** |
| 비용 영향 검토 (**Veto Power**) | `cost-optimization` | 모든 설계/구현 전 필수 |

### Sub-Agent Routing (실행 방식)

**병렬 실행** (모든 조건 충족 시):
- 3개 이상 독립 태스크
- 파일 겹침 없음
- 공유 상태 없음
- 의존성 없음

**순차 실행** (하나라도 해당 시):
- 태스크 간 의존성 존재
- 같은 파일 수정
- 앞 결과가 뒤에 필요
- 순서 보장 필요

---

## 🚫 절대 금지 (위반 시 즉시 중단)

1. **유료 SaaS 의존성 추가 금지**
   - Vercel, Supabase, OpenAI API 외 유료 서비스 금지
   - 유료 CDN, 이미지 최적화 서비스 금지

2. **캐시 전략 없는 LLM/DB 호출 금지**
   - 모든 OpenAI API 호출에 캐시 전략 필수
   - 모든 DB 쿼리에 캐시 가능성 검토 필수

3. **동적 렌더링 우선 금지**
   - SSG > ISR > SSR > CSR 순서 엄수
   - 정적 생성 가능한데 동적 렌더링 선택 금지

4. **설계 없는 구현 금지**
   - design-architecture 완료 전 코드 작성 금지
   - security agent 검토 전 DB/API 구현 금지

5. **테스트 없는 배포 금지**
   - test agent 통과 전 배포 금지

---

## ✅ 핵심 원칙 (비용 수렴 원칙)

### 제0조: Zero-Cost Convergence Principle

```
lim(cost) → 0 as traffic → moderate
```

모든 결정은 다음을 따라야 한다:

1. **정적 우선**: 빌드타임 생성 > 런타임 연산
2. **캐시 필수**: LLM 응답, DB 쿼리 모두 캐시 전략
3. **무료 플랜**: Vercel, Supabase, OpenAI API 무료 범위만
4. **토큰 최소화**: 답변당 글 전문은 최대 3편, 대화는 최근 턴만

### 무료 플랜 한도 (절대 초과 금지)

- **Vercel**: 100GB/월 bandwidth (목표: 50GB 이하)
- **Supabase**: 500MB DB, 1GB Storage, 5GB bandwidth (목표: 각 50% 이하)
- **OpenAI**: 월 $10 예산 (캐시 적중률 60% 이상 필수)

---

## 📁 프로젝트 정보

### 시스템 목적
- Next.js 기반 3레벨 카테고리 블로그
- index 라우팅 기반 질의응답 채팅 통합
- 무료 인프라 범위 내 완전 자동화 파이프라인

### 기술 스택 (변경 불가)
- Frontend: Next.js (App Router)
- Database: Supabase (PostgreSQL)
- AI: OpenAI API (Completion)
- Deployment: Vercel (Serverless)
- Storage: Supabase Storage

---

<!-- 여기서부터는 상세 규칙 (참조용) -->

## 상세 규칙 (참조용)

### Agent 계층 구조

1. **Cost Optimization Agent** (최상위 - Veto Power)
2. **Design Agent (Architecture)** (모든 구현의 시작점)
3. **Design Agent (UI/UX)** / **Security Agent** (병렬 가능)
4. **Code Quality Agent** (구현 직전)
5. **Feature Development** (실제 구현)
6. **Test Agent** (구현 직후)
7. **Refactoring Agent** (선택적)
8. **Documentation Agent** (문서화)
9. **Deployment Automation Agent** (배포)
10. **VCS Agent** (커밋)

### 품질 게이트 (핵심만)

**Gate 1: 설계 검증**
- 비용 수렴 원칙 준수
- 캐시 전략 명시
- SSG/ISR 우선 적용

**Gate 2: 보안 검증** (DB/API 작업 시)
- RLS 정책 정의
- API 인증 전략
- Rate limiting

**Gate 3: 테스트 검증**
- Unit test 통과
- Integration test 통과
- 커버리지 > 80%

**Gate 4: 배포 검증**
- 환경 변수 설정
- 빌드 성공
- Health check 통과

### 에이전트 비활성화 (간단한 작업)

다음은 전체 파이프라인 불필요:

- **단순 버그 픽스**: test agent만
- **문서 오타 수정**: documentation agent만
- **CSS 스타일**: design-ui-ux → code-quality
- **린트 설정**: code-quality만

### 충돌 해결 우선순위

1. Cost Optimization Agent (비용 원칙 위반 → 거부)
2. Security Agent (보안 취약점 → 구현 중단)
3. Design Agent (설계 원칙 위반 → 재설계)
4. Test Agent (테스트 실패 → 배포 불가)

### 캐시 전략 계층

1. **L1 (Browser)**: 정적 에셋, 이미지 (1년)
2. **L2 (Vercel Edge)**: SSG/ISR 페이지 (1시간~무제한)
3. **L3 (Application)**: 카테고리 트리, LLM 응답 (1시간~30일)
4. **L4 (Database)**: 자주 조회되는 데이터 (Materialized View)

### 허용/금지 의존성

**허용**:
- 오픈소스 라이브러리 (MIT, Apache 2.0)
- 무료 플랜이 있는 서비스
- 빌드타임 도구

**금지**:
- 유료 전용 SaaS
- 실시간 DB (Firebase 등, Supabase 제외)
- 유료 CDN
- 유료 이미지 최적화 서비스
- 유료 모니터링 서비스 (초기 단계)

### 에이전트 디렉토리 구조

```
.claude/
├── agents/
│   ├── design-architecture.md
│   ├── design-ui-ux.md
│   ├── feature-development.md
│   ├── test.md
│   ├── code-quality.md
│   ├── cost-optimization.md
│   ├── documentation.md
│   ├── security.md
│   ├── deployment-automation.md
│   ├── vcs.md
│   └── refactoring.md
└── skills/
    ├── api-security-patterns/
    ├── doc-templates/
    ├── eslint-prettier-config/
    ├── git-conventions/
    ├── refactoring-patterns/
    ├── rls-policies/
    ├── test-config/
    ├── test-templates/
    ├── vercel-deployment/
    ├── vercel-react-best-practices/
    └── web-design-guidelines/
```

### 운영 원칙

1. **단순성 우선**: 명확한 구현 > 복잡한 추상화
2. **반복 가능성**: 모든 단계 자동화 가능
3. **점진적 개선**: 작은 개선 > 큰 리팩토링

### 시스템 확장 규칙

**새로운 에이전트 추가 조건**:
1. 명확한 책임 범위 정의
2. 기존 에이전트와 중복 없음
3. 비용 수렴 원칙 준수
4. 오케스트레이션 모델에 통합 가능

**에이전트 수정 조건**:
1. 기존 책임 범위 유지
2. 다른 에이전트에 대한 영향 최소화
3. 품질 게이트 변경 시 전체 검토

---

## 변경 이력

- v1.2 (2026-11-01): 채팅을 RAG에서 index 라우팅으로 바꾼 것을 반영
- v1.1 (2026-03-08): Claude Code 자동 호출 최적화 (agent 위임 규칙 추가, 명령형 전환)
- v1.0 (2026-02-27): 초기 헌법 작성
