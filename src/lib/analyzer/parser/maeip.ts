/**
 * 매입임대 청년주택 자격 파서
 * 기숙사형과 유사하나 2·3순위에 자산·자동차 한도 적용
 * 2순위: 국민임대 기준(34,500만원 / 4,542만원)
 * 3순위: 행복주택 청년 기준(25,100만원 / 4,542만원)
 */

import type { HousingParser, ParsedCondition, TextSection } from "../types";
import {
  createEmptyCondition,
  extractRegions,
  extractAssetLimit,
  extractCarLimit,
} from "./common";

// 자산 한도 기본값 (만원 단위)
const ASSET_LIMIT_RANK2 = 34500; // 국민임대 기준
const ASSET_LIMIT_RANK3 = 25100; // 행복주택 청년 기준
const CAR_LIMIT_DEFAULT = 4542;  // 공통 자동차 가액 기준

// 순위 감지 패턴 (기숙사형과 동일 구조)
const RANK1_RE = /생계[·・]?의료[·・]?주거\s*급여\s*수급자|지원대상\s*한부모가족|차상위\s*계층/;
// 줄바꿈 포함 매칭 (s 플래그 대신 [\s\S] 사용)
const RANK2_RE = /본인[과와]\s*부모[\s\S]*?월평균\s*소득[\s\S]*?100\s*%\s*이하[\s\S]*?대학생/;
const RANK3_RE = /본인[의]?\s*월평균\s*소득[\s\S]*?100\s*%\s*이하[\s\S]*?(?:대학생|19\s*세)/;

/**
 * 1순위: 수급자·한부모가족·차상위계층 — 소득·자산 기준 없음
 */
function buildRank1Condition(regions: string[]): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = "수급자";
  cond.priorityRank = 1;
  cond.regionRequirement = regions.length > 0 ? regions : null;
  return cond;
}

/**
 * 2순위: 대학생·대학원생 — 본인+부모 합산 소득 100% 이하
 * 자산 한도: 34,500만원 (국민임대 기준), 자동차: 4,542만원
 */
function buildRank2Condition(
  regions: string[],
  carLimit: number
): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = "대학생";
  cond.priorityRank = 2;
  cond.incomeLimit = { 전체: 100 };
  cond.parentIncomeIncluded = true;
  cond.assetLimit = ASSET_LIMIT_RANK2;
  cond.carLimit = carLimit;
  cond.regionRequirement = regions.length > 0 ? regions : null;
  return cond;
}

/**
 * 3순위: 청년(19~39세) — 본인 소득만 1인가구 기준 100% 이하
 * 자산 한도: 25,100만원 (행복주택 청년 기준), 자동차: 4,542만원
 */
function buildRank3Condition(
  regions: string[],
  carLimit: number
): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = "청년";
  cond.priorityRank = 3;
  cond.incomeLimit = { "1인": 100 };
  cond.parentIncomeIncluded = false;
  cond.assetLimit = ASSET_LIMIT_RANK3;
  cond.carLimit = carLimit;
  cond.ageMin = 19;
  cond.ageMax = 39;
  cond.regionRequirement = regions.length > 0 ? regions : null;
  return cond;
}

export class MaeipParser implements HousingParser {
  readonly housingType = "매입임대";

  parse(sections: TextSection[], fullText: string): ParsedCondition[] {
    try {
      const regions = extractRegions(fullText);
      // 자동차 한도: 텍스트에서 추출하거나 기본값 사용
      const carLimit = extractCarLimit(fullText) ?? CAR_LIMIT_DEFAULT;
      const conditions: ParsedCondition[] = [];

      const hasRank1 = RANK1_RE.test(fullText);
      const hasRank2 = RANK2_RE.test(fullText);
      const hasRank3 = RANK3_RE.test(fullText);

      if (hasRank1 || !hasRank2) conditions.push(buildRank1Condition(regions));
      if (hasRank2 || (!hasRank1 && !hasRank3)) conditions.push(buildRank2Condition(regions, carLimit));
      if (hasRank3 || conditions.length < 3) conditions.push(buildRank3Condition(regions, carLimit));

      return conditions;
    } catch (err) {
      console.error("[MaeipParser] 파싱 오류:", err);
      return [createEmptyCondition()];
    }
  }
}
