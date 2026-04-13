/**
 * MyhomeScraper 로컬 검증 — DB 쓰기 없이 결과만 출력
 *
 * 왜 별도 스크립트인가:
 *   scrape.ts는 기본 설정(전체 페이지)으로 돌리면 110건 + PDF 다운로드 ~5분 소요.
 *   여기선 maxPages=2로 제한하여 ~10건만 빠르게 확인.
 *
 * 실행: npx tsx scripts/test-myhome-local.ts
 */

import dotenv from "dotenv";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

import { MyhomeScraper } from "../src/lib/scraper/myhome";

async function main(): Promise<void> {
  const scraper = new MyhomeScraper({
    maxPages: 2, // ~10건만
    requestDelayMs: 500, // 로컬은 빨리
    extractPdf: true,
  });

  const start = Date.now();
  const result = await scraper.scrape();
  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n=========== MyhomeScraper 결과 ===========");
  console.log(`소요 시간: ${elapsedSec}초`);
  console.log(`수집 건수: ${result.announcements.length}`);
  console.log(`에러 건수: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\n--- 에러 ---");
    for (const e of result.errors) {
      console.log(`  [${e.phase}${e.externalId ? `/${e.externalId}` : ""}] ${e.message}`);
    }
  }

  console.log("\n--- 수집된 공고 (앞 5건) ---");
  for (const a of result.announcements.slice(0, 5)) {
    console.log(`\n  externalId: ${a.externalId}`);
    console.log(`  title: ${a.title}`);
    console.log(`  status: ${a.status}`);
    console.log(`  housingType: ${a.housingType}`);
    console.log(`  region: ${a.region}`);
    console.log(`  announcementDate: ${a.announcementDate}`);
    console.log(`  winnerDate: ${a.winnerDate}`);
    console.log(`  detailUrl: ${a.detailUrl}`);
    console.log(`  rawHtml: ${a.rawHtml ? `${a.rawHtml.length} bytes` : "(none)"}`);
    console.log(`  pdfText: ${a.pdfText ? `${a.pdfText.length} chars (앞 100자: ${a.pdfText.slice(0, 100).replace(/\s+/g, " ")})` : "(none)"}`);
  }

  // 통계: rawHtml/pdfText 보유 건수
  const withHtml = result.announcements.filter((a) => a.rawHtml).length;
  const withPdf = result.announcements.filter((a) => a.pdfText).length;
  console.log(`\n--- 통계 ---`);
  console.log(`  rawHtml 보유: ${withHtml}/${result.announcements.length}`);
  console.log(`  pdfText 보유: ${withPdf}/${result.announcements.length}`);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test 실행 실패:", err);
  process.exit(1);
});
