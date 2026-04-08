# 배포 가이드

## Vercel 배포 설정

### 1단계: GitHub 저장소 연결
1. https://vercel.com 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 선택: `jintae-choi/public-rental-housing`
4. "Import" 클릭

### 2단계: 환경변수 설정
Vercel 프로젝트 설정 → **Settings** → **Environment Variables**에 다음을 추가:

```
NEXT_PUBLIC_SUPABASE_URL=https://jpqchzuxfrbongvhxdax.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.jpqchzuxfrbongvhxdax.supabase.co:5432/postgres
```

### 3단계: GitHub 시크릿 설정
GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**에 다음을 추가:

```
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.jpqchzuxfrbongvhxdax.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://jpqchzuxfrbongvhxdax.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

## 배포 자동화 워크플로우

### main 브랜치 푸시 시
1. `drizzle/**` 또는 `src/lib/db/schema.ts` 변경 → 마이그레이션 자동 실행
2. Vercel 자동 배포 (merkel 마이그레이션 포함)

### 일일 자동 크롤링
- 매일 05:00 UTC (한국시간 14:00) 자동 실행
- GitHub Actions → scrape.yml

## 로컬 개발

```bash
# 환경변수 설정
cp .env.local.example .env.local
# DATABASE_URL 등을 Supabase 값으로 채우기

# 개발 서버 시작
pnpm dev

# 필요시 마이그레이션 수동 실행
pnpm drizzle-kit migrate
```
