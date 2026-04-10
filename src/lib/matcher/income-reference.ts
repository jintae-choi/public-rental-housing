/**
 * 도시근로자 가구당 월평균소득 기준 표
 *
 * 공공임대주택 공고는 자격을 "월평균소득의 N% 이하" 비율로 표기하므로,
 * 매칭하려면 100% 기준 절대 금액 표가 필요함.
 *
 * 갱신 정책:
 * - 통계청이 매년 가계동향조사 결과를 발표 → 국토부가 공공주택 공고에 인용
 * - 통상 매년 3월경 새 표가 LH/마이홈 페이지에 반영됨
 * - 공식 OpenAPI 없음 → 매년 수동 갱신 필요 (assertReferenceFresh가 만료 시 경고)
 *
 * 주의사항:
 * - 통계청 원자료는 "3인 이하 가구"를 단일값으로 발표 → 1·2·3인은 동일 금액 처리가 표준
 * - 행복주택 청년·1인가구는 1인 120%, 2인 110% 가산이 별도 적용 (현재 미반영)
 * - 신혼부부 특별공급은 외벌이 100%, 맞벌이 120% 기본선
 * - 모두 세전 금액, 비과세 제외
 * - 가구원수: 신청자 + 배우자 + 직계존비속(동일세대 기준) + 태아
 */

import type { IncomeLimit } from "@/lib/analyzer/types";

export interface IncomeReference {
  year: number;
  source: string;
  appliedFrom: string;       // YYYY-MM-DD (해당 표의 적용 시작일)
  monthlyIncome100Percent: Record<number, number>; // 가구원수 → 100% 금액(원/월)
}

// 출처: LH청약플러스 — 국민임대 소득기준
//   https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1144&cntntsId=1023
// 교차검증: LH청약플러스 — 행복주택 입주자격 (3~7인 일치)
//   https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1201663&cntntsId=1201391
// 1·2인은 통계청 원자료상 "3인 이하" 단일값 → 3인 금액과 동일 처리
export const INCOME_REFERENCE_2025: IncomeReference = {
  year: 2025,
  source:
    "https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1144&cntntsId=1023",
  appliedFrom: "2025-03-01",
  monthlyIncome100Percent: {
    1: 8_168_429,
    2: 8_168_429,
    3: 8_168_429,
    4: 8_802_202,
    5: 9_326_985,
    6: 9_906_263,
    7: 10_485_541,
  },
};

// 출처: 뉴:홈 소득·자산기준 (3~7인 확인됨, 1·2인은 3인 동일 처리)
//   https://xn--vg1bl39d.kr/subscriptionIntro/property.do
export const INCOME_REFERENCE_2024: IncomeReference = {
  year: 2024,
  source: "https://xn--vg1bl39d.kr/subscriptionIntro/property.do",
  appliedFrom: "2024-03-01",
  monthlyIncome100Percent: {
    1: 6_208_934,
    2: 6_208_934,
    3: 6_208_934,
    4: 7_200_809,
    5: 7_326_072,
    6: 7_779_825,
    7: 8_233_578,
  },
};

// 연도별 표 모음 — 새 연도 추가 시 여기에 등록
const REFERENCES: IncomeReference[] = [
  INCOME_REFERENCE_2025,
  INCOME_REFERENCE_2024,
];

/**
 * 현재 시점에 적용해야 할 표를 반환
 * 오늘 날짜 기준으로 appliedFrom이 가장 최근이면서 오늘 이전인 표 선택
 */
export function getCurrentIncomeReference(today: Date = new Date()): IncomeReference {
  const todayStr = today.toISOString().slice(0, 10);
  const applicable = REFERENCES.filter((r) => r.appliedFrom <= todayStr).sort(
    (a, b) => b.appliedFrom.localeCompare(a.appliedFrom)
  );
  return applicable[0] ?? REFERENCES[0];
}

/**
 * 갱신 필요 여부 점검 — 1년 이상 된 표를 사용 중이면 경고
 * 매년 3월경 새 표 발표 → 4월 1일 기준으로 작년 표를 쓰고 있으면 stale
 *
 * @returns 갱신이 필요하면 경고 메시지, 최신이면 null
 */
export function assertReferenceFresh(today: Date = new Date()): string | null {
  const ref = getCurrentIncomeReference(today);
  const refYear = ref.year;
  const currentYear = today.getFullYear();
  const isPastMarch = today.getMonth() >= 3; // 4월(idx 3) 이후

  // 올해 4월 이후인데 작년 표를 쓰고 있으면 갱신 필요
  if (isPastMarch && refYear < currentYear) {
    return `[income-reference] ${currentYear}년 표가 누락되었습니다. 현재 ${refYear}년 표 사용 중. LH/마이홈에서 새 표 확인 후 src/lib/matcher/income-reference.ts에 INCOME_REFERENCE_${currentYear} 추가 필요.`;
  }
  return null;
}

/**
 * 가구원수에 해당하는 100% 기준 금액 반환 (원/월)
 * 7인 초과는 7인 금액으로 처리 (보수적)
 */
export function getBaseIncomeForHousehold(
  householdMembers: number,
  reference: IncomeReference = getCurrentIncomeReference()
): number {
  const clamped = Math.min(Math.max(1, householdMembers), 7);
  return reference.monthlyIncome100Percent[clamped];
}

/**
 * 공고의 incomeLimit 객체에서 사용자의 가구원수에 해당하는 적용 비율(%)을 추출
 * - "전체" 키가 있으면 그 값 사용
 * - "N인" / "N인이상" 키가 있으면 가구원수 매칭하여 선택
 * - 맞벌이 키(맞벌이_*)는 v1에서는 무시 (맞벌이 여부를 프로필에서 추적하지 않음)
 *
 * @returns 적용 비율(%) 또는 매칭되는 키가 없으면 null
 */
export function pickPercentForHousehold(
  limit: IncomeLimit,
  householdMembers: number
): { percent: number; bucket: string } | null {
  // 단일 비율 케이스
  if (limit["전체"] != null) {
    return { percent: limit["전체"], bucket: "전체" };
  }

  // 정확 매칭 (예: "3인")
  const exactKey = `${householdMembers}인`;
  if (limit[exactKey] != null) {
    return { percent: limit[exactKey], bucket: exactKey };
  }

  // "N인이상" — 가구원수 이하의 가장 큰 매칭 찾기
  for (let s = householdMembers; s >= 1; s--) {
    const k = `${s}인이상`;
    if (limit[k] != null) return { percent: limit[k], bucket: k };
  }

  // 더 큰 가구 키만 있으면 가장 작은 키 사용 (보수적)
  const nonDualKeys = Object.keys(limit).filter((k) => !k.startsWith("맞벌이"));
  if (nonDualKeys.length > 0) {
    const fallback = nonDualKeys[0];
    return { percent: limit[fallback], bucket: `${fallback}(추정)` };
  }

  return null;
}
