/**
 * 마이홈(myhome.go.kr) 크롤러 — Playwright 기반 (NetFunnel 우회)
 *
 * HTTP 직접 POST는 서버 측 NetFunnel 검증으로 HTTP 903 반환.
 * Playwright로 실제 브라우저를 열어 fnSearch() JS 함수를 호출해야 정상 작동.
 */

import type { Page } from "playwright";
import type {
  Scraper,
  RawAnnouncement,
  ScrapeResult,
  ScrapeError,
  ScraperConfig,
} from "./types";
import { DEFAULT_SCRAPER_CONFIG } from "./types";
import {
  BrowserManager,
  extractPdfText,
  delay,
  inferHousingType,
  parseStatus,
} from "./base";

const BASE_URL = "https://www.myhome.go.kr";
const LIST_URL = `${BASE_URL}/hws/portal/sch/selectRsdtRcritNtcView.do`;
const DETAIL_BASE_URL = `${BASE_URL}/hws/portal/sch/selectRsdtRcritNtcDetailView.do`;
const PDF_DOWNLOAD_PATH = "/hws/com/fms/cvplFileDownload.do";
const LIST_READY_SELECTOR = "table.tb-list tbody tr a.li-title";

// fnDownFile('fileId', 'fileSn') 패턴
const PDF_FILE_PATTERN = /fnDownFile\('([^']+)',\s*'([^']+)'\)/;

interface ListRowData {
  pblancId: string;
  title: string;
  statusText: string;
  region: string;
  announcementDate: string;
  winnerDate: string;
}

/**
 * "YYYY-MM-DD" 형식 검증
 */
function validateDate(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : undefined;
}

/**
 * 목록 페이지에서 공고 행 데이터 추출
 */
async function extractListRows(page: Page): Promise<ListRowData[]> {
  return page.evaluate(() => {
    const rows = Array.from(
      document.querySelectorAll("table.tb-list tbody tr")
    );

    return rows
      .map((row) => {
        const titleAnchor = row.querySelector("a.li-title");
        if (!titleAnchor) return null;

        const href = titleAnchor.getAttribute("href") ?? "";
        const idMatch = href.match(/fnSelectDetail\('(\d+)'\)/);
        if (!idMatch) return null;

        const scheduleLis = Array.from(row.querySelectorAll("ul.schedule li"));
        let announcementDate = "";
        let winnerDate = "";
        for (const li of scheduleLis) {
          const label = li.querySelector(".label")?.textContent?.trim() ?? "";
          const value = li.querySelector(".value")?.textContent?.trim() ?? "";
          if (label === "모집공고") announcementDate = value;
          if (label === "당첨발표") winnerDate = value;
        }

        return {
          pblancId: idMatch[1],
          title: titleAnchor.textContent?.trim() ?? "",
          statusText: row.querySelector("td.housing-state")?.textContent?.trim() ?? "",
          region: row.querySelector(".f-loc")?.textContent?.trim() ?? "",
          announcementDate,
          winnerDate,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  });
}

/**
 * 상세 페이지 HTML에서 atchFileId, fileSn 추출
 */
function extractPdfFileInfo(html: string): { atchFileId: string; fileSn: string } | null {
  const match = html.match(PDF_FILE_PATTERN);
  if (!match) return null;
  return { atchFileId: match[1], fileSn: match[2] };
}

/**
 * 브라우저 컨텍스트 내 fetch로 PDF 다운로드
 * 세션 쿠키가 자동 포함되어 NetFunnel 인증 통과
 */
async function downloadPdfInBrowser(
  page: Page,
  atchFileId: string,
  fileSn: string,
  timeoutMs: number
): Promise<Buffer | null> {
  const evaluatePromise = page.evaluate(
    async ({ downloadPath, fileId, sn }: { downloadPath: string; fileId: string; sn: string }) => {
      const body = new URLSearchParams({ atchFileId: fileId, fileSn: sn });
      const res = await fetch(downloadPath, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Uint8Array → Base64 (브라우저 환경이므로 Node Buffer 미사용)
      const chunks: string[] = [];
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
      }
      return btoa(chunks.join(""));
    },
    { downloadPath: PDF_DOWNLOAD_PATH, fileId: atchFileId, sn: fileSn }
  );

  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error(`PDF 다운로드 타임아웃 (${timeoutMs}ms)`)), timeoutMs)
  );

  try {
    const base64 = await Promise.race([evaluatePromise, timeoutPromise]);
    if (!base64) return null;
    return Buffer.from(base64, "base64");
  } catch (err) {
    console.error(`[MYHOME] PDF 다운로드 실패 (atchFileId=${atchFileId}):`, err);
    return null;
  }
}

function buildAnnouncement(row: ListRowData): RawAnnouncement {
  return {
    externalId: row.pblancId,
    source: "MYHOME",
    title: row.title,
    detailUrl: `${DETAIL_BASE_URL}?pblancId=${row.pblancId}`,
    status: parseStatus(row.statusText),
    housingType: inferHousingType(row.title),
    region: row.region || undefined,
    announcementDate: validateDate(row.announcementDate),
    winnerDate: validateDate(row.winnerDate),
  };
}

export class MyhomeScraper implements Scraper {
  readonly source = "MYHOME" as const;
  private readonly config: ScraperConfig;
  private readonly browserManager: BrowserManager;

  constructor(partialConfig: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_SCRAPER_CONFIG, ...partialConfig };
    this.browserManager = new BrowserManager();
  }

  async scrape(): Promise<ScrapeResult> {
    const startedAt = new Date();
    const errors: ScrapeError[] = [];
    const announcements: RawAnnouncement[] = [];

    try {
      await this.browserManager.launch();
      const rows = await this.scrapeAllPages(errors);

      // 상세 페이지용 페이지를 하나만 생성하여 재사용
      const detailPage = await this.browserManager.newPage();
      try {
        for (const row of rows) {
          const announcement = await this.processRow(row, detailPage, errors);
          announcements.push(announcement);
          await delay(this.config.requestDelayMs);
        }
      } finally {
        await detailPage.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[MYHOME] 크롤러 치명적 오류:", message);
      errors.push({ source: this.source, phase: "list", message });
    } finally {
      await this.browserManager.close();
    }

    return { source: this.source, announcements, errors, startedAt, finishedAt: new Date() };
  }

  async dispose(): Promise<void> {
    await this.browserManager.close();
  }

  /**
   * 목록 페이지 전체 페이지네이션 수집
   */
  private async scrapeAllPages(errors: ScrapeError[]): Promise<ListRowData[]> {
    const page = await this.browserManager.newPage();
    const allRows: ListRowData[] = [];

    try {
      await page.goto(LIST_URL, { waitUntil: "domcontentloaded", timeout: this.config.timeoutMs });
      await page.evaluate(() => (window as Window & { fnSearch?: () => void }).fnSearch?.());
      await page.waitForSelector(LIST_READY_SELECTOR, { timeout: this.config.timeoutMs });

      let currentPage = 1;
      const maxPages = this.config.maxPages > 0 ? this.config.maxPages : Infinity;

      while (currentPage <= maxPages) {
        const rows = await extractListRows(page);
        allRows.push(...rows);
        console.log(`[MYHOME] 목록 페이지 ${currentPage} — ${rows.length}건`);

        const hasNext = await page.$("a.btn-next:not(.disabled), a[title='다음']").catch(() => null);
        if (!hasNext) break;

        await hasNext.click();
        await page.waitForSelector(LIST_READY_SELECTOR, { timeout: this.config.timeoutMs });
        await delay(this.config.requestDelayMs);
        currentPage++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[MYHOME] 목록 수집 실패:", message);
      errors.push({ source: this.source, phase: "list", message });
    } finally {
      await page.close();
    }

    return allRows;
  }

  /**
   * 단일 공고 처리: 상세 페이지 접속 → rawHtml + PDF 추출
   * detailPage를 재사용하여 페이지 생성/삭제 오버헤드 제거
   */
  private async processRow(
    row: ListRowData,
    detailPage: Page,
    errors: ScrapeError[]
  ): Promise<RawAnnouncement> {
    let announcement = buildAnnouncement(row);

    try {
      announcement = await this.enrichWithDetail(announcement, detailPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MYHOME] 상세 수집 실패 (${row.pblancId}):`, message);
      errors.push({ source: this.source, phase: "detail", externalId: row.pblancId, message });
    }

    return announcement;
  }

  /**
   * 상세 페이지 접속 → rawHtml, PDF 보강 (페이지 재사용)
   */
  private async enrichWithDetail(
    announcement: RawAnnouncement,
    page: Page
  ): Promise<RawAnnouncement> {
    await page.goto(announcement.detailUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeoutMs,
    });

    const rawHtml = await page.content();
    announcement = { ...announcement, rawHtml };

    if (!this.config.extractPdf) return announcement;

    const fileInfo = extractPdfFileInfo(rawHtml);
    if (!fileInfo) {
      console.warn(`[MYHOME] PDF 링크 없음 (${announcement.externalId})`);
      return announcement;
    }

    const pdfBuffer = await downloadPdfInBrowser(
      page,
      fileInfo.atchFileId,
      fileInfo.fileSn,
      this.config.timeoutMs
    );

    if (!pdfBuffer) return announcement;

    const pdfText = await extractPdfText(pdfBuffer);
    return { ...announcement, pdfText };
  }
}
