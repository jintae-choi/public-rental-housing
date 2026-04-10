/**
 * 자격 분석 엔진 타입 정의
 */

// 파서 버전 — 재분석 트리거 판단에 사용
export const PARSER_VERSION = "1.1.0";

// 전처리된 텍스트의 섹션
export interface TextSection {
  title: string;       // 예: "신청자격", "소득기준"
  content: string;     // 해당 섹션의 텍스트
  startIndex: number;  // 원본 텍스트 내 시작 위치
}

// 소득 제한 — 가구원수별 소득 비율(%)
// 예: { "1인": 120, "2인": 110, "3인이상": 100 }
// 또는 단일값: { "전체": 100 }
// 맞벌이: { "맞벌이_2인": 130, "맞벌이_3인이상": 120 }
export interface IncomeLimit {
  [householdSize: string]: number;
}

// 파서가 추출한 원시 조건 (DB 저장 전)
export interface ParsedCondition {
  targetGroup: string | null;
  priorityRank: number | null;
  incomeLimit: IncomeLimit | null;
  assetLimit: number | null;          // 만원 단위
  carLimit: number | null;            // 만원 단위 (0 = 소유 불가)
  ageMin: number | null;
  ageMax: number | null;
  childAgeMax: number | null;
  homelessMonths: number | null;
  regionRequirement: string[] | null;
  subscriptionMonths: number | null;
  subscriptionPayments: number | null;
  householdType: string[] | null;
  marriageCondition: string | null;
  workDurationMonths: number | null;
  maxResidenceYears: number | null;
  parentIncomeIncluded: boolean | null;
  scoringCriteria: Record<string, unknown> | null;
  specialConditions: Record<string, unknown>[] | null;
}

// 분석 결과 (DB 저장 단위)
export interface AnalysisResult {
  announcementId: string;
  conditions: ParsedCondition[];
  rawAnalysis: string;
  parserVersion: string;
}

// 파서 인터페이스 — 주택 유형별 구현
export interface HousingParser {
  readonly housingType: string;
  parse(sections: TextSection[], fullText: string): ParsedCondition[];
}

// 분석 실행 요약
export interface AnalyzeSummary {
  announcementId: string;
  title: string;
  housingType: string | null;
  conditionCount: number;
  success: boolean;
  error?: string;
}
