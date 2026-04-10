// 공고 DB 쿼리 함수 — 크롤러 파이프라인에서 수집 데이터 저장 시 사용

import { eq, desc } from "drizzle-orm";
import { db } from "../index";
import { announcements } from "../schema";
import type { RawAnnouncement } from "../../scraper/types";

// 배치 upsert 결과 타입
export type UpsertResult = {
  externalId: string;
  success: boolean;
  error?: string;
};

/**
 * 공고 1건 upsert — externalId 충돌 시 id, externalId, createdAt 제외한 모든 필드 업데이트
 */
export async function upsertAnnouncement(
  raw: RawAnnouncement
): Promise<typeof announcements.$inferSelect> {
  try {
    const values = {
      externalId: raw.externalId,
      source: raw.source,
      title: raw.title,
      detailUrl: raw.detailUrl,
      status: raw.status ?? "UPCOMING",
      housingType: raw.housingType ?? null,
      region: raw.region ?? null,
      district: raw.district ?? null,
      supplyCount: raw.supplyCount ?? null,
      areaSqm: raw.areaSqm ?? null,
      deposit: raw.deposit ?? null,
      monthlyRent: raw.monthlyRent ?? null,
      applicationStart: raw.applicationStart ?? null,
      applicationEnd: raw.applicationEnd ?? null,
      announcementDate: raw.announcementDate ?? null,
      winnerDate: raw.winnerDate ?? null,
      contractStart: raw.contractStart ?? null,
      contractEnd: raw.contractEnd ?? null,
      pdfUrl: raw.pdfUrl ?? null,
      pdfText: raw.pdfText ?? null,
      rawHtml: raw.rawHtml ?? null,
      isModified: raw.isModified ?? false,
    } as const;

    const [row] = await db
      .insert(announcements)
      .values(values)
      .onConflictDoUpdate({
        target: announcements.externalId,
        set: {
          source: values.source,
          title: values.title,
          detailUrl: values.detailUrl,
          status: values.status,
          housingType: values.housingType,
          region: values.region,
          district: values.district,
          supplyCount: values.supplyCount,
          areaSqm: values.areaSqm,
          deposit: values.deposit,
          monthlyRent: values.monthlyRent,
          applicationStart: values.applicationStart,
          applicationEnd: values.applicationEnd,
          announcementDate: values.announcementDate,
          winnerDate: values.winnerDate,
          contractStart: values.contractStart,
          contractEnd: values.contractEnd,
          pdfUrl: values.pdfUrl,
          pdfText: values.pdfText,
          rawHtml: values.rawHtml,
          isModified: values.isModified,
          updatedAt: new Date(),
        },
      })
      .returning();

    return row;
  } catch (error) {
    console.error(`[upsertAnnouncement] 공고 저장 실패 (${raw.externalId}):`, error);
    throw error;
  }
}

/**
 * 공고 배열 순차 upsert — 충돌 방지를 위해 병렬 처리 하지 않음
 */
export async function upsertAnnouncements(
  raws: RawAnnouncement[]
): Promise<UpsertResult[]> {
  const results: UpsertResult[] = [];

  for (const raw of raws) {
    try {
      await upsertAnnouncement(raw);
      results.push({ externalId: raw.externalId, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[upsertAnnouncements] 저장 실패 (${raw.externalId}):`, message);
      results.push({ externalId: raw.externalId, success: false, error: message });
    }
  }

  return results;
}

/**
 * externalId로 공고 단건 조회
 */
export async function findByExternalId(
  externalId: string
): Promise<typeof announcements.$inferSelect | undefined> {
  try {
    return await db.query.announcements.findFirst({
      where: eq(announcements.externalId, externalId),
    });
  } catch (error) {
    console.error(`[findByExternalId] 공고 조회 실패 (${externalId}):`, error);
    throw error;
  }
}

/**
 * 최근 공고 목록 조회 — createdAt 내림차순
 */
export async function getRecentAnnouncements(
  limit: number = 20
): Promise<(typeof announcements.$inferSelect)[]> {
  try {
    return await db.query.announcements.findMany({
      orderBy: desc(announcements.createdAt),
      limit,
    });
  } catch (error) {
    console.error("[getRecentAnnouncements] 공고 목록 조회 실패:", error);
    throw error;
  }
}
