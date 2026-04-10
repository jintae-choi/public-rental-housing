// 자격 매칭 결과 DB 쿼리 — 매칭 파이프라인 및 대시보드에서 사용

import { and, eq, inArray, ne, desc, gte, or, isNull, sql } from "drizzle-orm";
import { db } from "../index";
import {
  announcements,
  eligibilityConditions,
  eligibilityResults,
} from "../schema";
import type { AnnouncementMatch, ConditionMatch } from "@/lib/matcher/types";

/**
 * 특정 사용자 × 공고 조합의 기존 매칭 결과를 모두 삭제 후 신규 결과 일괄 삽입
 * — 트랜잭션으로 원자적 처리
 * @returns 삽입된 결과 행 수
 */
export async function replaceMatchResults(
  match: AnnouncementMatch
): Promise<number> {
  try {
    return await db.transaction(async (tx) => {
      // 기존 결과 삭제 — 동일 사용자 × 시나리오 × 공고 조합만 삭제 (다른 시나리오 결과 보호)
      await tx
        .delete(eligibilityResults)
        .where(
          and(
            eq(eligibilityResults.userId, match.userId),
            eq(eligibilityResults.scenarioId, match.scenarioId),
            eq(eligibilityResults.announcementId, match.announcementId)
          )
        );

      if (match.conditionMatches.length === 0) return 0;

      const now = new Date();
      const rows = await tx
        .insert(eligibilityResults)
        .values(
          match.conditionMatches.map((cm: ConditionMatch) => ({
            userId: match.userId,
            scenarioId: match.scenarioId,
            announcementId: match.announcementId,
            conditionId: cm.conditionId,
            result: cm.result,
            details: {
              targetGroup: cm.targetGroup,
              rules: cm.rules,
            },
            matchedAt: now,
            createdAt: now,
          }))
        )
        .returning({ id: eligibilityResults.id });

      return rows.length;
    });
  } catch (error) {
    console.error(
      `[replaceMatchResults] 매칭 결과 저장 실패 (user=${match.userId}, announcement=${match.announcementId}):`,
      error
    );
    throw error;
  }
}

/**
 * 매칭 대상 공고 + 조건 함께 조회 — 마감되지 않은 공고만
 * 대시보드 실시간 매칭 또는 배치 매칭에 사용
 */
export async function getOpenAnnouncementsWithConditions(): Promise<
  {
    announcement: typeof announcements.$inferSelect;
    conditions: (typeof eligibilityConditions.$inferSelect)[];
  }[]
> {
  try {
    // 활성 공고: status가 CLOSED가 아니고, 신청 마감일이 오늘 이후이거나 미정
    // (status는 크롤링 시점 값이라 stale 가능 → applicationEnd 직접 비교 병행)
    const today = sql`CURRENT_DATE`;
    const openAnnouncements = await db
      .select()
      .from(announcements)
      .where(
        and(
          ne(announcements.status, "CLOSED"),
          or(
            isNull(announcements.applicationEnd),
            gte(announcements.applicationEnd, today)
          )
        )
      )
      .orderBy(desc(announcements.applicationEnd));

    if (openAnnouncements.length === 0) return [];

    const announcementIds = openAnnouncements.map((a) => a.id);
    const conditions = await db
      .select()
      .from(eligibilityConditions)
      .where(inArray(eligibilityConditions.announcementId, announcementIds));

    // 공고별로 조건 그룹핑
    const byAnnouncementId = new Map<
      string,
      (typeof eligibilityConditions.$inferSelect)[]
    >();
    for (const c of conditions) {
      const list = byAnnouncementId.get(c.announcementId) ?? [];
      list.push(c);
      byAnnouncementId.set(c.announcementId, list);
    }

    return openAnnouncements.map((a) => ({
      announcement: a,
      conditions: byAnnouncementId.get(a.id) ?? [],
    }));
  } catch (error) {
    console.error("[getOpenAnnouncementsWithConditions] 조회 실패:", error);
    throw error;
  }
}

/**
 * 특정 사용자의 모든 매칭 결과 조회 — 대시보드 필터링용
 */
export async function getMatchResultsByUser(
  userId: string
): Promise<(typeof eligibilityResults.$inferSelect)[]> {
  try {
    return await db
      .select()
      .from(eligibilityResults)
      .where(eq(eligibilityResults.userId, userId))
      .orderBy(desc(eligibilityResults.matchedAt));
  } catch (error) {
    console.error(`[getMatchResultsByUser] 조회 실패 (user=${userId}):`, error);
    throw error;
  }
}
