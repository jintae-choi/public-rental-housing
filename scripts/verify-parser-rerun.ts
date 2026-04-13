/**
 * PARSER_VERSION 재분석 로직 단위 검증
 *
 * 검증 대상: src/lib/db/queries/condition.ts:111 의 getUnanalyzedAnnouncements
 *
 * 시나리오:
 *   announcement 4건을 seed 한 뒤 getUnanalyzedAnnouncements('1.1.0')을 호출하여
 *   "현재 버전(1.1.0)으로 미분석된" announcement만 정확히 골라오는지 확인.
 *
 *   A1: pdfText 있음, condition 없음           → 반환 기대 (신규)
 *   A2: pdfText 있음, condition(parserVersion='1.0.0')  → 반환 기대 (구버전 → 재분석)
 *   A3: pdfText 있음, condition(parserVersion='1.1.0')  → 반환 NOT 기대 (이미 최신)
 *   A4: pdfText 없음                             → 반환 NOT 기대 (분석 불가)
 *
 * 실패 시 → 새 PARSER_VERSION 배포 후 cron이 옛 데이터를 재분석하지 않을 수 있다는 뜻.
 *
 * 실행: node --import tsx scripts/verify-parser-rerun.ts
 */

import dotenv from "dotenv";
import fs from "node:fs";

// ⚠️ ESM 임포트는 호이스팅되어 db 모듈이 dotenv 전에 로드됨 → 동적 import로 우회
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

type SeedRow = {
  externalId: string;
  pdfText: string | null;
  conditionParserVersion: string | null;
};

async function main(): Promise<void> {
  // dotenv 로드 후에야 DATABASE_URL이 잡히므로 db 모듈을 동적 import
  const { db } = await import("../src/lib/db/index");
  const { announcements, eligibilityConditions } = await import(
    "../src/lib/db/schema"
  );
  const { getUnanalyzedAnnouncements } = await import(
    "../src/lib/db/queries/condition"
  );
  const { inArray } = await import("drizzle-orm");

  const tag = `verify-parser-rerun-${Date.now()}`;
  const seed: SeedRow[] = [
    {
      externalId: `${tag}-A1`,
      pdfText: "테스트 공고 본문 A1",
      conditionParserVersion: null,
    },
    {
      externalId: `${tag}-A2`,
      pdfText: "테스트 공고 본문 A2",
      conditionParserVersion: "1.0.0",
    },
    {
      externalId: `${tag}-A3`,
      pdfText: "테스트 공고 본문 A3",
      conditionParserVersion: "1.1.0",
    },
    {
      externalId: `${tag}-A4`,
      pdfText: null,
      conditionParserVersion: null,
    },
  ];

  const externalIds = seed.map((s) => s.externalId);
  const annIdByExt: Record<string, string> = {};

  try {
    // 1) announcements seed
    const inserted = await db
      .insert(announcements)
      .values(
        seed.map((s) => ({
          externalId: s.externalId,
          source: "MYHOME" as const,
          title: `[verify-parser-rerun] ${s.externalId}`,
          status: "OPEN" as const,
          pdfText: s.pdfText,
        }))
      )
      .returning({ id: announcements.id, externalId: announcements.externalId });
    for (const r of inserted) annIdByExt[r.externalId] = r.id;

    // 2) eligibility_conditions seed (있는 것만)
    const condRows = seed
      .filter((s) => s.conditionParserVersion !== null)
      .map((s) => ({
        announcementId: annIdByExt[s.externalId],
        targetGroup: null,
        priorityRank: null,
        incomeLimit: null,
        assetLimit: null,
        carLimit: null,
        ageMin: null,
        ageMax: null,
        childAgeMax: null,
        homelessMonths: null,
        regionRequirement: null,
        subscriptionMonths: null,
        subscriptionPayments: null,
        householdType: null,
        marriageCondition: null,
        workDurationMonths: null,
        maxResidenceYears: null,
        parentIncomeIncluded: null,
        scoringCriteria: null,
        specialConditions: null,
        rawAnalysis: "test seed",
        analyzedAt: new Date(),
        parserVersion: s.conditionParserVersion!,
      }));
    if (condRows.length > 0) {
      await db.insert(eligibilityConditions).values(condRows);
    }

    // 3) 검증: 1.1.0 기준 미분석 조회
    const result = await getUnanalyzedAnnouncements("1.1.0");
    const resultExternalIds = new Set(
      result
        .map((r) => {
          const ext = Object.entries(annIdByExt).find(
            ([, id]) => id === r.id
          )?.[0];
          return ext;
        })
        .filter((x): x is string => !!x)
    );

    const expectedIn = [`${tag}-A1`, `${tag}-A2`];
    const expectedOut = [`${tag}-A3`, `${tag}-A4`];

    const checks: { name: string; passed: boolean; detail: string }[] = [];
    for (const ext of expectedIn) {
      const present = resultExternalIds.has(ext);
      checks.push({
        name: `${ext} 재분석 대상에 포함`,
        passed: present,
        detail: present ? "포함됨 ✅" : "❌ 누락 — 재분석 안 됨",
      });
    }
    for (const ext of expectedOut) {
      const absent = !resultExternalIds.has(ext);
      checks.push({
        name: `${ext} 재분석 대상에서 제외`,
        passed: absent,
        detail: absent ? "제외됨 ✅" : "❌ 잘못 포함됨",
      });
    }

    console.log("\n=== PARSER_VERSION 재분석 로직 검증 ===");
    for (const c of checks) {
      console.log(`${c.passed ? "✅" : "❌"} ${c.name}`);
      console.log(`   ${c.detail}`);
    }
    const failed = checks.filter((c) => !c.passed).length;
    console.log(
      `\n총 ${checks.length}건 중 ${checks.length - failed}건 통과, ${failed}건 실패`
    );

    if (failed > 0) process.exitCode = 1;
  } catch (e) {
    console.error("검증 실행 중 에러:", e);
    process.exitCode = 1;
  } finally {
    // 4) cleanup: 시드한 announcements 전부 삭제 (cascade로 conditions도 삭제)
    try {
      await db
        .delete(announcements)
        .where(inArray(announcements.externalId, externalIds));
      console.log("[cleanup] seed 데이터 삭제 완료");
    } catch (e) {
      console.error("[cleanup] 삭제 실패:", e);
    }
    process.exit(process.exitCode ?? 0);
  }
}

main();
