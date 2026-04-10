/**
 * 크롤링 통합 실행 스크립트 — GitHub Actions cron에서 호출
 * 마이홈(LH 포함) → SH 순서로 순차 실행 후 DB 저장
 */

import { config } from "dotenv";

// .env.local 로드 (GitHub Actions에서는 환경변수 직접 주입이므로 파일 없어도 OK)
config({ path: ".env.local" });

import { MyhomeScraper } from "../src/lib/scraper/myhome";
import { ShScraper } from "../src/lib/scraper/sh";
import { upsertAnnouncements } from "../src/lib/db/queries/announcement";
import type { Scraper, ScrapeResult } from "../src/lib/scraper/types";
import type { UpsertResult } from "../src/lib/db/queries/announcement";

// 소스별 실행 요약 타입
interface RunSummary {
  source: string;
  scrapedCount: number;
  savedCount: number;
  failedCount: number;
  scrapeErrors: string[];
  saveErrors: string[];
  elapsedMs: number;
}

/**
 * 단일 크롤러 실행 후 DB 저장 — 에러 발생 시 요약에 기록하고 계속 진행
 */
async function runScraper(scraper: Scraper): Promise<RunSummary> {
  const start = Date.now();
  const summary: RunSummary = {
    source: scraper.source,
    scrapedCount: 0,
    savedCount: 0,
    failedCount: 0,
    scrapeErrors: [],
    saveErrors: [],
    elapsedMs: 0,
  };

  let scrapeResult: ScrapeResult | null = null;

  try {
    console.log(`\n[${scraper.source}] 크롤링 시작...`);
    scrapeResult = await scraper.scrape();
    summary.scrapedCount = scrapeResult.announcements.length;
    summary.scrapeErrors = scrapeResult.errors.map(
      (e) => `[${e.phase}${e.externalId ? ` / ${e.externalId}` : ""}] ${e.message}`
    );
    console.log(`[${scraper.source}] 수집 완료: ${summary.scrapedCount}건, 에러: ${scrapeResult.errors.length}건`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scraper.source}] 크롤링 중 치명적 에러:`, message);
    summary.scrapeErrors.push(`[fatal] ${message}`);
  } finally {
    await scraper.dispose();
  }

  // 크롤링 결과가 있으면 DB 저장
  if (scrapeResult && scrapeResult.announcements.length > 0) {
    try {
      console.log(`[${scraper.source}] DB 저장 시작: ${scrapeResult.announcements.length}건`);
      const upsertResults: UpsertResult[] = await upsertAnnouncements(scrapeResult.announcements);
      summary.savedCount = upsertResults.filter((r) => r.success).length;
      summary.failedCount = upsertResults.filter((r) => !r.success).length;
      summary.saveErrors = upsertResults
        .filter((r) => !r.success)
        .map((r) => `[${r.externalId}] ${r.error ?? "unknown error"}`);
      console.log(`[${scraper.source}] DB 저장 완료: 성공 ${summary.savedCount}건, 실패 ${summary.failedCount}건`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${scraper.source}] DB 저장 중 치명적 에러:`, message);
      summary.saveErrors.push(`[fatal] ${message}`);
      summary.failedCount = scrapeResult.announcements.length;
    }
  }

  summary.elapsedMs = Date.now() - start;
  return summary;
}

/**
 * 실행 결과 요약 출력
 */
function printSummary(summaries: RunSummary[], totalElapsedMs: number): void {
  console.log("\n========== 실행 결과 요약 ==========");

  for (const s of summaries) {
    console.log(`\n[${s.source}] (${(s.elapsedMs / 1000).toFixed(1)}초)`);
    console.log(`  수집: ${s.scrapedCount}건 | 저장 성공: ${s.savedCount}건 | 저장 실패: ${s.failedCount}건`);

    if (s.scrapeErrors.length > 0) {
      console.log(`  크롤링 에러 (${s.scrapeErrors.length}건):`);
      s.scrapeErrors.forEach((e) => console.log(`    - ${e}`));
    }
    if (s.saveErrors.length > 0) {
      console.log(`  저장 에러 (${s.saveErrors.length}건):`);
      s.saveErrors.forEach((e) => console.log(`    - ${e}`));
    }
  }

  const totalScraped = summaries.reduce((acc, s) => acc + s.scrapedCount, 0);
  const totalSaved = summaries.reduce((acc, s) => acc + s.savedCount, 0);
  const totalFailed = summaries.reduce((acc, s) => acc + s.failedCount, 0);

  console.log("\n------------------------------------");
  console.log(`총 수집: ${totalScraped}건 | 총 저장 성공: ${totalSaved}건 | 총 저장 실패: ${totalFailed}건`);
  console.log(`총 소요 시간: ${(totalElapsedMs / 1000).toFixed(1)}초`);
  console.log("====================================\n");
}

/**
 * 전체 에러 존재 여부 확인 — 저장 실패 또는 치명적 크롤링 에러
 */
function hasAnyError(summaries: RunSummary[]): boolean {
  return summaries.some(
    (s) =>
      s.failedCount > 0 ||
      s.scrapeErrors.some((e) => e.startsWith("[fatal]"))
  );
}

/**
 * 메인 진입점
 */
async function main(): Promise<void> {
  console.log("크롤링 파이프라인 시작:", new Date().toISOString());

  const totalStart = Date.now();
  const summaries: RunSummary[] = [];

  // 마이홈 크롤러 (LH 공고 전체 커버) — 순차 실행 (Playwright 브라우저 공유 불가)
  const myhomeScraper = new MyhomeScraper();
  summaries.push(await runScraper(myhomeScraper));

  // SH 크롤러 (서울주택도시공사)
  const shScraper = new ShScraper();
  summaries.push(await runScraper(shScraper));

  const totalElapsedMs = Date.now() - totalStart;
  printSummary(summaries, totalElapsedMs);

  // 에러가 있으면 exit code 1로 종료 (GitHub Actions 실패 감지)
  if (hasAnyError(summaries)) {
    console.error("일부 작업에서 에러가 발생했습니다. 상세 내용은 위 로그를 확인하세요.");
    process.exit(1);
  }

  console.log("크롤링 파이프라인 정상 완료.");
}

main().catch((error) => {
  console.error("크롤링 파이프라인 치명적 오류:", error);
  process.exit(1);
});
