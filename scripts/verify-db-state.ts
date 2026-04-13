/**
 * DB 상태 검증 — cron 성공 후 실제로 행이 들어갔는지 확인
 *
 * 검증 항목:
 *   1. announcements 총 건수, 소스별, 상태별
 *   2. eligibility_conditions 총 건수, parser_version='1.1.0'
 *   3. eligibility_results 총 건수
 *   4. user_profiles 건수
 *   5. profile_scenarios 건수
 *   6. 가장 최근 announcement의 createdAt
 *
 * 실행: npx tsx scripts/verify-db-state.ts
 */

import dotenv from "dotenv";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

async function main(): Promise<void> {
  const { db } = await import("../src/lib/db/index");
  const {
    announcements,
    eligibilityConditions,
    eligibilityResults,
    userProfiles,
    profileScenarios,
  } = await import("../src/lib/db/schema");
  const { sql, eq, desc } = await import("drizzle-orm");

  console.log("=== DB 상태 검증 ===\n");

  // 1. announcements 전체
  const annTotal = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements);
  console.log(`[announcements] 총 ${annTotal[0].count}건`);

  // 2. announcements 소스별
  const annBySource = await db
    .select({
      source: announcements.source,
      count: sql<number>`count(*)::int`,
    })
    .from(announcements)
    .groupBy(announcements.source);
  for (const row of annBySource) {
    console.log(`  ${row.source}: ${row.count}건`);
  }

  // 3. announcements 상태별
  const annByStatus = await db
    .select({
      status: announcements.status,
      count: sql<number>`count(*)::int`,
    })
    .from(announcements)
    .groupBy(announcements.status);
  console.log(`\n[announcements] 상태별`);
  for (const row of annByStatus) {
    console.log(`  ${row.status}: ${row.count}건`);
  }

  // 4. pdfText 보유 비율
  const annWithPdf = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements)
    .where(sql`${announcements.pdfText} is not null and length(${announcements.pdfText}) > 0`);
  console.log(`\n[announcements] pdfText 보유: ${annWithPdf[0].count}건`);

  // 5. eligibility_conditions
  const condTotal = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eligibilityConditions);
  console.log(`\n[eligibility_conditions] 총 ${condTotal[0].count}건`);

  const condByVersion = await db
    .select({
      version: eligibilityConditions.parserVersion,
      count: sql<number>`count(*)::int`,
    })
    .from(eligibilityConditions)
    .groupBy(eligibilityConditions.parserVersion);
  for (const row of condByVersion) {
    console.log(`  parserVersion=${row.version}: ${row.count}건`);
  }

  // 6. 분석된 announcement (distinct)
  const analyzedAnn = await db
    .select({
      count: sql<number>`count(distinct ${eligibilityConditions.announcementId})::int`,
    })
    .from(eligibilityConditions);
  console.log(`  분석된 distinct 공고: ${analyzedAnn[0].count}건`);

  // 7. eligibility_results
  const resTotal = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eligibilityResults);
  console.log(`\n[eligibility_results] 총 ${resTotal[0].count}건`);

  // 8. 사용자 프로필
  const profTotal = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userProfiles);
  console.log(`\n[user_profiles] 총 ${profTotal[0].count}건`);

  const scenTotal = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profileScenarios);
  console.log(`[profile_scenarios] 총 ${scenTotal[0].count}건`);

  // 9. 가장 최근 announcement
  const recent = await db
    .select({
      externalId: announcements.externalId,
      title: announcements.title,
      source: announcements.source,
      createdAt: announcements.createdAt,
    })
    .from(announcements)
    .orderBy(desc(announcements.createdAt))
    .limit(3);
  console.log(`\n[최근 등록 공고 3건]`);
  for (const a of recent) {
    console.log(`  [${a.source}] ${a.externalId}: ${a.title.slice(0, 60)} (${a.createdAt.toISOString()})`);
  }

  // 10. 분석된 공고 1건의 조건 샘플
  const sampleCond = await db
    .select({
      annTitle: announcements.title,
      condCount: sql<number>`count(${eligibilityConditions.id})::int`,
    })
    .from(eligibilityConditions)
    .innerJoin(announcements, eq(eligibilityConditions.announcementId, announcements.id))
    .groupBy(announcements.title)
    .orderBy(desc(sql`count(${eligibilityConditions.id})`))
    .limit(3);
  console.log(`\n[조건 가장 많이 추출된 공고 3건]`);
  for (const s of sampleCond) {
    console.log(`  ${s.condCount}개 조건: ${s.annTitle.slice(0, 60)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("검증 실패:", e);
    process.exit(1);
  });
