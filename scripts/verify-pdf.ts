/**
 * Step 2.5: PDF 검증 스크립트 (Playwright 기반)
 * 마이홈 사이트에서 공고 목록 + 상세 페이지 + PDF 텍스트 수집
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
import { extractPdfText } from "../src/lib/scraper/base";
import { writeFileSync } from "fs";
import { join } from "path";

const MAX_PDF_ITEMS = 5;
const DETAIL_BASE_URL = "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do";

interface ListItem {
  pblancId: string;
  title: string;
  status: string;
  region: string;
  institution: string;
  announcementDate: string;
  winnerDate: string;
}

interface DetailInfo {
  atchFileId: string;
  fileSn: string;
  housingType: string;
  applicationStart: string;
  applicationEnd: string;
  pdfFileName: string;
}

async function extractListFromDom(page: Page): Promise<ListItem[]> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll("table.tb-list tbody tr");
    const result: ListItem[] = [];
    rows.forEach((row) => {
      const link = row.querySelector("a.li-title");
      if (!link) return;
      const onclickStr = link.getAttribute("href") ?? "";
      const idMatch = onclickStr.match(/fnSelectDetail\s*\(\s*'?(\d+)'?\s*\)/);
      if (!idMatch) return;
      const statusEl = row.querySelector(".housing-state");
      const regionEl = row.querySelector(".f-loc");
      const cells = row.querySelectorAll("td");
      const scheduleItems = row.querySelectorAll(".schedule li");
      let announcementDate = "";
      let winnerDate = "";
      scheduleItems.forEach((li) => {
        const label = li.querySelector(".label")?.textContent?.trim() ?? "";
        const value = li.querySelector(".value")?.textContent?.trim() ?? "";
        if (label.includes("모집공고")) announcementDate = value;
        if (label.includes("당첨발표")) winnerDate = value;
      });
      result.push({
        pblancId: idMatch[1],
        title: link.textContent?.trim() ?? "",
        status: statusEl?.textContent?.trim() ?? "",
        region: regionEl?.textContent?.trim() ?? "",
        institution: cells[2]?.textContent?.trim() ?? "",
        announcementDate,
        winnerDate,
      });
    });
    return result;
  });
}

async function fetchDetailInfo(context: BrowserContext, pblancId: string): Promise<DetailInfo> {
  const page = await context.newPage();
  try {
    await page.goto(`${DETAIL_BASE_URL}?pblancId=${pblancId}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    return await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const html = document.body.innerHTML;

      // fnDownFile('atchFileId', 'fileSn') 패턴에서 추출
      let atchFileId = "";
      let fileSn = "1";
      let pdfFileName = "";

      const downloadLinks = document.querySelectorAll("a");
      for (const link of downloadLinks) {
        const href = link.getAttribute("href") ?? "";
        const match = href.match(/fnDownFile\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
        if (match) {
          atchFileId = match[1];
          fileSn = match[2];
          pdfFileName = link.textContent?.trim() ?? "";
          break;
        }
      }

      // 주택유형
      const housingTypeMatch = bodyText.match(
        /(행복주택|국민임대|영구임대|매입임대|전세임대|공공임대|장기전세|역세권청년주택|신혼희망타운|기숙사형|청년주택)/
      );

      // 접수 기간
      const dateRangeMatch = bodyText.match(
        /접수[기간]*\s*[:：]?\s*(\d{4}[.\-]\d{2}[.\-]\d{2})\s*[~～\-]\s*(\d{4}[.\-]\d{2}[.\-]\d{2})/
      );

      return {
        atchFileId,
        fileSn,
        housingType: housingTypeMatch?.[1] ?? "",
        applicationStart: dateRangeMatch?.[1]?.replace(/\./g, "-") ?? "",
        applicationEnd: dateRangeMatch?.[2]?.replace(/\./g, "-") ?? "",
        pdfFileName,
      };
    });
  } finally {
    await page.close();
  }
}

async function downloadPdf(page: Page, atchFileId: string, fileSn: string): Promise<Buffer | null> {
  try {
    // 브라우저 컨텍스트 내에서 form submit 방식으로 PDF 다운로드
    const pdfBytes = await page.evaluate(
      async (params: { fileId: string; sn: string }) => {
        const url = "/hws/com/fms/cvplFileDownload.do";
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `atchFileId=${encodeURIComponent(params.fileId)}&fileSn=${params.sn}`,
        });
        const buf = await res.arrayBuffer();
        return Array.from(new Uint8Array(buf));
      },
      { fileId: atchFileId, sn: fileSn }
    );

    const buffer = Buffer.from(pdfBytes);
    if (buffer.length < 100) return null;
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") return null;
    return buffer;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log("[검증] 마이홈 크롤링 + PDF 추출 시작...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();

    // 1. 목록 페이지 + 검색
    console.log("[1/4] 마이홈 목록 로드...");
    await page.goto("https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcView.do", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.evaluate(() => { const w = window as unknown as { fnSearch?: () => void }; w.fnSearch?.(); });
    await page.waitForSelector("table.tb-list tbody tr a.li-title", { timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log("  완료\n");

    // 2. DOM에서 목록 추출
    console.log("[2/4] 공고 목록 추출...");
    const items = await extractListFromDom(page);
    console.log(`  ${items.length}건`);
    items.slice(0, 5).forEach((i) => console.log(`  [${i.pblancId}] ${i.title} (${i.status})`));

    // 3. 상세 + PDF
    console.log("\n[3/4] 상세 페이지 + PDF 추출...");
    const pdfSamples: Array<{
      externalId: string;
      title: string;
      housingType: string;
      atchFileId: string;
      pdfFileName: string;
      pdfTextLength: number;
      pdfTextPreview: string;
      pdfTextFull: string;
    }> = [];

    for (const item of items.slice(0, MAX_PDF_ITEMS)) {
      console.log(`\n  [${item.pblancId}] ${item.title}`);

      const detail = await fetchDetailInfo(context, item.pblancId);
      console.log(`    파일: ${detail.atchFileId} (${detail.pdfFileName || "이름 없음"})`);
      console.log(`    유형: ${detail.housingType || "미확인"}`);

      if (!detail.atchFileId) {
        console.log("    파일 ID 없음 → 건너뜀");
        continue;
      }

      const pdfBuffer = await downloadPdf(page, detail.atchFileId, detail.fileSn);
      if (!pdfBuffer) {
        console.log("    PDF 다운로드 실패");
        continue;
      }

      console.log(`    다운로드: ${pdfBuffer.length} bytes`);
      const pdfText = await extractPdfText(pdfBuffer);
      console.log(`    텍스트: ${pdfText.length}자`);
      console.log(`    미리보기: ${pdfText.slice(0, 150).replace(/\n/g, " ")}`);

      pdfSamples.push({
        externalId: item.pblancId,
        title: item.title,
        housingType: detail.housingType,
        atchFileId: detail.atchFileId,
        pdfFileName: detail.pdfFileName,
        pdfTextLength: pdfText.length,
        pdfTextPreview: pdfText.slice(0, 5000),
        pdfTextFull: pdfText,
      });

      await page.waitForTimeout(2000);
    }

    // 4. 저장
    console.log("\n[4/4] 결과 저장...");
    const output = {
      scrapedAt: new Date().toISOString(),
      totalListItems: items.length,
      summaries: items.slice(0, 15),
      pdfSamples,
    };

    const outPath = join(process.cwd(), "scripts", "verify-pdf-result.json");
    writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n[완료] ${outPath}`);
    console.log(`  공고 ${items.length}건, PDF ${pdfSamples.length}건`);

    await page.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[검증] 실행 실패:", err);
  process.exit(1);
});
