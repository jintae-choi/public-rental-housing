# CLAUDE.md — public-rental-housing

## 프로젝트 개요

공공임대주택 공고를 자동 수집·분석하여, 사용자의 자격 조건에 맞는 공고를 필터링해주는 대시보드 웹 애플리케이션.
상세 요구사항은 `docs/PRD.md` 참조. 배포 가이드는 `DEPLOYMENT.md` 참조.

---

## 기술 스택 (요약)

Next.js 15 (App Router) + TypeScript | Tailwind CSS + shadcn/ui | Supabase (PostgreSQL) + Drizzle ORM | Playwright (크롤링) | 패턴 기반 파서 (자격 분석) | Vercel (배포) | GitHub Actions (cron) | pnpm

---

## 코딩 컨벤션

- **언어**: 코드는 영어, 주석·문서·커밋 메시지는 한국어
- **타입**: `any` 금지, 반환 타입 필수
- **함수**: 단일 책임, 30줄 이내
- **에러**: try-catch 필수, 로깅 포함
- **네이밍**: camelCase(변수/함수), PascalCase(컴포넌트/타입), UPPER_SNAKE_CASE(상수)
- **Next.js**: App Router만, 서버 컴포넌트 기본, `"use client"` 최소화, Server Actions 활용
- **Drizzle**: 스키마 `src/lib/db/schema.ts`, 쿼리 도메인별 분리, `drizzle-kit` 마이그레이션
- **커밋**: `<타입>: <한국어 설명>` (feat/fix/refactor/docs/style/test/chore)

---

## 현재 진행 상태

**Phase 1: 데이터 수집 파이프라인** ← 현재. 상세 태스크는 `docs/PHASES.md` 참조.

---

## 프로젝트 구조

```
src/
├── app/                  # Next.js App Router (pages, api, layout)
├── components/           # ui/ (shadcn), dashboard/, announcements/
├── lib/                  # supabase/, db/, scraper/, analyzer/, utils/
└── types/                # TypeScript 타입 정의
scripts/                  # scrape.ts, analyze.ts (GitHub Actions용)
drizzle/                  # 마이그레이션 파일
```

---

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
```

---

## 작업 규칙 (토큰 최적화)

### 문서 읽기
- `docs/PRD.md`는 **절대 전체를 읽지 말 것**. 필요한 섹션만 offset/limit으로 부분 읽기:
  - 공고 수집 (FR-001~005): offset 134, limit 30
  - 자격 분석 (FR-006~008): offset 163, limit 30
  - 대시보드 (FR-009~013): offset 193, limit 70
  - 알림 (FR-014~015): offset 238, limit 25
  - 인증 (FR-016~017): offset 285, limit 15
  - 데이터 모델: offset 323, limit 135
  - 화면 구성: offset 511, limit 55
  - 아키텍처: offset 566, limit 50
  - 파이프라인 상세: offset 616, limit 85

### 서브에이전트 활용
- 독립적인 파일/모듈 작업은 Agent 도구로 병렬 처리할 것
- 예: 크롤러 3개(SH/LH/마이홈), 페이지 컴포넌트, 테스트 작성 등
- 서브에이전트에게는 해당 작업에 필요한 컨텍스트만 전달 (PRD 전체 전달 금지)
- **모델 지정 규칙** (Agent 도구의 `model` 파라미터):
  - `haiku` — 보일러플레이트 생성, 단순 파일 생성, 패턴 반복 작업, 코드 포맷팅
  - `sonnet` — 일반 구현, 코드 탐색/검색, 버그 수정, 컴포넌트 구현, 테스트 작성
  - `opus` — 복잡한 설계 판단, 아키텍처 결정, 크롤링 로직 분석, 패턴 파서 설계

### 작업 단위
- 한 대화에서 1 Phase의 2~3 태스크까지만 처리
- Phase가 바뀌면 새 대화 시작 권장
- 대화가 길어지면 compact 실행

### 워크플로우
- **기본**: VSCode 확장에서 설계·구현·리뷰 모두 처리
- **대량 작업 시**: 파일 10개 이상 생성이 필요한 경우, VSCode 터미널에서 CLI로 자율 실행 위임 후 확장에서 리뷰

---

## 주의사항

- robots.txt 및 이용약관 준수
- Supabase RLS 활용, 개인정보 최소 수집
- 자동 분석 결과는 참고용 — 면책 고지 필수
