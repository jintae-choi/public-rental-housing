/**
 * 매처 규칙 단위 테스트
 * - checkIncomeLimit: 경계값(±1원), null 필드, 가구원수 클램핑, 맞벌이 전용 버킷
 * - checkHouseholdType: 정확/부분 매칭, null 프로필, 조건 미존재
 *
 * 실행: pnpm test (node:test 사용, tsx 로더로 TS 직접 실행)
 *
 * 주의: 테스트 시점 오늘 날짜가 2026-04-10이므로 현재 income reference는 2025년 표가 선택됨
 * (2026 표가 아직 코드에 없기 때문 — 이건 의도된 상태)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkHouseholdType, checkIncomeLimit } from "./rules";
import type { MatchInput } from "./rules";
import {
  INCOME_REFERENCE_2025,
  getCurrentIncomeReference,
} from "./income-reference";
import type { eligibilityConditions } from "@/lib/db/schema";

type Condition = typeof eligibilityConditions.$inferSelect;

// 필드를 최소만 채운 스텁 — 나머지는 unknown 캐스트로 타입만 통과시킴
// MatchInput = userProfiles & profileScenarios 합산 타입이므로 두 쪽 필드 모두 Partial로 허용
function profile(overrides: Partial<MatchInput>): MatchInput {
  return overrides as unknown as MatchInput;
}
function condition(overrides: Partial<Condition>): Condition {
  return overrides as unknown as Condition;
}

// 테스트는 "현재 시점" reference를 쓰므로 2025 표와 일치해야 정합
const REF = getCurrentIncomeReference();
const BASE_3인 = REF.monthlyIncome100Percent[3];
const BASE_5인 = REF.monthlyIncome100Percent[5];
const BASE_7인 = REF.monthlyIncome100Percent[7];

// 사전 조건: 테스트는 2025 표를 기준으로 설계됨. 2026 표가 추가되면 이 assertion에서 실패 → 테스트 갱신 신호
assert.equal(REF.year, INCOME_REFERENCE_2025.year, "테스트가 가정한 소득 표 연도 불일치 — 테스트 갱신 필요");

describe("checkIncomeLimit", () => {
  it("조건이 null이면 null 반환 (평가 skip)", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: 1_000_000 }),
      condition({ incomeLimit: null })
    );
    assert.equal(r, null);
  });

  it("가구원수 미입력 → CHECK_NEEDED", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: null, monthlyIncome: 1_000_000 }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r?.result, "CHECK_NEEDED");
    assert.match(r!.reason, /가구원수/);
  });

  it("월소득 미입력 → CHECK_NEEDED", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: null }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r?.result, "CHECK_NEEDED");
    assert.match(r!.reason, /월소득/);
  });

  it("경계값: 월소득 == 한도 → ELIGIBLE (≤ 비교)", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: BASE_3인 }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("경계값: 월소득 = 한도 + 1원 → INELIGIBLE", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: BASE_3인 + 1 }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r?.result, "INELIGIBLE");
  });

  it("경계값: 월소득 = 한도 - 1원 → ELIGIBLE", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: BASE_3인 - 1 }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("비율 70%: 한도는 base * 0.7 floor — 경계 바로 아래 ELIGIBLE", () => {
    const limitWon = Math.floor((BASE_3인 * 70) / 100);
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: limitWon }),
      condition({ incomeLimit: { 전체: 70 } })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("비율 70%: 한도 + 1원 → INELIGIBLE", () => {
    const limitWon = Math.floor((BASE_3인 * 70) / 100);
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: limitWon + 1 }),
      condition({ incomeLimit: { 전체: 70 } })
    );
    assert.equal(r?.result, "INELIGIBLE");
  });

  it("3인이상 버킷: 가구원 5명도 3인이상으로 매칭, base는 5인 값 사용", () => {
    // pickPercentForHousehold는 "3인이상"을 percent로 반환하고, base는 가구원수(5)로 조회
    const limitWon = Math.floor((BASE_5인 * 100) / 100);
    const r = checkIncomeLimit(
      profile({ householdMembers: 5, monthlyIncome: limitWon }),
      condition({ incomeLimit: { "3인이상": 100 } })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("가구원수 10명은 7인 금액으로 클램핑", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 10, monthlyIncome: BASE_7인 }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r?.result, "ELIGIBLE");

    const r2 = checkIncomeLimit(
      profile({ householdMembers: 10, monthlyIncome: BASE_7인 + 1 }),
      condition({ incomeLimit: { 전체: 100 } })
    );
    assert.equal(r2?.result, "INELIGIBLE");
  });

  it("맞벌이 전용 버킷만 있으면 CHECK_NEEDED (v1은 맞벌이 미추적)", () => {
    const r = checkIncomeLimit(
      profile({ householdMembers: 3, monthlyIncome: 1_000_000 }),
      condition({ incomeLimit: { "맞벌이_3인이상": 120 } })
    );
    assert.equal(r?.result, "CHECK_NEEDED");
  });
});

describe("checkHouseholdType", () => {
  it("targetGroup도 householdType도 없으면 null (평가 skip)", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["청년"] }),
      condition({ targetGroup: null, householdType: null })
    );
    assert.equal(r, null);
  });

  it("프로필에 householdTypes 미입력 → CHECK_NEEDED", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: null }),
      condition({ targetGroup: "청년", householdType: null })
    );
    assert.equal(r?.result, "CHECK_NEEDED");
  });

  it("프로필에 빈 배열 → CHECK_NEEDED", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: [] }),
      condition({ targetGroup: "청년", householdType: null })
    );
    assert.equal(r?.result, "CHECK_NEEDED");
  });

  it("정확 매칭 → ELIGIBLE", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["청년"] }),
      condition({ targetGroup: "청년", householdType: null })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("부분 매칭: 조건 '신혼부부' ⊂ 프로필 '예비신혼부부' → ELIGIBLE", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["예비신혼부부"] }),
      condition({ targetGroup: null, householdType: ["신혼부부"] })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("부분 매칭 역방향: 조건 '예비신혼부부' ⊃ 프로필 '신혼부부' → ELIGIBLE", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["신혼부부"] }),
      condition({ targetGroup: null, householdType: ["예비신혼부부"] })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("매칭 없음 → INELIGIBLE", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["고령자"] }),
      condition({ targetGroup: "청년", householdType: null })
    );
    assert.equal(r?.result, "INELIGIBLE");
  });

  it("targetGroup + householdType 병존: 하나라도 매칭되면 ELIGIBLE", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["신혼부부"] }),
      condition({ targetGroup: "청년", householdType: ["신혼부부"] })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });

  it("다중 프로필 유형: 하나라도 매칭되면 ELIGIBLE (1인가구/예비신혼 동시 운영 전제)", () => {
    const r = checkHouseholdType(
      profile({ householdTypes: ["1인가구", "예비신혼부부"] }),
      condition({ targetGroup: null, householdType: ["신혼부부"] })
    );
    assert.equal(r?.result, "ELIGIBLE");
  });
});
