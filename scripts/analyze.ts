/**
 * 자격 분석 통합 실행 스크립트 — GitHub Actions cron에서 호출
 * pdfText가 있는 미분석 공고를 찾아 자격 조건을 추출·저장
 *
 * Usage:
 *   pnpm tsx scripts/analyze.ts          # 미분석 공고만
 *   pnpm tsx scripts/analyze.ts --all    # 전체 재분석
 *   pnpm tsx scripts/analyze.ts --id <uuid>  # 특정 공고만
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { analyzeAnnouncement, PARSER_VERSION } from "../src/lib/analyzer";
import { getUnanalyzedAnnouncements } from "../src/lib/db/queries/condition";
import { db } from "../src/lib/db";
import { announcements } from "../src/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import type { AnalyzeSummary } from "../src/lib/analyzer/types";

/**
 * CLI 인자 파싱
 */
function parseArgs(): { mode: "unanalyzed" | "all" | "single"; id?: string } {
  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    return { mode: "all" };
  }

  const idIndex = args.indexOf("--id");
  if (idIndex !== -1 && args[idIndex + 1]) {
    return { mode: "single", id: args[idIndex + 1] };
  }

  return { mode: "unanalyzed" };
}

/**
 * 분석 대상 공고 조회
 */
async function fetchTargets(
  mode: "unanalyzed" | "all" | "single",
  id?: string
): Promise<{ id: string; title: string; housingType: string | null; pdfText: string }[]> {
  if (mode === "single" && id) {
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        housingType: announcements.housingType,
        pdfText: announcements.pdfText,
      })
      .from(announcements)
      .where(eq(announcements.id, id));

    return rows.filter(
      (r): r is { id: string; title: string; housingType: string | null; pdfText: string } =>
        r.pdfText !== null && r.pdfText !== ""
    );
  }

  if (mode === "all") {
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        housingType: announcements.housingType,
        pdfText: announcements.pdfText,
      })
      .from(announcements)
      .where(sql`${announcements.pdfText} IS NOT NULL AND ${announcements.pdfText} != ''`)
      .orderBy(desc(announcements.createdAt));

    return rows.filter(
      (r): r is { id: string; title: string; housingType: string | null; pdfText: string } =>
        r.pdfText !== null
    );
  }

  return getUnanalyzedAnnouncements(PARSER_VERSION);
}

/**
 * 실행 결과 요약 출력
 */
function printSummary(summaries: AnalyzeSummary[], elapsedMs: number): void {
  console.log("\n========== 분석 결과 요약 ==========");

  for (const s of summaries) {
    const status = s.success ? "✓" : "✗";
    console.log(`  ${status} ${s.title} (${s.housingType ?? "알 수 없음"}): ${s.conditionCount}건`);
    if (s.error) {
      console.log(`    에러: ${s.error}`);
    }
  }

  const total = summaries.length;
  const success = summaries.filter((s) => s.success).length;
  const totalConditions = summaries.reduce((acc, s) => acc + s.conditionCount, 0);

  console.log("\n------------------------------------");
  console.log(`분석 대상: ${total}건 | 성공: ${success}건 | 실패: ${total - success}건`);
  console.log(`총 추출 조건: ${totalConditions}건`);
  console.log(`파서 버전: ${PARSER_VERSION}`);
  console.log(`소요 시간: ${(elapsedMs / 1000).toFixed(1)}초`);
  console.log("====================================\n");
}

/**
 * 메인 진입점
 */
async function main(): Promise<void> {
  console.log("자격 분석 파이프라인 시작:", new Date().toISOString());
  console.log(`파서 버전: ${PARSER_VERSION}`);

  const { mode, id } = parseArgs();
  console.log(`실행 모드: ${mode}${id ? ` (${id})` : ""}`);

  const start = Date.now();
  const targets = await fetchTargets(mode, id);

  if (targets.length === 0) {
    console.log("분석 대상 공고가 없습니다.");
    return;
  }

  console.log(`분석 대상: ${targets.length}건\n`);

  // 순차 분석 (DB 트랜잭션 충돌 방지)
  const summaries: AnalyzeSummary[] = [];
  for (const target of targets) {
    const summary = await analyzeAnnouncement(target);
    summaries.push(summary);
  }

  const elapsedMs = Date.now() - start;
  printSummary(summaries, elapsedMs);

  // 실패 건이 있으면 exit code 1
  const hasError = summaries.some((s) => !s.success);
  if (hasError) {
    console.error("일부 분석에서 에러가 발생했습니다.");
    process.exit(1);
  }

  console.log("자격 분석 파이프라인 정상 완료.");
}

main()
  .then(() => {
    // db 모듈이 postgres 커넥션 풀을 열어두기 때문에 명시 종료 필요
    // (process.exitCode가 main() 내부에서 set된 경우 그대로 반영)
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    console.error("자격 분석 파이프라인 치명적 오류:", error);
    process.exit(1);
  });
