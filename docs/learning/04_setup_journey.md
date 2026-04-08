# 📖 Phase 0 설정 여정 정리

## 목표
로컬 개발 → GitHub → Vercel → Supabase 배포 파이프라인 자동화

---

## 당신이 직접 한 작업 (수동 작업)

### 1️⃣ Supabase 설정
**당신이 한 것**:
- Supabase 대시보드에서 프로젝트 생성
- PostgreSQL 데이터베이스 초기화
- Connection String (DATABASE_URL) 복사
- 세 개의 API 키 발급
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY

**걸린 시간**: ~5분
**왜 필요**: 앱이 데이터를 저장할 곳 필요

### 2️⃣ GitHub 토큰 업데이트
**당신이 한 것**:
- GitHub Personal Access Token 접속
- `workflow` scope 체크박스 활성화
- "Update token" 클릭

**걸린 시간**: ~2분
**왜 필요**: GitHub Actions 워크플로우 파일을 생성할 권한 필요

### 3️⃣ GitHub Secrets 추가
**당신이 한 것**:
- GitHub 저장소 Settings → Secrets
- 3개의 secret 추가
  - DATABASE_URL
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY

**걸린 시간**: ~3분
**왜 필요**: GitHub Actions에서 Supabase에 접근할 권한 필요

### 4️⃣ Vercel 배포
**당신이 한 것**:
- Vercel 대시보드 → "Add New Project"
- GitHub 저장소 선택
- 환경변수 4개 추가
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - DATABASE_URL
- "Deploy" 클릭

**걸린 시간**: ~5분
**왜 필요**: 앱을 인터넷에 공개하기 위해

---

## 제가 자동화한 작업 (코드로)

### 1️⃣ 프로젝트 초기화
```bash
pnpm create next-app@latest . --typescript --tailwind --app
```
**생성된 파일**:
- `package.json` - 프로젝트 메타데이터 및 의존성
- `next.config.ts` - Next.js 설정
- `tsconfig.json` - TypeScript 설정
- `src/` - 소스 코드 디렉토리
- `public/` - 정적 파일

### 2️⃣ Supabase 클라이언트 설정
```
생성한 파일:
├── src/lib/supabase/server.ts   # 서버 컴포넌트용
├── src/lib/supabase/client.ts   # 클라이언트용
└── src/lib/supabase/admin.ts    # 관리자 권한용

역할:
- 로컬/프로덕션 환경에서 Supabase에 연결
- 데이터 조회/수정/삭제
```

### 3️⃣ Drizzle ORM 스키마 정의
```
생성한 파일:
├── src/lib/db/schema.ts         # 5개 테이블 정의
├── src/lib/db/index.ts          # DB 연결 관리
├── drizzle.config.ts            # Drizzle 설정
└── drizzle/0000_adorable_payback.sql  # 마이그레이션 SQL

내용:
- announcements (공고)
- eligibility_conditions (자격 조건)
- user_profiles (사용자)
- eligibility_results (매칭 결과)
- notifications (알림)
```

### 4️⃣ GitHub Actions 워크플로우
```
생성한 파일:
├── .github/workflows/migrate.yml  # DB 마이그레이션 자동화
└── .github/workflows/scrape.yml   # 일일 크롤링 자동화

트리거:
- migrate.yml: drizzle/** 또는 schema.ts 변경 시
- scrape.yml: 매일 05:00 UTC (한국시간 14:00)
```

### 5️⃣ Vercel 배포 설정
```
생성한 파일:
└── vercel.json

내용:
"buildCommand": "pnpm drizzle-kit migrate && pnpm build"

의미:
배포할 때:
1. 먼저 DB 마이그레이션 실행
2. 그 후 Next.js 빌드

이 덕분에:
코드 배포 + 스키마 변경이 동시에 일어남
```

### 6️⃣ 문서화
```
생성한 파일:
├── DEPLOYMENT.md          # 배포 가이드
├── .env.local.example     # 환경변수 템플릿
└── docs/learning/         # 학습 자료
    ├── 00_architecture_overview.md
    ├── 01_git_github.md
    ├── 02_supabase.md
    ├── 03_vercel.md
    └── 04_setup_journey.md (이 파일)
```

---

## 시간 분석

### 총 소요 시간

**당신이 직접 한 작업**:
- Supabase: 5분
- GitHub: 2분
- GitHub Secrets: 3분
- Vercel: 5분
- **소계: 15분**

**제가 자동화한 작업**:
- Next.js 초기화: 2분
- Supabase 클라이언트: 3분
- Drizzle 스키마: 10분
- GitHub Actions: 5분
- Vercel 설정: 2분
- 문서화: 20분
- **소계: 42분**

**전체: 57분**

---

## 배운 것

### 🎯 기술 스택 이해
| 기술 | 역할 | 학습 | 
|------|------|------|
| Git/GitHub | 버전관리 + 자동화 | ✓ |
| Supabase | 데이터베이스 | ✓ |
| Vercel | 배포 호스팅 | ✓ |
| Drizzle ORM | 타입안전 쿼리 | ✓ |

### 🎯 워크플로우 이해
```
로컬 개발
  ↓ (git push)
GitHub
  ↓ (webhook)
GitHub Actions (자동화)
  ↓ (결과)
Vercel (배포)
  ↓ (환경변수)
Supabase (실행)
  ↓
사용자 접근
```

### 🎯 보안 개념
- 환경변수로 민감한 정보 관리
- 로컬 vs 프로덕션 분리
- GitHub Secrets 활용
- API 키 scope 관리

---

## 다음 Phase에서 배우게 될 것

### Phase 1: 데이터 수집 파이프라인
```
현재: 데이터베이스와 배포 파이프라인 준비됨
↓
다음: 실제로 데이터를 수집하는 크롤러 작성

배울 것:
- Playwright (브라우저 자동화)
- 웹 크롤링 (SH, LH, 마이홈)
- 데이터 파싱
- PDF 텍스트 추출
- 데이터베이스 저장 (Drizzle 쿼리)
```

### Phase 2: 자격 분석 엔진
```
배울 것:
- 정규식 패턴 매칭
- 자연어 처리
- 텍스트 파싱
- 자격 조건 추출
```

### Phase 3: 웹 대시보드
```
배울 것:
- Next.js 페이지 컴포넌트
- shadcn/ui 컴포넌트 사용
- Supabase 실시간 데이터
- 반응형 디자인
```

---

## 성과

### ✅ 완성된 것
- [x] 로컬 개발 환경 구축
- [x] 데이터베이스 스키마 설계 및 마이그레이션
- [x] GitHub 자동화 파이프라인
- [x] Vercel 배포 설정 (자동 마이그레이션 포함)
- [x] 일일 크롤링 자동화 스케줄

### 📊 수치로 보는 진행도
```
Phase 0 (환경 세팅): ████████████████████ 100% ✓
Phase 1 (크롤링):    ░░░░░░░░░░░░░░░░░░░░   0%
Phase 2 (분석):      ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3 (대시보드):  ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4 (알림):      ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## 핵심 깨달음

### 1️⃣ 자동화의 중요성
```
수동 작업 (매번 손으로 배포):
- 시간 낭비
- 실수 위험
- 일관성 없음

자동화 (git push → 배포):
- 1초 만에 배포
- 실수 불가능
- 항상 일관된 결과
```

### 2️⃣ 좋은 기초 = 빠른 개발
```
Phase 0 (기초): 57분 투자
  ↓
Phase 1+: 이 기초 위에 빠르게 개발 가능
  ↓
결과: 전체 시간 단축
```

### 3️⃣ 프로덕션 파이프라인 이해
```
개발자 몇 명일까?
→ 1명 (당신)

하지만 기본부터 프로덕션 수준 파이프라인 구축함
→ 나중에 팀이 커져도 문제없음
```

---

## 질문이 생긴다면

### 기술적 질문
- "왜 이 기술을 썼나?"
- "어떻게 이게 작동하나?"
- "문제가 생기면?"

**답**: `docs/learning/` 폴더의 문서 참조

### 실무 질문
- "지금부터 뭘 해야 하나?"
- "다음 단계는?"

**답**: `docs/PHASES.md` 참조

### 디버깅
- "배포가 실패했어"
- "데이터가 안 나와"

**답**: 
1. Vercel/GitHub 로그 확인
2. 에러 메시지 읽기
3. 문서에서 관련 섹션 찾기

---

## 축하합니다! 🎉

Phase 0 완료!

이제 당신은:
- 최신 Next.js 개발 환경 갖춤
- 프로덕션 수준 배포 파이프라인 완성
- 자동화된 개발 워크플로우 구축

**다음**: Phase 1에서 크롤러를 작성할 준비가 됨!
