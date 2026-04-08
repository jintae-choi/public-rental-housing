# 🌳 Git & GitHub 완벽 이해

## Git이란?

### 정의
**버전 관리 시스템(Version Control System)**
- 코드의 모든 변경 이력을 기록
- 누가, 언제, 무엇을, 왜 변경했는지 추적
- 과거 버전으로 언제든 돌아갈 수 있음

### 일상의 비유
```
Google Docs의 "버전 히스토리" 기능을 생각해보세요.
- 매번 저장할 때마다 스냅샷 생성
- 누가 수정했는지 기록
- 이전 버전으로 복원 가능

Git은 코드 버전의 "Google Docs 버전 히스토리"입니다.
```

---

## GitHub란?

### 정의
**Git을 위한 클라우드 호스팅 서비스**
- Git 저장소를 인터넷에 저장
- 여러 개발자가 함께 작업 가능
- 코드 리뷰, 이슈 추적, 자동화 가능

### Git vs GitHub
| 구분 | Git | GitHub |
|------|-----|--------|
| **무엇** | 버전 관리 프로그램 | Git을 위한 웹 서비스 |
| **설치** | 컴퓨터에 설치 | 온라인, 가입만 하면 됨 |
| **기능** | 코드 변경 기록 | 협업, 자동화, 이슈 관리 |
| **비유** | 카메라 | 사진 공유 SNS |

---

## 당신이 한 설정

### 1️⃣ GitHub 저장소 생성
```
이미 되어있음: jintae-choi/public-rental-housing
```

### 2️⃣ Personal Access Token (PAT)
**생성한 이유**: 컴퓨터에서 GitHub로 코드를 업로드할 때 비밀번호 대신 사용

```
자신 확인 과정:
로컬 컴퓨터 --[PAT로 인증]--> GitHub
                   ↓
                   "이 사람이 맞다" 인증
                   ↓
                   코드 업로드 허용
```

**workflow scope 추가한 이유**: GitHub Actions 워크플로우 파일을 생성/수정할 수 있는 권한

---

## 당신이 한 Git 작업 (내가 자동화)

### Git의 주요 명령어

```bash
# 1. 변경사항 스테이징 (어떤 파일을 커밋할지 선택)
git add -A

# 2. 커밋 (변경사항을 기록)
git commit -m "커밋 메시지"

# 3. GitHub에 업로드
git push origin main
```

### 당신 프로젝트의 커밋 흐름

```
로컬에서 코드 변경
    ↓
git add -A (변경된 파일들 선택)
    ↓
git commit (메시지와 함께 스냅샷 저장)
    ↓
git push (GitHub에 업로드)
    ↓
GitHub에 반영됨
    ↓
GitHub Actions가 자동으로 감지 후 배포 시작
```

---

## GitHub Actions (자동화의 마법)

### 개념
**특정 이벤트 발생 시 자동으로 코드를 실행하는 서비스**

### 당신의 설정

#### 1️⃣ 배포 자동화 (migrate.yml)
```
트리거: git push로 main에 병합
        AND drizzle/** 또는 schema.ts 변경
    ↓
자동 실행:
  1. 저장소 코드 다운로드
  2. 의존성 설치
  3. DB 마이그레이션 실행
  4. 배포 완료
```

#### 2️⃣ 일일 크롤링 자동화 (scrape.yml)
```
트리거: 매일 05:00 UTC (한국시간 14:00)
    ↓
자동 실행:
  1. SH/LH/마이홈에서 새 공고 수집
  2. 자격 조건 분석
  3. 데이터베이스에 저장
```

---

## 보안: Personal Access Token

### 왜 PAT를 사용하나?

```
❌ 나쁜 방법:
git push 할 때마다 GitHub 비밀번호 입력
→ 비밀번호 노출 위험

✅ 좋은 방법:
PAT 토큰 사용 (일회용, 제한된 권한)
→ 비밀번호는 안전, 토큰만 노출되도 안전
```

### 당신이 한 설정

```
GitHub 토큰 생성 → workflow scope 추가

scope란?
"이 토큰으로 뭘 할 수 있는가"의 권한 범위

workflow scope = "GitHub Actions 워크플로우 파일을 다룰 수 있다"
```

---

## 실전: 코드 변경 → 배포까지의 흐름

### 당신이 Phase 1에서 크롤러 코드를 작성했을 때:

```
1️⃣ VSCode에서 코드 수정
   src/lib/scraper/sh.ts 작성

2️⃣ 터미널에서 커밋
   git add src/lib/scraper/
   git commit -m "feat: SH 크롤러 구현"

3️⃣ GitHub로 업로드
   git push origin main

4️⃣ GitHub에서 자동 감지
   "새 커밋이 main에 들어왔다!"
   
5️⃣ GitHub Actions 시작
   - 코드 빌드
   - 테스트 실행
   - Vercel로 배포 신호 전송

6️⃣ Vercel에서 배포
   - 최신 코드 받음
   - Next.js 빌드
   - 서버에 배포
   - DB 마이그레이션 실행

7️⃣ 완료!
   사용자들이 새로운 크롤러로 공고를 받음
```

---

## 핵심 학습 포인트

### ✅ 당신이 이해해야 할 것

1. **커밋 메시지 규칙**
   ```
   <타입>: <한국어 설명>
   
   예: feat: SH 크롤러 구현
       fix: 중복 공고 필터링 버그 수정
       docs: README 업데이트
   ```

2. **main 브랜치 = 프로덕션**
   - main에 푸시 = 자동 배포됨
   - 항상 안정적인 코드만 푸시

3. **GitHub Actions Secrets**
   - 환경변수는 GitHub 웹에 저장
   - 코드에 직접 쓰면 안 됨 (보안 위험)

---

## 다음에 배울 것

- Feature branch 전략 (main 보호)
- Pull Request (코드 리뷰)
- 충돌 해결 (merge conflicts)
