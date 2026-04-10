# Phase 1: 데이터 수집 파이프라인 — 실행 계획

> 작성일: 2026-04-08 | 이 문서는 Phase 1 작업 시 반드시 참조할 것

---

## 1. 아키텍처 결정 사항

### 크롤러 구조: 3개 → 2개

| 결정 | 마이홈을 메인 소스로, SH는 별도 크롤러. LH 별도 크롤러 불필요. |
|------|---|
| 이유 | 마이홈이 LH 공고를 ~100% 커버 (LH가 마이홈에 직접 등록, 당일 반영). 반면 SH 공고는 2022년 6월 이후 마이홈에 등록 없음. |

### 사이트별 기술 스택

| 사이트 | 방식 | Playwright 필요 | PDF 확보 |
|--------|------|:---:|------|
| **마이홈** | fetch POST (JSON API) | X | POST로 직접 다운로드 가능 |
| **SH** | fetch GET (SSR) | PDF만 | 이노릭스 플러그인이라 직접 다운 불가 → rawHtml 저장으로 대체 |

### data.go.kr 공식 API (승인 완료, 2026-04-09)

| # | API 서비스명 | 엔드포인트 | 용도 | 트래픽 |
|---|---|---|---|---|
| 1 | 국토교통부_마이홈포털 공공주택 모집공고 조회 서비스 | `HWSPR02/rsdtRcritNtcList` | 신규 공고 감지 트리거 | 일 1,000건 |
| 2 | 한국토지주택공사_분양임대공고문 조회 서비스 | `B552555/lhLeaseNoticeInfo1` | LH 공고 목록 | 일 10,000건 |
| 3 | 한국토지주택공사_분양임대공고별 상세정보 조회 서비스 | `B552555/lhLeaseNoticeDtlInfo1` | LH 공고 상세 (일정, 단지) | 일 10,000건 |
| 4 | 한국토지주택공사_분양임대공고별 상세정보 조회 서비스 (사전청약) | `B552555/lhLeaseNoticeBfhDtlInfo1` | 사전청약 공고 상세 | 일 10,000건 |
| 5 | 한국토지주택공사_분양임대공고별 공급정보 조회 서비스 | `B552555/lhLeaseNoticeSplInfo1` | 주택형, 면적, 가격 | 일 10,000건 |

- 공통 Base URL: `https://apis.data.go.kr/`
- API 키: `.env.local`의 `DATA_GO_KR_API_KEY` (Decoding 키 사용)
- 활용기간: 2026-04-09 ~ 2028-04-09
- SH는 data.go.kr API 없음 → 크롤링으로 커버

---

## 2. 사이트별 크롤링 상세

### 마이홈 (메인)

- **목록 API**: `POST /hws/portal/sch/selectRsdtRcritNtcList.do`
  - 응답: JSON (`resultCnt` + `resultList[]`)
  - 필수 파라미터: `lfstsTyAt=N`
  - 주요 필드: `pblancId`, `atchFileId`, `suplyInsttNm`, `prgrStts`, `rcritPblancDe`
- **상세 페이지**: `GET /hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId={id}`
  - 세션/로그인 불필요
- **PDF 다운로드**: `POST /hws/com/fms/cvplFileDownload.do`
  - 파라미터: `atchFileId` (목록 API에서 획득) + `fileSn=1`
- **robots.txt**: 전면 허용
- **NetFunnel**: 래핑 있으나 서버측 검증 없음, 직접 POST 가능

### SH (별도)

- **목록**: `GET /main/lay2/program/S1T294C297/www/brd/m_247/list.do?multi_itm_seq=2&page={n}`
  - SSR — HTML 직접 파싱 가능
- **상세**: `GET .../view.do?seq={n}&multi_itm_seq=2&page=1`
  - 로그인 불필요, GET 직접 접근 가능
- **PDF**: 이노릭스(Innorix) ActiveX 기반 → HTTP 직접 다운로드 불가
  - 대안: 상세페이지 rawHtml 저장 → Phase 2에서 HTML 기반 파싱
  - 파일 메타정보는 HTML 내 JSON으로 포함 (`initParam.downList`)
- **robots.txt**: `User-agent: *` 기준 공고 경로 허용, 단 ClaudeBot 전체 차단
  - Playwright 사용 시 일반 브라우저 User-Agent 설정 필요

---

## 3. 실행 단계

```
Step 0: 환경 세팅
  ├─ 의존성 설치 (pdfjs-dist, playwright)
  └─ Hooks 설정 → afterWrite: tsc --noEmit, afterEdit: eslint

Step 1: 공통 기반 코드 (순차)
  ├─ src/lib/scraper/types.ts     크롤러 공통 인터페이스 (초안, optional 필드 관대하게)
  ├─ src/lib/scraper/base.ts      Playwright 브라우저 관리, PDF 추출 유틸
  └─ src/lib/db/queries/announcement.ts  upsert + 중복/변경 감지

Step 2: 크롤러 2개 병렬 (Agent 동시)
  ├─ Agent A (sonnet): 마이홈 크롤러 → src/lib/scraper/myhome.ts
  └─ Agent B (sonnet): SH 크롤러 → src/lib/scraper/sh.ts
  ⚡ Hooks로 tsc+eslint 자동 실행, 에러 시 Agent 내장 루프로 자동 수정

Step 2.5: PDF 검증 에이전트
  ├─ 마이홈 크롤러로 실제 공고 3~5건 크롤링
  ├─ 추출된 pdfText + SH rawHtml 분석
  ├─ 스키마 갭 확인 (예: children_count, priority_rank 등 누락 필드)
  └─ 필요시 스키마 마이그레이션 추가

Step 3: 통합 + 마무리
  ├─ scripts/scrape.ts (메인 실행 스크립트)
  ├─ .github/workflows/scrape.yml 업데이트
  ├─ /simplify 스킬로 전체 코드 리뷰
  └─ 로컬 테스트 실행
```

---

## 4. 주요 리스크 및 대응

| 리스크 | 심각도 | 대응 |
|--------|:---:|------|
| PDF 텍스트 추출 품질 (HWP 출력물) | 높음 | pdfjs-dist 채택, Step 2.5에서 품질 검증. 안 되면 좌표 기반 파싱 |
| SH PDF 다운로드 불가 (이노릭스) | 중간 | rawHtml 저장으로 우회. 상세페이지 HTML에 충분한 정보 포함 여부 Step 2.5에서 검증 |
| GitHub Actions IP 차단 | 낮음 | 요청 간 2~5초 delay, 일 1~2회만 실행, User-Agent 설정 |
| 스키마에 없는 자격조건 필드 | 중간 | Step 2.5 PDF 검증에서 발견 → 마이그레이션 추가 |

---

## 5. 품질 보장 장치

### Hooks (자동 검증)

Step 0에서 `/update-config` 스킬로 설정. 이후 모든 Step에서 Write/Edit 도구 사용 시 자동 실행됨.

```jsonc
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm tsc --noEmit"
          }
        ]
      }
    ]
  }
}
```

- hook이 exit code 2를 반환하면 → 실행 차단 + stderr가 Claude에 피드백 → Claude가 에러를 보고 수정 시도
- exit code 0이 아닌 다른 코드 → 경고만, 실행 계속
- "자동 수정"이 아니라 "피드백 기반 수정 유도"임에 주의

### Sub-agent 리뷰 (Step 2.5 PDF 검증)

크롤러 구현 완료 후, 검증 전용 Agent를 실행:

```
검증 Agent 입력: 실제 크롤링된 pdfText 3~5건 + SH rawHtml
검증 Agent 출력:
  1. PDF에 있는데 DB 스키마(eligibility_conditions)에 없는 필드 목록
     예: "다자녀 우선공급 3자녀 이상" → children_min 필드 필요
     예: "1순위 우선공급" → priority_rank 필드 필요
  2. PDF 텍스트 추출 품질 평가 (표 깨짐 여부)
  3. SH rawHtml에서 자격조건 추출 가능 여부
  4. 스키마 수정 권장사항 (마이그레이션 필요 여부)
```

→ 이 결과를 반영한 뒤 Step 3으로 진행

### Step 2.5 검증 결과 (2026-04-09 실행)

**마이홈 크롤러 재설계**: HTTP fetch POST → Playwright 기반으로 전환.
마이홈 API가 NetFunnel을 서버 측에서도 검증하여 HTTP 903 반환. Playwright로 `fnSearch()` 호출 후 DOM 추출 방식으로 변경.
- 상세 페이지의 `fnDownFile('atchFileId', 'fileSn')` 패턴으로 PDF 파일 ID 획득
- 브라우저 컨텍스트 내 `fetch()`로 PDF 다운로드 (세션 쿠키 자동 포함)

**PDF 추출 품질**: 양호. 5건 모두 성공 (26K~110K 글자). 표가 연속 텍스트로 추출되나 패턴 매칭 가능.

**스키마 갭 → 마이그레이션 추가** (`0001_sharp_namor.sql`):
- `priority_rank` — 1순위/2순위/3순위별 차등 기준
- `child_age_max` — 자녀 연령 상한 (6세, 9세 등)
- `work_duration_months` — 근무기간 조건 (사회초년생)
- `max_residence_years` — 최대 거주기간
- `parent_income_included` — 부모 소득 합산 여부
- `scoring_criteria` (jsonb) — 가점/배점 항목

### /simplify 코드 리뷰 (Step 3 마무리)

Step 3에서 통합 완료 후 `/simplify` 스킬 실행:
- 크롤러 간 중복 코드 확인
- 에러 핸들링 누락 확인
- 재사용 가능한 유틸 추출 제안

---

## 6. 인터페이스 설계 원칙

```typescript
// 필수: 이것 없으면 저장 의미 없음
externalId: string;   // 기관별 고유번호
source: "SH" | "LH" | "MYHOME";
title: string;
detailUrl: string;

// 나머지 전부 optional: 사이트가 제공하면 채우고 아니면 null
// → 사이트마다 제공 데이터가 다르므로

// 원본 보존 (보험): 구조화 실패해도 Phase 2에서 복구 가능
pdfText?: string;     // PDF 원문 전체
rawHtml?: string;     // 상세페이지 HTML 전체
```
