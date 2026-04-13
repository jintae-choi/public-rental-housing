/**
 * ShScraper 로컬 검증 — DB 쓰기 없이 결과만 출력 (maxPages=2)
 */

import dotenv from "dotenv";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

import { ShScraper } from "../src/lib/scraper/sh";

async function main(): Promise<void> {
  const scraper = new ShScraper({
    maxPages: 2,
    requestDelayMs: 500,
  });

  const start = Date.now();
  const result = await scraper.scrape();
  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n=========== ShScraper 결과 ===========");
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
    console.log(`  applicationStart: ${a.applicationStart}`);
    console.log(`  applicationEnd: ${a.applicationEnd}`);
    console.log(`  detailUrl: ${a.detailUrl}`);
    console.log(`  rawHtml: ${a.rawHtml ? `${a.rawHtml.length} bytes` : "(none)"}`);
  }

  const withHtml = result.announcements.filter((a) => a.rawHtml).length;
  console.log(`\n--- 통계 ---`);
  console.log(`  rawHtml 보유: ${withHtml}/${result.announcements.length}`);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test 실행 실패:", err);
  process.exit(1);
});
