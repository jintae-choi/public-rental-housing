/**
 * 자격 매칭 엔진 타입 정의
 * 사용자 프로필과 공고의 자격 조건을 비교하여 자격 여부를 산출
 */

// 매처 버전 — 규칙 변경 시 재매칭 트리거에 사용
export const MATCHER_VERSION = "1.0.0";

// 단일 결과 enum (DB의 eligibility_result enum과 일치)
export type MatchResult = "ELIGIBLE" | "CHECK_NEEDED" | "INELIGIBLE";

// 개별 규칙 평가 결과 — 어떤 필드에서 왜 이런 판정이 나왔는지 추적
export interface RuleResult {
  field: string;            // 비교한 필드명 (예: "assetLimit", "ageRange")
  result: MatchResult;
  reason: string;           // 사람이 읽을 수 있는 사유
  conditionValue?: unknown; // 공고 측 값
  profileValue?: unknown;   // 사용자 측 값
}

// 조건 1건에 대한 매칭 결과
export interface ConditionMatch {
  conditionId: string;
  targetGroup: string | null;
  result: MatchResult;
  rules: RuleResult[];
}

// 공고 1건에 대한 종합 매칭 결과 (저장 단위)
export interface AnnouncementMatch {
  userId: string;
  scenarioId: string;
  announcementId: string;
  bestResult: MatchResult;       // 조건들 중 가장 좋은 결과
  bestConditionId: string | null; // 가장 좋은 결과를 낸 조건 id
  conditionMatches: ConditionMatch[];
}
