/**
 * 행복주택 자격 파서
 * 대상 계층별(대학생/청년/신혼부부/한부모가족/산업단지근로자) × 순위별(1/2/3순위) 조건 추출
 */

import type { HousingParser, ParsedCondition, TextSection, IncomeLimit } from "../types";
import {
  createEmptyCondition,
  extractCarLimit,
  extractAgeRange,
  extractChildAgeMax,
  extractMarriageDuration,
  extractWorkDurationMonths,
  extractRegions,
  CAR_PROHIBITED_RE,
} from "./common";

// 순위별 소득 블록 구분: "1순위", "2순위", "3순위"
const RANK_SECTION_RE = /([123]순위)/g;

// 가구원수별 소득 비율 패턴 (행복주택 PDF 형식)
const INCOME_1IN_RE = /1인\s*(\d+)\s*%\s*이하/;
const INCOME_2IN_RE = /2인\s*(\d+)\s*%\s*이하/;
const INCOME_3IN_RE = /3인\s*이상\s*(\d+)\s*%\s*이하/;
const INCOME_DUAL_2IN_RE = /맞벌이.*?2인\s*(\d+)\s*%/;
const INCOME_DUAL_3IN_RE = /맞벌이.*?3인\s*이상\s*(\d+)\s*%/;

// 3순위 단일 소득 비율: "전체 150%" or 순위 블록 내 단독 %
const INCOME_ALL_RE = /전체\s*(\d+)\s*%/;

// 자산 테이블 패턴: 헤더 행(대학생/청년/신혼부부·한부모) 이후 총자산금액 행에서 3개 숫자를 순서대로 추출
// 개별 계층 패턴([^\d]*형)은 청년 뒤에 신혼부부가 오면 신혼 기준(34500)을 탐욕 매칭하는 오탐 발생
// 대신 테이블 행 전체 구조를 한 번에 파싱하여 순서 보장
const ASSET_TABLE_RE =
  /대학생\s*계층\s+청년\s*계층\s+신혼부부[^총]*총자산금액\s+([\d,]+)만\s*원\s+([\d,]+)만\s*원\s+([\d,]+)만\s*원/;

// 최대 거주기간 패턴
const MAX_RESIDENCE_RE = /최대\s*거주\s*기간[은]?\s*(\d+)\s*년/g;

// 대상 계층 그룹 정의
const TARGET_GROUPS = ["대학생", "청년", "신혼부부", "한부모가족", "산업단지근로자"] as const;
type TargetGroup = (typeof TARGET_GROUPS)[number];

// 순위별 소득 데이터 구조
interface RankIncome {
  general: IncomeLimit | null;    // 일반 (단독가구 포함)
  dualIncome: IncomeLimit | null; // 맞벌이
}

/**
 * 텍스트에서 순위별 블록을 분리하여 반환
 * 예: { "1": "1인 120%...", "2": "1인 140%...", "3": "전체 150%..." }
 */
function splitRankBlocks(text: string): Record<string, string> {
  const blocks: Record<string, string> = {};
  const matches: Array<{ rank: string; index: number }> = [];

  const re = new RegExp(RANK_SECTION_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    matches.push({ rank: match[1][0], index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const rank = matches[i].rank;
    // 각 순위의 첫 번째 매칭만 유지 (PDF 뒷부분의 반복 언급 무시)
    if (blocks[rank]) continue;
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    blocks[rank] = text.slice(start, end);
  }

  return blocks;
}

/**
 * 하나의 순위 블록에서 일반·맞벌이 소득 제한을 추출
 */
function parseRankIncome(blockText: string): RankIncome {
  try {
    // 3순위: 전체 단일 비율 처리
    const allMatch = INCOME_ALL_RE.exec(blockText);
    if (allMatch) {
      return {
        general: { 전체: parseInt(allMatch[1], 10) },
        dualIncome: null,
      };
    }

    // 일반 소득 비율 추출
    const m1 = INCOME_1IN_RE.exec(blockText);
    const m2 = INCOME_2IN_RE.exec(blockText);
    const m3 = INCOME_3IN_RE.exec(blockText);

    const general: IncomeLimit = {};
    if (m1) general["1인"] = parseInt(m1[1], 10);
    if (m2) general["2인"] = parseInt(m2[1], 10);
    if (m3) general["3인이상"] = parseInt(m3[1], 10);

    // 맞벌이 소득 비율 추출
    const dm2 = INCOME_DUAL_2IN_RE.exec(blockText);
    const dm3 = INCOME_DUAL_3IN_RE.exec(blockText);

    const dualIncome: IncomeLimit = {};
    if (dm2) dualIncome["맞벌이_2인"] = parseInt(dm2[1], 10);
    if (dm3) dualIncome["맞벌이_3인이상"] = parseInt(dm3[1], 10);

    return {
      general: Object.keys(general).length > 0 ? general : null,
      dualIncome: Object.keys(dualIncome).length > 0 ? dualIncome : null,
    };
  } catch (err) {
    console.error("[parseRankIncome] 소득 파싱 오류:", err);
    return { general: null, dualIncome: null };
  }
}

/**
 * 전체 텍스트에서 순위별 소득 데이터를 파싱
 */
function parseIncomeByRank(text: string): Record<string, RankIncome> {
  const blocks = splitRankBlocks(text);
  const result: Record<string, RankIncome> = {};

  for (const [rank, blockText] of Object.entries(blocks)) {
    result[rank] = parseRankIncome(blockText);
  }

  // 순위 블록이 없으면 전체 텍스트에서 직접 추출 (fallback)
  if (Object.keys(result).length === 0) {
    result["1"] = parseRankIncome(text);
  }

  return result;
}

/**
 * 계층별 자산 한도와 자동차 가액 한도를 파싱
 * PDF 표: 대학생 10,800만원, 청년 25,100만원, 신혼부부·한부모 34,500만원
 */
function parseAssetByGroup(text: string): Record<TargetGroup, { asset: number | null; car: number | null }> {
  const parseManwon = (s: string): number => parseInt(s.replace(/,/g, ""), 10);

  // 테이블에서 [대학생, 청년, 신혼부부·한부모] 자산을 순서대로 추출
  const tableMatch = ASSET_TABLE_RE.exec(text);
  const studentAsset = tableMatch ? parseManwon(tableMatch[1]) : 10800;
  const youthAsset   = tableMatch ? parseManwon(tableMatch[2]) : 25100;
  const newlywedAsset = tableMatch ? parseManwon(tableMatch[3]) : 34500;

  // 대학생은 자동차 소유 불가; 청년·신혼 등은 4,542만원
  // extractCarLimit은 가액 패턴 우선 검색하므로 공통 호출로 처리 가능
  const carLimitYouth = extractCarLimit(text) ?? 4542;
  const studentCarProhibited = CAR_PROHIBITED_RE.test(text);

  return {
    대학생: { asset: studentAsset, car: studentCarProhibited ? 0 : null },
    청년: { asset: youthAsset, car: carLimitYouth },
    신혼부부: { asset: newlywedAsset, car: carLimitYouth },
    한부모가족: { asset: newlywedAsset, car: carLimitYouth },
    산업단지근로자: { asset: youthAsset, car: carLimitYouth },
  };
}

/**
 * 순위와 대상 계층에 따른 기간 조건을 반환
 * 1순위: 청년 근무 5년/혼인 7년/자녀 6세
 * 2·3순위: 청년 근무 7년/혼인 10년/자녀 9세 (완화조건)
 */
function getPeriodConditions(
  group: TargetGroup,
  rank: number
): { workDurationMonths: number | null; marriageCondition: string | null; childAgeMax: number | null } {
  const isRelaxed = rank >= 2;

  if (group === "청년" || group === "산업단지근로자") {
    return {
      workDurationMonths: isRelaxed ? 84 : 60, // 7년(완화) or 5년(일반)
      marriageCondition: null,
      childAgeMax: null,
    };
  }

  if (group === "신혼부부") {
    return {
      workDurationMonths: null,
      marriageCondition: isRelaxed ? "혼인기간 10년 이내" : "혼인기간 7년 이내",
      childAgeMax: isRelaxed ? 9 : 6,
    };
  }

  if (group === "한부모가족") {
    return {
      workDurationMonths: null,
      marriageCondition: null,
      childAgeMax: isRelaxed ? 9 : 6,
    };
  }

  // 대학생: 기간 조건 없음
  return { workDurationMonths: null, marriageCondition: null, childAgeMax: null };
}

/**
 * 대상 계층별 최대 거주기간(년) 반환
 * 대학생·청년: 10년, 신혼부부·한부모·산업단지근로자: 10~14년 (공고별 상이)
 */
function getMaxResidenceYears(group: TargetGroup, text: string): number | null {
  // 텍스트에서 계층별 최대 거주기간 추출 시도
  const re = new RegExp(MAX_RESIDENCE_RE.source, "g");
  const allMatches: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    allMatches.push(parseInt(match[1], 10));
  }

  if (group === "대학생" || group === "청년") {
    // 대학생·청년은 최대 10년
    return allMatches.find((y) => y === 10) ?? 10;
  }

  // 신혼부부·한부모·산업단지근로자: 자녀 여부에 따라 10~14년
  return allMatches.find((y) => y >= 10) ?? 10;
}

/**
 * 소득 데이터에 맞벌이 조건을 합산한 IncomeLimit 생성
 * 신혼부부의 경우 맞벌이 소득 조건 포함
 */
function buildIncomeLimit(
  group: TargetGroup,
  rankIncome: RankIncome
): IncomeLimit | null {
  const base = rankIncome.general ?? {};

  if (group === "신혼부부" && rankIncome.dualIncome) {
    return { ...base, ...rankIncome.dualIncome };
  }

  return Object.keys(base).length > 0 ? base : null;
}

/**
 * 연령 조건 반환: 청년만 만19세~39세
 */
function getAgeCondition(
  group: TargetGroup,
  fullText: string
): { ageMin: number | null; ageMax: number | null } {
  if (group === "청년" || group === "산업단지근로자") {
    const extracted = extractAgeRange(fullText);
    // PDF에서 추출 실패 시 기본값 적용
    return {
      ageMin: extracted.min ?? 19,
      ageMax: extracted.max ?? 39,
    };
  }
  return { ageMin: null, ageMax: null };
}

/**
 * (대상계층, 순위) 쌍으로 하나의 ParsedCondition 생성
 */
function buildCondition(
  group: TargetGroup,
  rank: number,
  rankIncome: RankIncome,
  assetByGroup: Record<TargetGroup, { asset: number | null; car: number | null }>,
  regions: string[],
  fullText: string
): ParsedCondition {
  const periodCond = getPeriodConditions(group, rank);
  const ageCond = getAgeCondition(group, fullText);
  const { asset, car } = assetByGroup[group];
  const incomeLimit = buildIncomeLimit(group, rankIncome);
  const maxResidenceYears = getMaxResidenceYears(group, fullText);

  return {
    ...createEmptyCondition(),
    targetGroup: group,
    priorityRank: rank,
    incomeLimit,
    assetLimit: asset,
    carLimit: car,
    ageMin: ageCond.ageMin,
    ageMax: ageCond.ageMax,
    childAgeMax: periodCond.childAgeMax,
    regionRequirement: regions.length > 0 ? regions : null,
    marriageCondition: periodCond.marriageCondition,
    workDurationMonths: periodCond.workDurationMonths,
    maxResidenceYears,
  };
}

// 행복주택 개요 문장에서 지역 추출: "의정부시 지역 행복주택"
const REGION_OVERVIEW_RE = /([가-힣]+(?:시|군|구))\s*지역\s*(?:행복주택|신혼희망타운)/;

/**
 * 지역 추출 — 거주 패턴이 없으면 개요 문장에서 fallback
 */
function extractRegionsForHaengbok(fullText: string): string[] {
  const regions = extractRegions(fullText);
  if (regions.length > 0) return regions;

  try {
    const match = REGION_OVERVIEW_RE.exec(fullText);
    if (match) return [match[1]];
  } catch (err) {
    console.error("[haengbok] 지역 fallback 오류:", err);
  }
  return [];
}

export class HaengbokParser implements HousingParser {
  readonly housingType = "행복주택";

  parse(sections: TextSection[], fullText: string): ParsedCondition[] {
    try {
      const regions = extractRegionsForHaengbok(fullText);
      const incomeByRank = parseIncomeByRank(fullText);
      const assetByGroup = parseAssetByGroup(fullText);

      const conditions: ParsedCondition[] = [];

      // 5 대상 계층 × 3 순위 = 최대 15개 조건 생성
      for (const group of TARGET_GROUPS) {
        for (const rank of [1, 2, 3]) {
          const rankKey = String(rank);
          // 해당 순위 데이터가 없으면 1순위 데이터로 fallback
          const rankIncome = incomeByRank[rankKey] ?? incomeByRank["1"] ?? { general: null, dualIncome: null };

          conditions.push(buildCondition(group, rank, rankIncome, assetByGroup, regions, fullText));
        }
      }

      return conditions;
    } catch (err) {
      console.error("[HaengbokParser] 파싱 오류:", err);
      return [createEmptyCondition()];
    }
  }
}
