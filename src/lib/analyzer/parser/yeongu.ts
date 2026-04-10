/**
 * 영구임대 주택 자격 파서
 * PDF "신청자격" 섹션에서 신분별 소득 기준 및 자산 조건 추출
 */

import type { HousingParser, ParsedCondition, TextSection } from "../types";
import {
  createEmptyCondition,
  extractAssetLimit,
  extractCarLimit,
  extractRegions,
  INCOME_PERCENT_RE,
} from "./common";

// 소득 기준 티어 패턴: "월평균 소득 100%이하 : 타목(2순위 장애인)"
// lookahead로 다음 티어 구분자('-') 또는 다음 항목 번호('2.') 앞에서 중단하여 오탐 방지
const INCOME_TIER_RE =
  /월평균\s*소득\s*(\d+)\s*%\s*이하\s*:\s*([^-\n]+?)(?=\s*(?:-\s*월평균|\s*\d+\.\s*월평균|$))/g;

// 대상 그룹 괄호 내용 추출: "나목(국가유공자등)" → "국가유공자등"
const TARGET_PAREN_RE = /[가-힣]+목\(([^)]+)\)/g;

// 생계·의료급여수급자(가군) 섹션 감지
const GAGUGUN_RE = /가군\s*해당자|생계[·・]?의료\s*급여\s*수급자/;

/**
 * 괄호 안 그룹명을 표준 targetGroup 식별자로 변환
 * 예: "국가유공자등" → "국가유공자", "1순위 장애인" → "장애인"
 */
function normalizeTargetGroup(
  raw: string,
  categoryText: string
): { group: string; priority: number | null } {
  const text = raw.trim();
  // 장애인: 순위 정보 포함
  if (text.includes("장애인")) {
    const rank1 = /1순위/.test(categoryText) || /1순위/.test(text) ? 1 : null;
    const rank2 = /2순위/.test(categoryText) || /2순위/.test(text) ? 2 : null;
    return { group: "장애인", priority: rank1 ?? rank2 };
  }
  if (text.includes("국가유공자")) return { group: "국가유공자", priority: null };
  if (text.includes("북한이탈주민")) return { group: "북한이탈주민", priority: null };
  if (text.includes("아동복지시설퇴소자")) return { group: "아동복지시설퇴소자", priority: null };
  if (text.includes("일반입주자") || text.includes("일반")) return { group: "일반", priority: null };
  // 인식되지 않은 그룹은 원문 반환
  return { group: text, priority: null };
}

/**
 * 소득 티어 텍스트에서 ParsedCondition 목록을 생성
 * 하나의 티어에 여러 대상 그룹이 포함될 수 있음
 */
function buildConditionsFromTier(
  percent: number,
  categoryRaw: string,
  baseCondition: Omit<ParsedCondition, "targetGroup" | "priorityRank" | "incomeLimit">
): ParsedCondition[] {
  const conditions: ParsedCondition[] = [];
  const re = new RegExp(TARGET_PAREN_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(categoryRaw)) !== null) {
    const { group, priority } = normalizeTargetGroup(match[1], categoryRaw);
    conditions.push({
      ...baseCondition,
      targetGroup: group,
      priorityRank: priority,
      incomeLimit: { 전체: percent },
    });
  }

  // 괄호 매칭이 없으면 카테고리 텍스트 전체를 그룹명으로 사용
  if (conditions.length === 0) {
    const { group, priority } = normalizeTargetGroup(categoryRaw.trim(), categoryRaw);
    conditions.push({
      ...baseCondition,
      targetGroup: group,
      priorityRank: priority,
      incomeLimit: { 전체: percent },
    });
  }

  return conditions;
}

/**
 * 생계·의료급여수급자(가군) 조건 생성
 * 소득 기준 없음, 수급자 자격으로 대체
 */
function buildGagunnCondition(
  baseCondition: Omit<ParsedCondition, "targetGroup" | "priorityRank" | "incomeLimit">
): ParsedCondition {
  return {
    ...baseCondition,
    targetGroup: "생계의료급여수급자",
    priorityRank: null,
    incomeLimit: null, // 소득 기준 대신 수급자 자격으로 판단
  };
}

export class YeonguParser implements HousingParser {
  readonly housingType = "영구임대";

  parse(sections: TextSection[], fullText: string): ParsedCondition[] {
    try {
      // 공통 조건 추출 (모든 그룹에 동일 적용)
      const regions = extractRegions(fullText);
      const assetLimit = extractAssetLimit(fullText);
      const carLimit = extractCarLimit(fullText);

      const baseCondition = {
        assetLimit,
        carLimit,
        regionRequirement: regions.length > 0 ? regions : null,
        ageMin: null,
        ageMax: null,
        childAgeMax: null,
        homelessMonths: null,
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

      const conditions: ParsedCondition[] = [];

      // 생계·의료급여수급자(가군) 조건 추가
      if (GAGUGUN_RE.test(fullText)) {
        conditions.push(buildGagunnCondition(baseCondition));
      }

      // 소득 기준 티어별 파싱
      const tierRe = new RegExp(INCOME_TIER_RE.source, "g");
      let match: RegExpExecArray | null;
      while ((match = tierRe.exec(fullText)) !== null) {
        const percent = parseInt(match[1], 10);
        const categoryRaw = match[2];
        const tierConditions = buildConditionsFromTier(percent, categoryRaw, baseCondition);
        conditions.push(...tierConditions);
      }

      // 파싱 실패 시 기본 조건 반환
      if (conditions.length === 0) {
        const fallback = createEmptyCondition();
        fallback.assetLimit = assetLimit;
        fallback.carLimit = carLimit;
        fallback.regionRequirement = regions.length > 0 ? regions : null;
        return [fallback];
      }

      return conditions;
    } catch (err) {
      console.error("[YeonguParser] 파싱 오류:", err);
      return [createEmptyCondition()];
    }
  }
}
