# 🚀 Vercel 완벽 이해

## Vercel이란?

### 정의
**Next.js 앱을 배포하는 클라우드 호스팅 서비스**

### 일상의 비유
```
당신의 컴퓨터 = 로컬 카페
Vercel = 전국 지점을 가진 체인점 빌딩

로컬 개발:
당신의 컴퓨터에서 http://localhost:3000으로 테스트

배포:
당신의 앱을 Vercel 서버에 올려서 
세계 어디서든 접근 가능하게 만듦

예: https://public-rental-housing.vercel.app
```

---

## 왜 Vercel을 선택했나?

### 1️⃣ Next.js 최적화
```
Vercel = Next.js 만든 회사
→ Next.js에 가장 잘 최적화됨
→ 자동으로 최고의 성능 제공
```

### 2️⃣ 무료 호스팅
```
Hobby 플랜 = 무료
- 월 100GB 대역폭
- 무제한 배포
- SSL 인증서 자동 포함

언제든 프로 플랜으로 업그레이드 가능
```

### 3️⃣ GitHub 자동 연동
```
git push → Vercel이 자동 감지 → 자동 배포
개발자가 할 일 없음 (완전 자동화)
```

### 4️⃣ 환경변수 관리
```
.env.local (로컬) ≠ Vercel 환경변수 (프로덕션)

프로덕션 키 노출 방지
각 환경별로 다른 설정 가능
```

---

## 당신이 한 설정

### 1️⃣ Vercel 가입
```
당신이 한 것:
Vercel 대시보드에 "Hobby" 플랜으로 로그인
```

### 2️⃣ GitHub 저장소 연결
```
당신이 한 것:
Vercel 대시보드 → "Add New Project"
                → GitHub 저장소 선택 (public-rental-housing)
                → "Import" 클릭

결과:
GitHub의 main 브랜치가 Vercel과 자동 연동됨
```

### 3️⃣ 환경변수 설정
```
당신이 한 것:
Vercel 프로젝트 Settings → Environment Variables

추가한 변수:
- NEXT_PUBLIC_SUPABASE_URL (공개)
- NEXT_PUBLIC_SUPABASE_ANON_KEY (공개)
- SUPABASE_SERVICE_ROLE_KEY (비밀)
- DATABASE_URL (비밀)

각 변수마다:
Production (배포 환경) ✓ 체크
Preview (테스트 환경) ✓ 체크
Development (로컬) - 불필요 (.env.local 사용)
```

---

## 배포 자동화 파이프라인

### 1️⃣ 코드 변경
```
당신의 컴퓨터:
VSCode에서 src/lib/scraper/sh.ts 수정
```

### 2️⃣ Git 커밋 & 푸시
```
git add src/lib/scraper/
git commit -m "feat: SH 크롤러 구현"
git push origin main
```

### 3️⃣ GitHub이 감지
```
GitHub 대시보드:
"new commit detected on main"

동시에 GitHub Actions 워크플로우 시작:
- migrate.yml (DB 마이그레이션)
- scrape.yml (크롤링) - 일일 스케줄만
```

### 4️⃣ Vercel이 감지
```
Vercel 웹훅(webhook) 수신:
"GitHub에서 main 브랜치 변경됨"

자동 배포 시작:
1. 최신 코드 다운로드
2. 의존성 설치 (pnpm install)
3. 빌드 (pnpm build)
   → 동시에 vercel.json 설정 실행:
   "buildCommand": "pnpm drizzle-kit migrate && pnpm build"
4. 배포 완료
5. 자동으로 도메인 할당
```

### 5️⃣ 결과
```
배포 완료 후:
- https://public-rental-housing.vercel.app
- 모든 사용자가 새 코드 사용 가능
- DB 스키마 변경도 적용됨
```

---

## 빌드 과정 상세

### vercel.json 설정
```json
{
  "buildCommand": "pnpm drizzle-kit migrate && pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install"
}
```

### 이것이 하는 일

#### installCommand: pnpm install
```
Vercel 서버에서:
1. Node.js 설치 확인
2. pnpm 설치
3. package.json 읽기
4. node_modules 다운로드 및 설치

결과: 프로젝트 실행에 필요한 모든 라이브러리 준비
```

#### buildCommand: pnpm drizzle-kit migrate && pnpm build
```
순서대로 실행:

1️⃣ pnpm drizzle-kit migrate
   - DATABASE_URL 읽기 (환경변수에서)
   - drizzle/0000_adorable_payback.sql 실행
   - Supabase에 테이블 생성/업데이트
   - 마이그레이션 완료 후 진행

2️⃣ pnpm build
   - TypeScript → JavaScript로 컴파일
   - Next.js 페이지 사전 생성
   - 최적화 및 번들링
   - .next 폴더에 배포 준비 완료
```

#### devCommand: pnpm dev
```
로컬 개발:
pnpm dev 실행 시 사용될 명령어
(Vercel은 프로덕션용만 사용)
```

---

## 환경별 설정 비교

### 로컬 개발
```
.env.local 파일:
NEXT_PUBLIC_SUPABASE_URL=https://...
DATABASE_URL=postgresql://...

실행:
pnpm dev → http://localhost:3000

마이그레이션:
pnpm drizzle-kit migrate (수동)
```

### Vercel 프로덕션
```
Vercel 대시보드의 Environment Variables:
NEXT_PUBLIC_SUPABASE_URL=https://...
DATABASE_URL=postgresql://...

배포:
git push → 자동 배포

마이그레이션:
빌드 과정에 자동 포함
```

### GitHub Actions
```
.github/workflows/*.yml에서:
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}

GitHub Secrets에서 읽기:
DATABASE_URL=postgresql://...
```

---

## 비용 구조

### Vercel Hobby (무료)
```
포함 사항:
- 무제한 배포
- 월 100GB 대역폭
- SSL 인증서
- 자동 스케일링 (트래픽 증가 시)

제한 사항:
- 상용 용도 불가
- 도메인 필수 (vercel.app)
```

### Supabase Free
```
포함 사항:
- 500MB 데이터베이스
- 2GB 파일 스토리지
- 월 5GB 대역폭

우리 프로젝트:
- 공고 데이터: ~10MB
- 사용자 프로필: ~1MB
→ 여유 있음
```

---

## 배포 후 문제 발생 시

### 배포는 성공했는데 사이트가 보이지 않음
```
확인 사항:
1. Vercel 빌드 로그 확인
   → Deployment → Logs 탭
   
2. 에러 메시지 확인
   → 대부분 여기서 원인 파악 가능
   
3. 환경변수 확인
   → DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정됨?
   
4. Supabase 상태 확인
   → Supabase 대시보드에서 데이터베이스 실행 중?
```

### 배포는 되었는데 기능이 안 됨
```
원인 분석:
1. 로컬에서는 동작하나?
   → 로컬만 문제면 로컬 환경변수 확인
   
2. 프로덕션 환경변수가 로컬과 다른가?
   → Vercel Settings → Environment Variables 확인
   
3. 마이그레이션이 실패했나?
   → Vercel 빌드 로그에서 "drizzle-kit migrate" 부분 확인
```

---

## 핵심 학습 포인트

### ✅ 당신이 이해해야 할 것

1. **Vercel은 호스팅 회사**
   - 당신의 앱을 공개 인터넷에 올려주는 역할
   - GitHub과 자동 연동으로 배포 자동화

2. **환경변수는 비밀번호 같음**
   - 로컬 (.env.local) ≠ 프로덕션 (Vercel)
   - 각각 다른 값 설정 필요

3. **빌드 = 배포 준비**
   - 코드 컴파일 + 최적화
   - 마이그레이션도 빌드 과정에 포함

4. **배포는 자동이지만 문제 디버깅은 수동**
   - 로그를 꼭 확인하는 습관 필요

---

## 다음에 배울 것

- Preview Deployments (PR마다 자동 배포)
- 커스텀 도메인 연결
- 성능 모니터링 (Analytics)
- 환경 변수별 배포 전략 (staging vs production)
