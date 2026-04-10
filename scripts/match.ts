/**
 * 자격 매칭 통합 실행 스크립트 — GitHub Actions cron 또는 수동 실행
 * 등록된 모든 사용자 프로필 × 마감되지 않은 모든 공고를 매칭하여 결과 저장
 *
 * Usage:
 *   pnpm tsx scripts/match.ts                # 전체 사용자 × 전체 활성 공고
 *   pnpm tsx scripts/match.ts --user <uuid>  # 특정 사용자만
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { userProfiles } from "../src/lib/db/schema";
import { matchAnnouncement, MATCHER_VERSION } from "../src/lib/matcher";
import { assertReferenceFresh } from "../src/lib/matcher/income-reference";
import {
  getOpenAnnouncementsWithConditions,
  replaceMatchResults,
} from "../src/lib/db/queries/eligibility";
import { listScenarios } from "../src/lib/db/queries/profile-scenario";

interface RunSummary {
  userId: string;
  scenarioName: string;
  totalAnnouncements: number;
  eligible: number;
  checkNeeded: number;
  ineligible: number;
}

/**
 * CLI 인자 파싱
 */
function parseArgs(): { userId?: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--user");
  if (idx !== -1 && args[idx + 1]) return { userId: args[idx + 1] };
  return {};
}

/**
 * 사용자 1명 × 시나리오 1개에 대해 모든 활성 공고를 매칭하고 결과 저장
 */
async function matchUser(
  profile: typeof userProfiles.$inferSelect,
  scenario: Awaited<ReturnType<typeof listScenarios>>[number],
  openData: Awaited<ReturnType<typeof getOpenAnnouncementsWithConditions>>
): Promise<RunSummary> {
  // user + scenario 필드 병합 — 공통 필드(id, userId, createdAt, updatedAt)는 user 기준 유지
  const merged = { ...profile, ...scenario, id: profile.id, userId: profile.userId };

  const summary: RunSummary = {
    userId: profile.userId,
    scenarioName: scenario.name,
    totalAnnouncements: openData.length,
    eligible: 0,
    checkNeeded: 0,
    ineligible: 0,
  };

  for (const { announcement, conditions } of openData) {
    if (conditions.length === 0) continue;

    const match = matchAnnouncement(
      profile.userId,
      scenario.id,
      announcement.id,
      merged,
      conditions
    );

    try {
      await replaceMatchResults(match);
    } catch (err) {
      console.error(
        `  ✗ ${announcement.title} 매칭 저장 실패:`,
        err instanceof Error ? err.message : String(err)
      );
      continue;
    }

    if (match.bestResult === "ELIGIBLE") summary.eligible++;
    else if (match.bestResult === "CHECK_NEEDED") summary.checkNeeded++;
    else summary.ineligible++;
  }

  return summary;
}

/**
 * 메인 진입점
 */
async function main(): Promise<void> {
  console.log("자격 매칭 파이프라인 시작:", new Date().toISOString());
  console.log(`매처 버전: ${MATCHER_VERSION}`);

  // 도시근로자 월평균소득 표 갱신 점검 — 1년 이상 stale이면 경고만 출력하고 진행
  const stalenessWarning = assertReferenceFresh();
  if (stalenessWarning) {
    console.warn(`⚠️  ${stalenessWarning}`);
  }

  const { userId } = parseArgs();
  const start = Date.now();

  // 대상 사용자 프로필 조회
  const profiles = userId
    ? await db.select().from(userProfiles).where(eq(userProfiles.userId, userId))
    : await db.select().from(userProfiles);

  if (profiles.length === 0) {
    console.log("매칭 대상 사용자 프로필이 없습니다.");
    return;
  }

  // 활성 공고 + 조건 1회만 조회 (모든 사용자가 공유)
  const openData = await getOpenAnnouncementsWithConditions();
  const withConditions = openData.filter((d) => d.conditions.length > 0);

  console.log(
    `사용자 ${profiles.length}명 × 활성 공고 ${withConditions.length}건 매칭 시작\n`
  );

  if (withConditions.length === 0) {
    console.log("자격 조건이 분석된 활성 공고가 없습니다.");
    return;
  }

  const summaries: RunSummary[] = [];
  for (const profile of profiles) {
    const scenarios = await listScenarios(profile.userId);
    if (scenarios.length === 0) {
      console.log(`  - user=${profile.userId.slice(0, 8)}… : 시나리오 없음, 건너뜀`);
      continue;
    }
    for (const scenario of scenarios) {
      const summary = await matchUser(profile, scenario, withConditions);
      summaries.push(summary);
      console.log(
        `  ✓ user=${profile.userId.slice(0, 8)}… scenario="${scenario.name}" : 자격 ${summary.eligible} / 확인필요 ${summary.checkNeeded} / 부적합 ${summary.ineligible}`
      );
    }
  }

  const elapsed = Date.now() - start;
  const totals = summaries.reduce(
    (acc, s) => ({
      eligible: acc.eligible + s.eligible,
      checkNeeded: acc.checkNeeded + s.checkNeeded,
      ineligible: acc.ineligible + s.ineligible,
    }),
    { eligible: 0, checkNeeded: 0, ineligible: 0 }
  );

  console.log("\n========== 매칭 결과 요약 ==========");
  console.log(`사용자: ${summaries.length}명`);
  console.log(`자격 적합: ${totals.eligible}건`);
  console.log(`확인 필요: ${totals.checkNeeded}건`);
  console.log(`부적합: ${totals.ineligible}건`);
  console.log(`소요 시간: ${(elapsed / 1000).toFixed(1)}초`);
  console.log("====================================\n");

  console.log("자격 매칭 파이프라인 정상 완료.");
}

main().catch((error) => {
  console.error("자격 매칭 파이프라인 치명적 오류:", error);
  process.exit(1);
});
