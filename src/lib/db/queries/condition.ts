// 자격 조건 DB 쿼리 함수 — 분석 파이프라인에서 조건 저장·조회 시 사용

import { eq, not, sql, desc } from "drizzle-orm";
import { db } from "../index";
import { announcements, eligibilityConditions } from "../schema";

// replaceConditions에 전달할 조건 입력 타입
type ConditionInput = {
  targetGroup: string | null;
  priorityRank: number | null;
  incomeLimit: unknown | null;
  assetLimit: number | null;
  carLimit: number | null;
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
  scoringCriteria: unknown | null;
  specialConditions: unknown | null;
};

/**
 * 공고의 기존 자격 조건 전체 삭제 후 신규 조건 일괄 삽입 — 트랜잭션으로 원자적 처리
 * @returns 삽입된 조건 행 수
 */
export async function replaceConditions(
  announcementId: string,
  conditions: ConditionInput[],
  rawAnalysis: string,
  parserVersion: string
): Promise<number> {
  try {
    return await db.transaction(async (tx) => {
      // 기존 조건 삭제
      await tx
        .delete(eligibilityConditions)
        .where(eq(eligibilityConditions.announcementId, announcementId));

      if (conditions.length === 0) return 0;

      // 신규 조건 삽입
      const now = new Date();
      const rows = await tx
        .insert(eligibilityConditions)
        .values(
          conditions.map((c) => ({
            announcementId,
            targetGroup: c.targetGroup,
            priorityRank: c.priorityRank,
            incomeLimit: c.incomeLimit,
            assetLimit: c.assetLimit,
            carLimit: c.carLimit,
            ageMin: c.ageMin,
            ageMax: c.ageMax,
            childAgeMax: c.childAgeMax,
            homelessMonths: c.homelessMonths,
            regionRequirement: c.regionRequirement,
            subscriptionMonths: c.subscriptionMonths,
            subscriptionPayments: c.subscriptionPayments,
            householdType: c.householdType,
            marriageCondition: c.marriageCondition,
            workDurationMonths: c.workDurationMonths,
            maxResidenceYears: c.maxResidenceYears,
            parentIncomeIncluded: c.parentIncomeIncluded,
            scoringCriteria: c.scoringCriteria,
            specialConditions: c.specialConditions,
            rawAnalysis,
            analyzedAt: now,
            parserVersion,
            createdAt: now,
          }))
        )
        .returning({ id: eligibilityConditions.id });

      return rows.length;
    });
  } catch (error) {
    console.error(`[replaceConditions] 조건 교체 실패 (${announcementId}):`, error);
    throw error;
  }
}

/**
 * 특정 공고의 자격 조건 전체 조회
 */
export async function getConditionsByAnnouncement(
  announcementId: string
): Promise<(typeof eligibilityConditions.$inferSelect)[]> {
  try {
    return await db
      .select()
      .from(eligibilityConditions)
      .where(eq(eligibilityConditions.announcementId, announcementId));
  } catch (error) {
    console.error(`[getConditionsByAnnouncement] 조건 조회 실패 (${announcementId}):`, error);
    throw error;
  }
}

/**
 * 분석이 필요한 공고 조회 — pdfText 있고 현재 파서 버전으로 미분석된 공고
 */
export async function getUnanalyzedAnnouncements(
  currentParserVersion: string
): Promise<{ id: string; title: string; housingType: string | null; pdfText: string }[]> {
  try {
    // 현재 버전으로 이미 분석된 공고 ID 서브쿼리
    const analyzedIds = db
      .select({ id: eligibilityConditions.announcementId })
      .from(eligibilityConditions)
      .where(eq(eligibilityConditions.parserVersion, currentParserVersion));

    // pdfText 있고 미분석인 공고 조회
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        housingType: announcements.housingType,
        pdfText: announcements.pdfText,
      })
      .from(announcements)
      .where(
        sql`${announcements.pdfText} IS NOT NULL AND ${announcements.pdfText} != '' AND ${not(sql`${announcements.id} IN (${analyzedIds})`)}`
      )
      .orderBy(desc(announcements.createdAt));

    // pdfText null 방어 필터 (타입 보장)
    return rows.filter(
      (r): r is { id: string; title: string; housingType: string | null; pdfText: string } =>
        r.pdfText !== null
    );
  } catch (error) {
    console.error("[getUnanalyzedAnnouncements] 미분석 공고 조회 실패:", error);
    throw error;
  }
}
