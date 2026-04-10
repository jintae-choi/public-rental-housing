/**
 * 신혼희망타운 자격 파서
 * 신혼부부·한부모가족 대상, 순위별 소득 기준 및 자산·자동차 조건 추출
 */

import type { HousingParser, ParsedCondition, TextSection, IncomeLimit } from "../types";
import {
  createEmptyCondition,
  extractAssetLimit,
  extractCarLimit,
  extractRegions,
} from "./common";

// 신혼희망타운 대상 그룹
const TARGET_GROUPS = ["신혼부부", "한부모가족"] as const;
type TargetGroup = (typeof TARGET_GROUPS)[number];

// 순위별 소득 기준 (단위: %)
// 1순위: 2인 110%, 3인이상 100%, 맞벌이 2인 130%, 3인이상 120%
// 2순위: 2인 130%, 3인이상 120%, 맞벌이 2인 140%, 3인이상 130%
// 3순위: 전체 150%
const RANK_INCOME_MAP: Record<number, IncomeLimit> = {
  1: { "2인": 110, "3인이상": 100, "맞벌이_2인": 130, "맞벌이_3인이상": 120 },
  2: { "2인": 130, "3인이상": 120, "맞벌이_2인": 140, "맞벌이_3인이상": 130 },
  3: { "전체": 150 },
};

// 신혼부부 혼인 기간 조건 (순위별)
// 1~2순위: 7년 이내, 3순위: 10년 이내
const RANK_MARRIAGE_MAP: Record<number, string> = {
  1: "혼인기간 7년 이내",
  2: "혼인기간 7년 이내",
  3: "혼인기간 10년 이내",
};

// 자녀 연령 조건 (순위별)
// 1~2순위: 6세 이하, 3순위: 9세 이하
const RANK_CHILD_AGE_MAP: Record<number, number> = {
  1: 6,
  2: 6,
  3: 9,
};

/**
 * 특정 그룹·순위 조합에 대한 ParsedCondition 생성
 * 신혼부부는 혼인 기간 및 자녀 연령 조건 포함, 한부모가족은 미적용
 */
function buildCondition(
  group: TargetGroup,
  rank: number,
  baseAsset: number | null,
  baseCar: number | null,
  regions: string[]
): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = group;
  cond.priorityRank = rank;
  cond.incomeLimit = RANK_INCOME_MAP[rank];
  cond.assetLimit = baseAsset;
  cond.carLimit = baseCar;
  cond.regionRequirement = regions.length > 0 ? regions : null;

  // 신혼부부: 혼인 기간 및 자녀 연령 조건 적용
  if (group === "신혼부부") {
    cond.marriageCondition = RANK_MARRIAGE_MAP[rank];
    cond.childAgeMax = RANK_CHILD_AGE_MAP[rank];
  }

  return cond;
}

export class SinheuiParser implements HousingParser {
  readonly housingType = "신혼희망타운";

  parse(sections: TextSection[], fullText: string): ParsedCondition[] {
    try {
      const regions = extractRegions(fullText);
      // extractAssetLimit/extractCarLimit이 실패할 경우 하드코딩 기본값 사용
      const assetLimit = extractAssetLimit(fullText) ?? 34500;
      const carLimit = extractCarLimit(fullText) ?? 4542;

      const conditions: ParsedCondition[] = [];

      // 2 그룹 × 3 순위 = 6개 조건 생성
      for (const group of TARGET_GROUPS) {
        for (const rank of [1, 2, 3]) {
          conditions.push(buildCondition(group, rank, assetLimit, carLimit, regions));
        }
      }

      return conditions;
    } catch (err) {
      console.error("[SinheuiParser] 파싱 오류:", err);
      return [createEmptyCondition()];
    }
  }
}
