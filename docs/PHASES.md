# 개발 단계 (Phases)

## Phase 0: 환경 세팅 & 문서화 ✅ 완료
- [x] CLAUDE.md 작성
- [x] PRD.md 작성
- [x] 프로젝트 초기화 (Next.js + TypeScript + pnpm)
- [x] Supabase 프로젝트 생성 및 연결
- [x] Drizzle ORM 설정 및 초기 스키마 정의
- [x] DB 스키마 마이그레이션 (Vercel 배포 시 자동)
- [x] GitHub 저장소 생성 및 초기 커밋
- [x] Vercel 배포 설정 (자동 마이그레이션 포함)
- [x] GitHub Actions 워크플로우 설정 (일일 크롤링/분석)

## Phase 1: 데이터 수집 파이프라인 (상세: `docs/PHASE1_PLAN.md`)
- [x] 크롤링 대상 사이트 구조 분석 (SH, LH, 마이홈)
- [x] Step 0: 의존성 설치 (pdfjs-dist, playwright, Chromium 브라우저)
- [x] Step 1: 공통 기반 코드 (인터페이스, base 유틸, DB 쿼리)
- [x] Step 2: 크롤러 병렬 구현 (마이홈 + SH, LH는 마이홈이 커버)
- [x] Step 2.5: PDF 검증 에이전트 (실제 데이터로 스키마 갭 확인 → 6개 필드 추가 마이그레이션)
- [x] Step 3: 통합 스크립트 + GitHub Actions + /simplify 리뷰

## Phase 2: 자격 분석 엔진 (패턴 기반)
- [x] 공고문 텍스트 전처리 및 섹션 분할 로직
- [x] 정규식 + 키워드 매칭 기반 파서 구현
- [x] 추출 결과 검증 (수동 비교)
- [x] 사용자 프로필 ↔ 자격 조건 매칭 로직
- [x] 매칭 결과 DB 저장
- [ ] 파서 패턴 규칙 튜닝

## Phase 3: 웹 대시보드
- [ ] 레이아웃 및 공통 컴포넌트
- [ ] 메인 대시보드 (공고 목록, 필터, D-Day)
- [ ] 공고 상세 페이지
- [ ] 로그인/회원가입 (Supabase Auth)
- [ ] 사용자 프로필 입력/수정
- [ ] 내 자격 필터링
- [ ] 반응형 디자인

## Phase 4: 알림 & 고도화
- [ ] 이메일 알림 (Nodemailer + Gmail SMTP)
- [ ] 마감 임박 리마인더
- [ ] 알림 설정/히스토리 페이지
- [ ] 파이프라인 모니터링 (관리자)
- [ ] 통합 테스트 및 성능 최적화
