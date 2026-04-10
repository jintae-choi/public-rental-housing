/**
 * 자격 분석 엔진 공개 API
 * 공고의 pdfText를 분석하여 자격 조건을 추출하고 DB에 저장
 */

import type { AnalysisResult, AnalyzeSummary } from "./types";
import { PARSER_VERSION } from "./types";
import { normalizeText, splitSections } from "./preprocessor";
import { getParser } from "./parser";
import { replaceConditions } from "../db/queries/condition";

interface AnnouncementInput {
  id: string;
  title: string;
  housingType: string | null;
  pdfText: string;
}

/**
 * 공고 1건 분석 — 전처리 → 파서 → 조건 추출
 * DB 저장 없이 분석 결과만 반환
 */
export function analyzeText(
  housingType: string | null,
  pdfText: string
): AnalysisResult {
  const normalized = normalizeText(pdfText);
  const sections = splitSections(normalized);
  const parser = getParser(housingType);
  const conditions = parser.parse(sections, normalized);

  // rawAnalysis: 파서가 사용한 섹션 텍스트 요약 (디버깅용)
  const rawAnalysis = sections
    .map((s) => `[${s.title}] ${s.content.substring(0, 200)}...`)
    .join("\n---\n");

  return {
    announcementId: "",
    conditions,
    rawAnalysis,
    parserVersion: PARSER_VERSION,
  };
}

/**
 * 공고 1건 분석 + DB 저장
 */
export async function analyzeAnnouncement(
  announcement: AnnouncementInput
): Promise<AnalyzeSummary> {
  try {
    const result = analyzeText(announcement.housingType, announcement.pdfText);

    const insertedCount = await replaceConditions(
      announcement.id,
      result.conditions,
      result.rawAnalysis,
      result.parserVersion
    );

    console.log(
      `[analyzeAnnouncement] ${announcement.title}: ${insertedCount}건 조건 저장 완료`
    );

    return {
      announcementId: announcement.id,
      title: announcement.title,
      housingType: announcement.housingType,
      conditionCount: insertedCount,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[analyzeAnnouncement] ${announcement.title} 분석 실패:`,
      message
    );
    return {
      announcementId: announcement.id,
      title: announcement.title,
      housingType: announcement.housingType,
      conditionCount: 0,
      success: false,
      error: message,
    };
  }
}

export { PARSER_VERSION } from "./types";
