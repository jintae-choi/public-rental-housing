/**
 * 공통 정규식 패턴 및 추출 헬퍼
 * PDF에서 추출한 텍스트는 공백이 불규칙하므로 \s* 패턴을 적극 활용
 */

import type { IncomeLimit, ParsedCondition } from "../types";

// ─── 정규식 상수 ───────────────────────────────────────────────────────────────

// 소득 비율: "월평균소득의 100%" or "월평균소득 120% 이하"
export const INCOME_PERCENT_RE = /월평균\s*소득[의]?\s*(\d+)\s*%/g;

// 자산 한도: "총자산 34,500만원" or "총 자산가액 합산기준 24,500만원"
export const ASSET_LIMIT_RE = /총\s*자산[가액합산기준\s]*\s*([\d,]+)\s*만\s*원/;

// 자동차: "자동차가액 4,542만원" or "자동차가액이 4,542만원" or "자동차 가액 4,542만원"
export const CAR_LIMIT_RE = /자동차\s*[가액이\s]*\s*([\d,]+)\s*만\s*원/;

// 자동차 소유 불가
export const CAR_PROHIBITED_RE = /자동차\s*소유\s*불가/;

// 연령: "만 19세 이상" or "만39세 이하"
export const AGE_RE = /만?\s*(\d+)\s*세\s*(이상|이하|미만)/g;

// 자녀 연령: "만 6세 이하 자녀" or "6세 이하 자녀(태아 포함)"
export const CHILD_AGE_RE = /만?\s*(\d+)\s*세\s*이하[의]?\s*자녀/;

// 혼인기간: "혼인기간 7년 이내" or "혼인기간이 10년 이내"
export const MARRIAGE_DURATION_RE = /혼인\s*기간[이]?\s*(\d+)\s*년\s*이내/;

// 거주지역: "시흥시에 거주하는" or "의정부시에 거주"
// 최소 3글자 이상의 행정구역명 + 접미사 패턴 (오탐 방지)
export const REGION_RE = /([가-힣]{2,}(?:특별자치도|특별시|광역시|시|군|구))\s*에\s*거주/g;

// 근로기간: "종사한 기간이 총 5년 이내"
export const WORK_DURATION_RE = /종사한\s*기간[이]?\s*총?\s*(\d+)\s*년\s*이내/;

// 최대 거주 기간: "최대 거주기간 10년"
export const MAX_RESIDENCE_RE = /최대\s*거주\s*기간[은]?\s*(\d+)\s*년/;

// 청약통장 가입기간: "가입기간이 6개월" or "6개월 이상 가입"
export const SUBSCRIPTION_MONTHS_RE =
  /(?:가입\s*기간[이]?\s*(\d+)\s*개월|(\d+)\s*개월\s*이상\s*가입)/;

// 청약통장 납입횟수: "납입횟수 6회" or "6회 이상 납입"
export const SUBSCRIPTION_PAYMENTS_RE =
  /(?:납입[인정]*\s*횟수[가]?\s*(\d+)\s*회|(\d+)\s*회\s*이상\s*납입)/;

// 가구원수 레이블: "1인", "2인", "3인 이상" 등
const HOUSEHOLD_SIZE_LABEL_RE =
  /(맞벌이\s*부부\s*)?([1-9]인(?:\s*이상)?)\s*(?:가구\s*)?[:-]?\s*(\d+)\s*%/g;

// ─── 헬퍼 함수 ────────────────────────────────────────────────────────────────

/**
 * "34,500" 형식의 문자열을 숫자로 변환
 * 쉼표 제거 후 정수 반환
 */
export function parseManwon(str: string): number {
  return parseInt(str.replace(/,/g, ""), 10);
}

/**
 * 텍스트에서 첫 번째 총자산 한도를 만원 단위로 추출
 */
export function extractAssetLimit(text: string): number | null {
  try {
    const match = ASSET_LIMIT_RE.exec(text);
    if (!match) return null;
    return parseManwon(match[1]);
  } catch (err) {
    console.error("[extractAssetLimit] 파싱 오류:", err);
    return null;
  }
}

/**
 * 텍스트에서 자동차 가액 한도를 만원 단위로 추출
 * 자동차 소유 불가인 경우 0 반환
 * 가액 패턴을 먼저 검사하여 '소유 불가' 뒤에 가액이 이어지는 경우 오탐 방지
 * (예: 행복주택 표 "자동차 소유 불가   4,542만원" 형식에서 4542 정상 추출)
 */
export function extractCarLimit(text: string): number | null {
  try {
    // 가액 패턴이 존재하면 우선 반환 (소유불가와 가액이 동시 존재하는 경우 가액 우선)
    const match = CAR_LIMIT_RE.exec(text);
    if (match) return parseManwon(match[1]);
    // 가액 패턴이 없을 때만 소유 불가 처리
    if (CAR_PROHIBITED_RE.test(text)) return 0;
    return null;
  } catch (err) {
    console.error("[extractCarLimit] 파싱 오류:", err);
    return null;
  }
}

/**
 * 텍스트에서 연령 범위(min/max)를 추출
 * "만 19세 이상 만 39세 이하" → { min: 19, max: 39 }
 */
export function extractAgeRange(
  text: string
): { min: number | null; max: number | null } {
  const result: { min: number | null; max: number | null } = {
    min: null,
    max: null,
  };
  try {
    const re = new RegExp(AGE_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const age = parseInt(match[1], 10);
      const qualifier = match[2];
      if (qualifier === "이상") result.min = age;
      else if (qualifier === "이하" || qualifier === "미만") result.max = age;
    }
  } catch (err) {
    console.error("[extractAgeRange] 파싱 오류:", err);
  }
  return result;
}

/**
 * 텍스트에서 자녀 최대 연령을 추출
 * "만 6세 이하 자녀" → 6
 */
export function extractChildAgeMax(text: string): number | null {
  try {
    const match = CHILD_AGE_RE.exec(text);
    if (!match) return null;
    return parseInt(match[1], 10);
  } catch (err) {
    console.error("[extractChildAgeMax] 파싱 오류:", err);
    return null;
  }
}

/**
 * 텍스트에서 혼인기간 조건 문자열을 추출
 * "혼인기간 7년 이내" → "혼인기간 7년 이내" (원문 그대로 반환)
 */
export function extractMarriageDuration(text: string): string | null {
  try {
    const match = MARRIAGE_DURATION_RE.exec(text);
    if (!match) return null;
    return match[0]; // 매칭된 원문 반환
  } catch (err) {
    console.error("[extractMarriageDuration] 파싱 오류:", err);
    return null;
  }
}

/**
 * 텍스트에서 근무 기간을 개월 수로 변환하여 추출
 * "종사한 기간이 총 5년 이내" → 60
 */
export function extractWorkDurationMonths(text: string): number | null {
  try {
    const match = WORK_DURATION_RE.exec(text);
    if (!match) return null;
    return parseInt(match[1], 10) * 12;
  } catch (err) {
    console.error("[extractWorkDurationMonths] 파싱 오류:", err);
    return null;
  }
}

/**
 * 텍스트에서 거주 지역 목록을 추출 (중복 제거)
 * "시흥시에 거주" → ["시흥시"]
 */
export function extractRegions(text: string): string[] {
  const regions = new Set<string>();
  try {
    const re = new RegExp(REGION_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const region = match[1];
      // "도" 단독은 오탐 (예: "있도" → "도"로 잘못 캡처 방지)
      if (region.length >= 2) {
        regions.add(region);
      }
    }
  } catch (err) {
    console.error("[extractRegions] 파싱 오류:", err);
  }
  return [...regions];
}

/**
 * 텍스트에서 청약통장 가입기간(개월) 및 납입횟수를 추출
 */
export function extractSubscription(
  text: string
): { months: number | null; payments: number | null } {
  const result: { months: number | null; payments: number | null } = {
    months: null,
    payments: null,
  };
  try {
    const monthsMatch = SUBSCRIPTION_MONTHS_RE.exec(text);
    if (monthsMatch) {
      result.months = parseInt(monthsMatch[1] ?? monthsMatch[2], 10);
    }
    const paymentsMatch = SUBSCRIPTION_PAYMENTS_RE.exec(text);
    if (paymentsMatch) {
      result.payments = parseInt(paymentsMatch[1] ?? paymentsMatch[2], 10);
    }
  } catch (err) {
    console.error("[extractSubscription] 파싱 오류:", err);
  }
  return result;
}

/**
 * 가구원수 레이블 근처의 소득 비율을 파싱하는 내부 함수
 * "맞벌이" 접두어 포함 여부에 따라 키를 구분
 */
function parseHouseholdIncomeLabels(text: string): IncomeLimit | null {
  const limit: IncomeLimit = {};
  const re = new RegExp(HOUSEHOLD_SIZE_LABEL_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const isDualIncome = !!match[1]; // 맞벌이 여부
    const sizeLabel = match[2].replace(/\s/g, ""); // "3인이상" 등 공백 제거
    const percent = parseInt(match[3], 10);
    const key = isDualIncome ? `맞벌이_${sizeLabel}` : sizeLabel;
    limit[key] = percent;
  }
  return Object.keys(limit).length > 0 ? limit : null;
}

/**
 * 텍스트에서 소득 기준을 추출
 * 가구원수별 소득 비율 매핑을 반환, 단일 비율이면 "전체" 키 사용
 */
export function extractIncomeLimit(text: string): IncomeLimit | null {
  try {
    // 1차 시도: 가구원수 레이블이 포함된 패턴
    const labeled = parseHouseholdIncomeLabels(text);
    if (labeled) return labeled;

    // 2차 시도: 단일 소득 비율만 존재하는 경우
    const re = new RegExp(INCOME_PERCENT_RE.source, "g");
    const percents: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      percents.push(parseInt(match[1], 10));
    }
    if (percents.length === 1) return { 전체: percents[0] };
    if (percents.length > 1) {
      // 레이블 없이 여러 값이 나열된 경우 — 첫 번째만 "전체"로 처리
      return { 전체: percents[0] };
    }
    return null;
  } catch (err) {
    console.error("[extractIncomeLimit] 파싱 오류:", err);
    return null;
  }
}

/**
 * 모든 필드가 null인 기본 ParsedCondition 객체를 생성
 */
export function createEmptyCondition(): ParsedCondition {
  return {
    targetGroup: null,
    priorityRank: null,
    incomeLimit: null,
    assetLimit: null,
    carLimit: null,
    ageMin: null,
    ageMax: null,
    childAgeMax: null,
    homelessMonths: null,
    regionRequirement: null,
    subscriptionMonths: null,
    subscriptionPayments: null,
    householdType: null,
    marriageCondition: null,
    workDurationMonths: null,
    maxResidenceYears: null,
    parentIncomeIncluded: null,
    scoringCriteria: null,
    specialConditions: null,
  };
}
