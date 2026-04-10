/**
 * 자격 매칭 엔진 공개 API
 * 사용자 프로필과 공고의 자격 조건을 비교하여 결과를 산출하고 DB에 저장
 */

import type { eligibilityConditions } from "@/lib/db/schema";
import type {
  AnnouncementMatch,
  ConditionMatch,
  MatchResult,
  RuleResult,
} from "./types";
import { MATCHER_VERSION } from "./types";
import {
  checkAgeRange,
  checkAssetLimit,
  checkCarLimit,
  checkHomelessMonths,
  checkHouseholdType,
  checkIncomeLimit,
  checkRegion,
  checkSubscriptionMonths,
  checkSubscriptionPayments,
} from "./rules";
import type { MatchInput } from "./rules";

type Condition = typeof eligibilityConditions.$inferSelect;

// 결과 우선순위 — 좋음 → 나쁨
const RESULT_RANK: Record<MatchResult, number> = {
  ELIGIBLE: 0,
  CHECK_NEEDED: 1,
  INELIGIBLE: 2,
};

/**
 * 여러 RuleResult를 종합하여 단일 결과 산출
 * - 하나라도 INELIGIBLE → INELIGIBLE
 * - 하나라도 CHECK_NEEDED → CHECK_NEEDED
 * - 전부 ELIGIBLE → ELIGIBLE
 * - 평가된 규칙이 없으면 → CHECK_NEEDED (정보 부족)
 */
export function aggregateRules(rules: RuleResult[]): MatchResult {
  if (rules.length === 0) return "CHECK_NEEDED";
  let worst: MatchResult = "ELIGIBLE";
  for (const r of rules) {
    if (RESULT_RANK[r.result] > RESULT_RANK[worst]) worst = r.result;
  }
  return worst;
}

/**
 * 두 결과 중 더 좋은 쪽 반환
 */
function bestOf(a: MatchResult, b: MatchResult): MatchResult {
  return RESULT_RANK[a] <= RESULT_RANK[b] ? a : b;
}

/**
 * 조건 1건에 대해 사용자 입력을 매칭 (user + scenario merged)
 */
export function matchCondition(profile: MatchInput, condition: Condition): ConditionMatch {
  const checkers = [
    checkHouseholdType,
    checkAgeRange,
    checkAssetLimit,
    checkCarLimit,
    checkIncomeLimit,
    checkHomelessMonths,
    checkRegion,
    checkSubscriptionMonths,
    checkSubscriptionPayments,
  ];

  const rules: RuleResult[] = [];
  for (const checker of checkers) {
    const result = checker(profile, condition);
    if (result) rules.push(result);
  }

  return {
    conditionId: condition.id,
    targetGroup: condition.targetGroup,
    result: aggregateRules(rules),
    rules,
  };
}

/**
 * 공고 1건의 모든 조건에 대해 매칭 후 가장 좋은 결과 산출
 * conditions가 비어있으면 CHECK_NEEDED 반환
 */
export function matchAnnouncement(
  userId: string,
  scenarioId: string,
  announcementId: string,
  profile: MatchInput,
  conditions: Condition[]
): AnnouncementMatch {
  if (conditions.length === 0) {
    return {
      userId,
      scenarioId,
      announcementId,
      bestResult: "CHECK_NEEDED",
      bestConditionId: null,
      conditionMatches: [],
    };
  }

  const conditionMatches = conditions.map((c) => matchCondition(profile, c));

  let bestResult: MatchResult = "INELIGIBLE";
  let bestConditionId: string | null = null;
  for (const cm of conditionMatches) {
    const newBest = bestOf(bestResult, cm.result);
    if (newBest !== bestResult || bestConditionId === null) {
      bestResult = newBest;
      if (cm.result === bestResult) bestConditionId = cm.conditionId;
    }
  }

  return {
    userId,
    scenarioId,
    announcementId,
    bestResult,
    bestConditionId,
    conditionMatches,
  };
}

export { MATCHER_VERSION } from "./types";
export type {
  AnnouncementMatch,
  ConditionMatch,
  MatchResult,
  RuleResult,
} from "./types";
export type { MatchInput } from "./rules";
