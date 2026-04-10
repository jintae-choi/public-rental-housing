/**
 * 기숙사형 청년주택 자격 파서
 * 수급자·대학생·청년 3개 순위, 소득 기준 및 지역 조건 추출
 * 자산·자동차 한도 없음
 */

import type { HousingParser, ParsedCondition, TextSection } from "../types";
import { createEmptyCondition, extractRegions } from "./common";

// 1순위 수급자 감지 패턴 (생계·의료·주거급여 수급자 또는 한부모가족/차상위)
const RANK1_RE = /생계[·・]?의료[·・]?주거\s*급여\s*수급자|지원대상\s*한부모가족|차상위\s*계층/;

// 2순위 감지: 본인+부모 소득 100% 이하 대학생·대학원생 (줄바꿈 포함 매칭)
const RANK2_RE = /본인[과와]\s*부모[\s\S]*?월평균\s*소득[\s\S]*?100\s*%\s*이하[\s\S]*?대학생/;

// 3순위 감지: 본인 소득만, 19세~39세 (줄바꿈 포함 매칭)
const RANK3_RE = /본인[의]?\s*월평균\s*소득[\s\S]*?100\s*%\s*이하[\s\S]*?(?:대학생|19\s*세)/;

/**
 * 기숙사형은 "~에 거주" 패턴이 없음 (전국 모집)
 * 거주 패턴으로 추출되는 경우만 반환, 제목 fallback 없음
 */
function extractRegionsStrict(fullText: string): string[] {
  return extractRegions(fullText);
}

/**
 * 1순위: 수급자·한부모가족·차상위계층 — 소득 기준 없음
 */
function buildRank1Condition(regions: string[]): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = "수급자";
  cond.priorityRank = 1;
  cond.regionRequirement = regions.length > 0 ? regions : null;
  // 소득·자산 기준 없음 (수급자 자격으로 판단)
  return cond;
}

/**
 * 2순위: 대학생·대학원생 — 본인+부모 합산 소득 100% 이하
 */
function buildRank2Condition(regions: string[]): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = "대학생";
  cond.priorityRank = 2;
  cond.incomeLimit = { 전체: 100 };
  cond.parentIncomeIncluded = true;
  cond.regionRequirement = regions.length > 0 ? regions : null;
  return cond;
}

/**
 * 3순위: 대학생·청년(19~39세) — 본인 소득만 1인가구 기준 100% 이하
 */
function buildRank3Condition(regions: string[]): ParsedCondition {
  const cond = createEmptyCondition();
  cond.targetGroup = "청년";
  cond.priorityRank = 3;
  cond.incomeLimit = { "1인": 100 };
  cond.parentIncomeIncluded = false;
  cond.ageMin = 19;
  cond.ageMax = 39;
  cond.regionRequirement = regions.length > 0 ? regions : null;
  return cond;
}

export class GisuksaParser implements HousingParser {
  readonly housingType = "기숙사형";

  parse(sections: TextSection[], fullText: string): ParsedCondition[] {
    try {
      const regions = extractRegionsStrict(fullText);
      const conditions: ParsedCondition[] = [];

      // 순위 감지 후 조건 생성 — 감지 실패 시에도 기본 3개 조건 생성
      const hasRank1 = RANK1_RE.test(fullText);
      const hasRank2 = RANK2_RE.test(fullText);
      const hasRank3 = RANK3_RE.test(fullText);

      if (hasRank1 || !hasRank2) conditions.push(buildRank1Condition(regions));
      if (hasRank2 || (!hasRank1 && !hasRank3)) conditions.push(buildRank2Condition(regions));
      if (hasRank3 || conditions.length < 3) conditions.push(buildRank3Condition(regions));

      return conditions;
    } catch (err) {
      console.error("[GisuksaParser] 파싱 오류:", err);
      return [createEmptyCondition()];
    }
  }
}
