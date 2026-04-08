# 🗄️ Supabase 완벽 이해

## Supabase란?

### 정의
**관리형 PostgreSQL 데이터베이스 + 인증 + 실시간 기능을 제공하는 서비스**

### 일상의 비유
```
Supabase = Google Docs의 데이터 버전

Google Docs:
- 문서 작성 + 자동 저장 + 실시간 공동 편집

Supabase:
- 데이터베이스 + 자동 관리 + 실시간 동기화 + 인증
```

---

## 당신이 한 설정

### 1️⃣ Supabase 프로젝트 생성
```
Supabase 대시보드 → "New Project"
    ↓
프로젝트 생성 (이름, 지역 선택)
    ↓
데이터베이스 초기화 (PostgreSQL 자동 생성)
    ↓
Connection String 발급 (데이터베이스 연결 정보)
```

### 2️⃣ Connection String 복사
```
Supabase 제공:
postgresql://postgres:!ptmajvm1246@db.jpqchzuxfrbongvhxdax.supabase.co:5432/postgres

↓ 분석 ↓

postgresql:// = 프로토콜 (PostgreSQL 사용)
postgres = 사용자명
!ptmajvm1246 = 비밀번호
db.jpqchzuxfrbongvhxdax.supabase.co = 서버 주소
5432 = 포트 번호
postgres = 기본 데이터베이스

이 정보로 당신의 앱이 Supabase 데이터베이스에 접근!
```

---

## PostgreSQL이란?

### 정의
**무료 오픈소스 관계형 데이터베이스**

### 데이터 구조
```
PostgreSQL (전체 서버)
  ├── postgres (기본 데이터베이스)
  │   ├── announcements (테이블)
  │   │   ├── id (행)
  │   │   ├── title
  │   │   └── status
  │   ├── user_profiles (테이블)
  │   └── ...
  └── (다른 데이터베이스들)
```

### 테이블 = 엑셀 시트
```
announcements 테이블:

| id  | title          | status | region |
|-----|----------------|--------|--------|
| 001 | 서울시 국민임대 | OPEN   | 서울   |
| 002 | 부산시 행복주택 | CLOSED | 부산   |
| 003 | 인천시 매입임대 | OPEN   | 인천   |
```

---

## Drizzle ORM (타입안전 쿼리)

### 문제점: 직접 SQL 쓸 때
```sql
SELECT * FROM announcements WHERE status = 'OPEN'
```

**문제**:
- 테이블 이름 오타 → 런타임 에러
- 컬럼 이름 오타 → 런타임 에러
- 데이터 타입 불일치 → 런타임 에러
- 자동완성 없음

### 해결책: Drizzle ORM (TypeScript)
```typescript
const results = await db.query.announcements.findMany({
  where: eq(announcements.status, 'OPEN')
})
```

**장점**:
- 컴파일 타임에 에러 감지 (코드 작성 중)
- 자동완성 제공
- 타입 안전

---

## 당신의 데이터베이스 스키마

### 제가 생성한 5개 테이블

#### 1️⃣ announcements (공고)
```
공고의 기본 정보 저장

예시 행:
- id: 550e8400-e29b-41d4-a716-446655440000
- external_id: "SH_2024_001" (기관별 고유번호)
- source: "SH" (어디서 수집했는지)
- title: "서울시 국민임대주택 공급"
- status: "OPEN" (모집 중)
- region: "서울"
- district: "강남구"
- application_start: 2024-04-01
- application_end: 2024-04-30
- pdf_text: "PDF에서 추출한 전체 텍스트"
```

#### 2️⃣ eligibility_conditions (자격 조건)
```
각 공고의 자격 조건 파싱 결과

예시 행:
- id: ...
- announcement_id: 550e8400... (어느 공고인지)
- target_group: "1인 가구"
- income_limit: {"percent": 100, "base": "도시근로자"}
- asset_limit: 150000000 (1억 5천만원)
- age_min: 18
- age_max: null (제한없음)
```

#### 3️⃣ user_profiles (사용자 프로필)
```
사용자의 자격 정보

예시 행:
- id: ...
- user_id: (Supabase Auth 사용자 ID)
- name: "김철수"
- birth_date: 1990-05-15
- monthly_income: 3500000 (세전 월평균 소득)
- total_assets: 100000000 (보유 자산)
- interested_regions: ["서울", "경기"]
- notification_enabled: true
```

#### 4️⃣ eligibility_results (매칭 결과)
```
사용자와 공고의 자격 매칭 결과

예시 행:
- id: ...
- user_id: ...
- announcement_id: ...
- result: "ELIGIBLE" (자격 있음)
- details: {"income": "충족", "asset": "충족", "age": "초과"}
```

#### 5️⃣ notifications (알림)
```
사용자에게 보낸 알림 기록

예시 행:
- id: ...
- user_id: ...
- announcement_id: ...
- type: "NEW_ANNOUNCEMENT"
- channel: "EMAIL"
- status: "SENT"
- sent_at: 2024-04-01 14:30:00
```

---

## 마이그레이션 (스키마 변경)

### 개념
```
"데이터베이스 구조를 코드로 버전 관리하는 것"

마이그레이션 파일 = 데이터베이스 변경 스크립트
```

### 당신의 마이그레이션 파일
```
drizzle/0000_adorable_payback.sql

이 파일은:
1. 10개의 ENUM 타입 생성
2. 5개의 테이블 생성
3. 외래키 관계 설정

한 번 실행하면 데이터베이스 구조가 완성됨
```

### 마이그레이션이 필요한 이유

```
✅ 좋은 방법 (마이그레이션):
스키마 변경 → 파일로 기록 → Git에 저장
누구든 같은 스크립트로 동일한 DB 재현 가능

❌ 나쁜 방법:
"대시보드에서 손으로 테이블 추가"
→ 변경 내용 기록 없음
→ 다른 개발자는 뭘 했는지 모름
→ 실수로 안 하면 프로덕션 장애
```

---

## 보안: 세 가지 키

### 당신이 `.env.local`에 저장한 값들

#### 1️⃣ NEXT_PUBLIC_SUPABASE_URL
```
노출되어도 괜찮음 (공개 정보)

프론트엔드 코드에서 사용:
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, ...)
```

#### 2️⃣ NEXT_PUBLIC_SUPABASE_ANON_KEY
```
노출되어도 괜찮음 (제한된 권한)

무명(익명) 사용자용 키
읽기만 가능, 개인정보는 RLS로 보호
```

#### 3️⃣ SUPABASE_SERVICE_ROLE_KEY ⚠️
```
🔐 매우 민감함 - 절대 노출 금지!

완전한 권한 (CRUD 모두 가능)
서버에서만 사용 (environment variables)

이 키가 노출되면:
→ 누구든 모든 데이터 접근/수정/삭제 가능
→ 개인정보 대량 유출
→ 서비스 마비
```

#### 4️⃣ DATABASE_URL
```
🔐 매우 민감함 - 절대 노출 금지!

데이터베이스 직접 접근 권한
비밀번호 포함됨

이 URL이 노출되면:
→ 해커가 데이터베이스에 직접 접근
→ 모든 데이터 탈취 가능
```

### 보안 체계

```
로컬 개발:
.env.local (당신의 컴퓨터에만 있음)
↓
.gitignore에 포함되어 GitHub에 올라가지 않음

프로덕션 (Vercel):
환경변수 설정 (Vercel 대시보드)
↓
암호화되어 저장
↓
배포 시에만 서버에서 사용
↓
GitHub Actions도 secrets로 접근
```

---

## 실제 데이터 흐름

### 사용자가 "부산 임대주택" 검색할 때

```
1. 사용자가 검색 클릭
   ↓
2. Next.js 프론트엔드가 Supabase에 쿼리
   SELECT * FROM announcements 
   WHERE region = '부산'
   ↓
3. Supabase (PostgreSQL)이 데이터 조회
   ↓
4. 결과를 JSON으로 반환
   ↓
5. 프론트엔드가 화면에 표시
```

---

## 핵심 학습 포인트

### ✅ 당신이 이해해야 할 것

1. **테이블 관계**
   - announcements와 eligibility_conditions는 1:N 관계
   - user_profiles와 eligibility_results는 1:N 관계

2. **NULL vs Default Value**
   - `NULL` = 값이 없음 (선택사항)
   - `DEFAULT` = 값을 지정하지 않으면 자동으로 설정

3. **UUID vs Integer ID**
   - UUID = 세계적으로 고유 (분산 시스템에 유리)
   - Integer = 간단하지만 충돌 위험

---

## 다음에 배울 것

- Supabase 실시간 리스닝 (Real-time)
- Row Level Security (RLS) - 행 단위 권한 관리
- PostgreSQL 쿼리 최적화
