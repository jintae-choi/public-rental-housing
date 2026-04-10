/**
 * 개별 자격 규칙 평가 함수
 * 각 함수는 사용자 프로필과 공고 조건의 특정 필드 1개를 비교하여 RuleResult 반환
 *
 * 정책:
 * - 공고 조건이 null이면 해당 규칙은 평가하지 않음 (호출 측에서 skip)
 * - 사용자 프로필 값이 null/undefined면 INELIGIBLE이 아닌 CHECK_NEEDED 반환
 * - 명백히 위배되는 경우만 INELIGIBLE 반환 (보수적)
 */

import type { eligibilityConditions, profileScenarios, userProfiles } from "@/lib/db/schema";
import type { IncomeLimit } from "@/lib/analyzer/types";
import type { RuleResult } from "./types";
import {
  getBaseIncomeForHousehold,
  getCurrentIncomeReference,
  pickPercentForHousehold,
} from "./income-reference";

// user_profiles와 profile_scenarios를 합쳐 규칙 함수에 전달하는 통합 입력 타입
// - user 측: birthDate, homelessMonths, subscription*, address, interestedRegions 등
// - scenario 측: householdTypes, householdMembers, monthlyIncome, totalAssets, carValue, spouse* 등
export type MatchInput = typeof userProfiles.$inferSelect & typeof profileScenarios.$inferSelect;
type Condition = typeof eligibilityConditions.$inferSelect;

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────────

/**
 * 생년월일(YYYY-MM-DD)로부터 만 나이를 계산
 */
export function calcAge(birthDate: string | null, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  try {
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  } catch (err) {
    console.error("[calcAge] 나이 계산 오류:", err);
    return null;
  }
}

/**
 * 청약통장 가입일(YYYY-MM-DD)로부터 가입 개월 수 계산
 */
export function calcSubscriptionMonths(
  startDate: string | null,
  today: Date = new Date()
): number | null {
  if (!startDate) return null;
  try {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;
    const months =
      (today.getFullYear() - start.getFullYear()) * 12 +
      (today.getMonth() - start.getMonth());
    return Math.max(0, months);
  } catch (err) {
    console.error("[calcSubscriptionMonths] 가입기간 계산 오류:", err);
    return null;
  }
}

// ─── 개별 규칙 ────────────────────────────────────────────────────────────────

/**
 * 총자산 한도 비교 — 만원 단위
 */
export function checkAssetLimit(profile: MatchInput, condition: Condition): RuleResult | null {
  if (condition.assetLimit == null) return null;
  if (profile.totalAssets == null) {
    return {
      field: "assetLimit",
      result: "CHECK_NEEDED",
      reason: "프로필에 총자산이 입력되지 않음",
      conditionValue: condition.assetLimit,
    };
  }
  const ok = profile.totalAssets <= condition.assetLimit;
  return {
    field: "assetLimit",
    result: ok ? "ELIGIBLE" : "INELIGIBLE",
    reason: ok
      ? `총자산 ${profile.totalAssets}만원 ≤ 한도 ${condition.assetLimit}만원`
      : `총자산 ${profile.totalAssets}만원 > 한도 ${condition.assetLimit}만원`,
    conditionValue: condition.assetLimit,
    profileValue: profile.totalAssets,
  };
}

/**
 * 자동차 가액 한도 비교 — carLimit이 0이면 소유 불가 의미
 */
export function checkCarLimit(profile: MatchInput, condition: Condition): RuleResult | null {
  if (condition.carLimit == null) return null;

  if (profile.carValue == null) {
    return {
      field: "carLimit",
      result: "CHECK_NEEDED",
      reason: "프로필에 자동차 가액이 입력되지 않음",
      conditionValue: condition.carLimit,
    };
  }

  if (condition.carLimit === 0) {
    const ok = profile.carValue === 0;
    return {
      field: "carLimit",
      result: ok ? "ELIGIBLE" : "INELIGIBLE",
      reason: ok ? "자동차 미소유" : "자동차 소유 불가 조건이지만 자동차 보유 중",
      conditionValue: 0,
      profileValue: profile.carValue,
    };
  }

  const ok = profile.carValue <= condition.carLimit;
  return {
    field: "carLimit",
    result: ok ? "ELIGIBLE" : "INELIGIBLE",
    reason: ok
      ? `자동차가액 ${profile.carValue}만원 ≤ 한도 ${condition.carLimit}만원`
      : `자동차가액 ${profile.carValue}만원 > 한도 ${condition.carLimit}만원`,
    conditionValue: condition.carLimit,
    profileValue: profile.carValue,
  };
}

/**
 * 연령 범위 비교 (ageMin / ageMax)
 */
export function checkAgeRange(profile: MatchInput, condition: Condition): RuleResult | null {
  if (condition.ageMin == null && condition.ageMax == null) return null;

  const age = calcAge(profile.birthDate);
  if (age == null) {
    return {
      field: "ageRange",
      result: "CHECK_NEEDED",
      reason: "프로필에 생년월일이 입력되지 않음",
      conditionValue: { min: condition.ageMin, max: condition.ageMax },
    };
  }

  const tooYoung = condition.ageMin != null && age < condition.ageMin;
  const tooOld = condition.ageMax != null && age > condition.ageMax;

  if (tooYoung || tooOld) {
    return {
      field: "ageRange",
      result: "INELIGIBLE",
      reason: `만 ${age}세는 조건 범위(${condition.ageMin ?? "-"}~${condition.ageMax ?? "-"}세)를 벗어남`,
      conditionValue: { min: condition.ageMin, max: condition.ageMax },
      profileValue: age,
    };
  }

  return {
    field: "ageRange",
    result: "ELIGIBLE",
    reason: `만 ${age}세는 조건 범위(${condition.ageMin ?? "-"}~${condition.ageMax ?? "-"}세) 내`,
    conditionValue: { min: condition.ageMin, max: condition.ageMax },
    profileValue: age,
  };
}

/**
 * 무주택 기간 비교 (개월 단위)
 */
export function checkHomelessMonths(profile: MatchInput, condition: Condition): RuleResult | null {
  if (condition.homelessMonths == null) return null;
  if (profile.homelessMonths == null) {
    return {
      field: "homelessMonths",
      result: "CHECK_NEEDED",
      reason: "프로필에 무주택 기간이 입력되지 않음",
      conditionValue: condition.homelessMonths,
    };
  }
  const ok = profile.homelessMonths >= condition.homelessMonths;
  return {
    field: "homelessMonths",
    result: ok ? "ELIGIBLE" : "INELIGIBLE",
    reason: ok
      ? `무주택 ${profile.homelessMonths}개월 ≥ 요건 ${condition.homelessMonths}개월`
      : `무주택 ${profile.homelessMonths}개월 < 요건 ${condition.homelessMonths}개월`,
    conditionValue: condition.homelessMonths,
    profileValue: profile.homelessMonths,
  };
}

/**
 * 거주 지역 요건 비교 — 프로필의 주소/관심지역이 조건의 지역과 교집합 있는지 확인
 */
export function checkRegion(profile: MatchInput, condition: Condition): RuleResult | null {
  const required = condition.regionRequirement;
  if (!required || required.length === 0) return null;

  const candidates: string[] = [];
  if (profile.address) candidates.push(profile.address);
  if (profile.interestedRegions) candidates.push(...profile.interestedRegions);

  if (candidates.length === 0) {
    return {
      field: "regionRequirement",
      result: "CHECK_NEEDED",
      reason: "프로필에 주소/관심지역이 입력되지 않음",
      conditionValue: required,
    };
  }

  // 부분 문자열 매칭 (예: 조건 "시흥시" ⊂ 프로필 주소 "경기도 시흥시 ...")
  const matched = required.some((r) => candidates.some((c) => c.includes(r) || r.includes(c)));

  return {
    field: "regionRequirement",
    result: matched ? "ELIGIBLE" : "CHECK_NEEDED",
    reason: matched
      ? `요건 지역(${required.join(", ")}) 일치`
      : `요건 지역(${required.join(", ")})과 프로필 지역 불일치 — 이주 가능 여부 확인 필요`,
    conditionValue: required,
    profileValue: candidates,
  };
}

/**
 * 청약통장 가입기간 비교
 */
export function checkSubscriptionMonths(
  profile: MatchInput,
  condition: Condition
): RuleResult | null {
  if (condition.subscriptionMonths == null) return null;

  if (profile.subscriptionType === "NONE" || profile.subscriptionType == null) {
    return {
      field: "subscriptionMonths",
      result: profile.subscriptionType === "NONE" ? "INELIGIBLE" : "CHECK_NEEDED",
      reason:
        profile.subscriptionType === "NONE"
          ? "청약통장 미보유"
          : "프로필에 청약통장 정보가 입력되지 않음",
      conditionValue: condition.subscriptionMonths,
    };
  }

  const months = calcSubscriptionMonths(profile.subscriptionStart);
  if (months == null) {
    return {
      field: "subscriptionMonths",
      result: "CHECK_NEEDED",
      reason: "청약통장 가입일이 입력되지 않음",
      conditionValue: condition.subscriptionMonths,
    };
  }

  const ok = months >= condition.subscriptionMonths;
  return {
    field: "subscriptionMonths",
    result: ok ? "ELIGIBLE" : "INELIGIBLE",
    reason: ok
      ? `청약통장 ${months}개월 ≥ 요건 ${condition.subscriptionMonths}개월`
      : `청약통장 ${months}개월 < 요건 ${condition.subscriptionMonths}개월`,
    conditionValue: condition.subscriptionMonths,
    profileValue: months,
  };
}

/**
 * 청약통장 납입횟수 비교
 */
export function checkSubscriptionPayments(
  profile: MatchInput,
  condition: Condition
): RuleResult | null {
  if (condition.subscriptionPayments == null) return null;

  if (profile.subscriptionType === "NONE") {
    return {
      field: "subscriptionPayments",
      result: "INELIGIBLE",
      reason: "청약통장 미보유",
      conditionValue: condition.subscriptionPayments,
    };
  }
  if (profile.subscriptionPayments == null) {
    return {
      field: "subscriptionPayments",
      result: "CHECK_NEEDED",
      reason: "프로필에 청약통장 납입횟수가 입력되지 않음",
      conditionValue: condition.subscriptionPayments,
    };
  }

  const ok = profile.subscriptionPayments >= condition.subscriptionPayments;
  return {
    field: "subscriptionPayments",
    result: ok ? "ELIGIBLE" : "INELIGIBLE",
    reason: ok
      ? `납입 ${profile.subscriptionPayments}회 ≥ 요건 ${condition.subscriptionPayments}회`
      : `납입 ${profile.subscriptionPayments}회 < 요건 ${condition.subscriptionPayments}회`,
    conditionValue: condition.subscriptionPayments,
    profileValue: profile.subscriptionPayments,
  };
}

/**
 * 가구 유형 / 대상 그룹 비교
 * 조건의 targetGroup(단일) 또는 householdType(배열)이 프로필 householdTypes에 포함되는지
 */
export function checkHouseholdType(profile: MatchInput, condition: Condition): RuleResult | null {
  // 조건 측의 그룹 후보 모으기
  const groups: string[] = [];
  if (condition.targetGroup) groups.push(condition.targetGroup);
  if (condition.householdType) groups.push(...condition.householdType);

  if (groups.length === 0) return null;

  if (!profile.householdTypes || profile.householdTypes.length === 0) {
    return {
      field: "householdType",
      result: "CHECK_NEEDED",
      reason: "프로필에 가구 유형이 입력되지 않음",
      conditionValue: groups,
    };
  }

  // 부분 문자열 매칭 (예: 조건 "신혼부부" ⊂ 프로필 "예비신혼부부"는 매칭)
  const matched = groups.some((g) =>
    profile.householdTypes!.some((p) => p.includes(g) || g.includes(p))
  );

  return {
    field: "householdType",
    result: matched ? "ELIGIBLE" : "INELIGIBLE",
    reason: matched
      ? `가구 유형(${profile.householdTypes.join(", ")})이 대상(${groups.join(", ")})에 포함`
      : `가구 유형(${profile.householdTypes.join(", ")})이 대상(${groups.join(", ")})에 미포함`,
    conditionValue: groups,
    profileValue: profile.householdTypes,
  };
}

/**
 * 소득 한도 비교
 * 공고의 incomeLimit은 % 비율 → income-reference 표로 절대 금액 환산 후 비교
 *
 * 정책:
 * - 가구원수 미입력: CHECK_NEEDED
 * - 월소득 미입력: CHECK_NEEDED
 * - 매칭되는 비율 키 없음: CHECK_NEEDED
 * - 비교 가능: ELIGIBLE / INELIGIBLE
 *
 * 한계:
 * - 맞벌이 비율은 v1에서 무시 (프로필에 맞벌이 플래그 없음)
 * - 행복주택 청년·1인가구 가산(120%, 110%) 미반영
 * - 소득은 가구 합산이 원칙 → 프로필 폼에서 명확히 라벨링 필요
 */
export function checkIncomeLimit(profile: MatchInput, condition: Condition): RuleResult | null {
  if (!condition.incomeLimit) return null;
  const limit = condition.incomeLimit as IncomeLimit;

  if (profile.householdMembers == null) {
    return {
      field: "incomeLimit",
      result: "CHECK_NEEDED",
      reason: "프로필에 가구원수가 입력되지 않음",
      conditionValue: limit,
    };
  }
  if (profile.monthlyIncome == null) {
    return {
      field: "incomeLimit",
      result: "CHECK_NEEDED",
      reason: "프로필에 가구 월소득이 입력되지 않음",
      conditionValue: limit,
    };
  }

  const picked = pickPercentForHousehold(limit, profile.householdMembers);
  if (!picked) {
    return {
      field: "incomeLimit",
      result: "CHECK_NEEDED",
      reason: "공고의 소득 비율 표에서 가구원수에 맞는 항목을 찾지 못함 (맞벌이 조건만 존재 가능성)",
      conditionValue: limit,
      profileValue: { householdMembers: profile.householdMembers },
    };
  }

  const reference = getCurrentIncomeReference();
  const base = getBaseIncomeForHousehold(profile.householdMembers, reference);
  const limitWon = Math.floor((base * picked.percent) / 100);
  const ok = profile.monthlyIncome <= limitWon;

  return {
    field: "incomeLimit",
    result: ok ? "ELIGIBLE" : "INELIGIBLE",
    reason: ok
      ? `월소득 ${profile.monthlyIncome.toLocaleString()}원 ≤ 한도 ${limitWon.toLocaleString()}원 (${picked.bucket} ${picked.percent}%, ${reference.year}년 표)`
      : `월소득 ${profile.monthlyIncome.toLocaleString()}원 > 한도 ${limitWon.toLocaleString()}원 (${picked.bucket} ${picked.percent}%, ${reference.year}년 표)`,
    conditionValue: { percent: picked.percent, bucket: picked.bucket, limitWon },
    profileValue: profile.monthlyIncome,
  };
}
