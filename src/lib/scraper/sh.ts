/**
 * SH(서울주택도시공사) 크롤러
 * 마이홈에서 2022-06 이후 공고를 올리지 않아 별도 크롤링 필요
 * PDF는 Innorix ActiveX로 직접 다운 불가 — rawHtml 저장으로 대체
 */

import type { Page } from "playwright";
import type { Scraper, RawAnnouncement, ScrapeResult, ScrapeError, ScraperConfig } from "./types";
import { DEFAULT_SCRAPER_CONFIG } from "./types";
import { BrowserManager, delay, inferHousingType, parseStatus, normalizeDate } from "./base";

const SH_LIST_BASE_URL =
  "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247/list.do?multi_itm_seq=2";
const SH_DETAIL_BASE_URL =
  "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247/view.do";
const SH_DEFAULT_REGION = "서울특별시";

interface ShListItem {
  seq: string;
  title: string;
  date: string;
  statusText: string;
}

interface ShExtraData {
  housingType?: string;
  applicationStart?: string;
  applicationEnd?: string;
}

export class ShScraper implements Scraper {
  readonly source = "SH" as const;
  private readonly config: ScraperConfig;
  private readonly browserManager: BrowserManager;

  constructor(configOverrides: Partial<ScraperConfig> = {}) {
    this.config = {
      ...DEFAULT_SCRAPER_CONFIG,
      ...configOverrides,
      extractPdf: false, // SH는 PDF 다운로드 불가
    };
    this.browserManager = new BrowserManager();
  }

  async scrape(): Promise<ScrapeResult> {
    const startedAt = new Date();
    const announcements: RawAnnouncement[] = [];
    const errors: ScrapeError[] = [];

    try {
      await this.browserManager.launch();
      const listItems = await this.fetchAllList(errors);

      // 상세 페이지용 페이지를 하나만 생성하여 재사용
      const detailPage = await this.browserManager.newPage();
      try {
        for (const item of listItems) {
          try {
            await delay(this.config.requestDelayMs);
            const detail = await this.fetchDetail(detailPage, item.seq);
            const announcement = this.parseToAnnouncement(item, detail);
            announcements.push(announcement);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`[SH] 상세 페이지 오류 seq=${item.seq}:`, error.message);
            errors.push({
              source: "SH",
              phase: "detail",
              externalId: `SH-${item.seq}`,
              message: error.message,
            });
          }
        }
      } finally {
        await detailPage.close();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[SH] 크롤러 실행 오류:", error.message);
      errors.push({ source: "SH", phase: "list", message: error.message });
    } finally {
      await this.browserManager.close();
    }

    return { source: "SH", announcements, errors, startedAt, finishedAt: new Date() };
  }

  async dispose(): Promise<void> {
    await this.browserManager.close();
  }

  /**
   * 목록 페이지 한 화면에서 공고 항목 파싱
   * 목록 페이지는 매번 새 페이지로 열어야 함 (페이지네이션이 URL 기반)
   */
  private async fetchListPage(pageNum: number): Promise<ShListItem[]> {
    const url = `${SH_LIST_BASE_URL}&page=${pageNum}`;
    const page = await this.browserManager.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.timeoutMs });
      await page.waitForSelector('a[href*="view.do?seq="]', {
        timeout: this.config.timeoutMs,
        state: "attached",
      }).catch(() => {
        // 마지막 페이지이거나 항목 없음
      });

      const items = await page.$$eval(
        'a[href*="view.do?seq="]',
        (anchors) => {
          return anchors.map((anchor) => {
            const href = anchor.getAttribute("href") ?? "";
            const seqMatch = href.match(/[?&]seq=(\d+)/);
            const seq = seqMatch ? seqMatch[1] : "";
            const title = anchor.textContent?.trim() ?? "";

            const row = anchor.closest("tr");
            const cells = row ? Array.from(row.querySelectorAll("td")) : [];

            const dateCell = cells.find((td) =>
              /\d{4}[.\-]\d{2}[.\-]\d{2}/.test(td.textContent ?? "")
            );
            const date = dateCell?.textContent?.trim() ?? "";

            const statusCell = cells.find((td) => {
              const text = td.textContent?.trim() ?? "";
              return (
                text.includes("모집중") ||
                text.includes("접수중") ||
                text.includes("마감") ||
                text.includes("예정") ||
                text.includes("완료")
              );
            });
            const statusText = statusCell?.textContent?.trim() ?? "";

            return { seq, title, date, statusText };
          });
        }
      );

      return items.filter((item) => item.seq.length > 0 && item.title.length > 0);
    } finally {
      await page.close();
    }
  }

  /**
   * 전체 목록 수집: 항목이 없거나 maxPages 도달 시 중단
   */
  private async fetchAllList(errors: ScrapeError[]): Promise<ShListItem[]> {
    const allItems: ShListItem[] = [];
    const maxPages = this.config.maxPages > 0 ? this.config.maxPages : Infinity;
    let pageNum = 1;

    while (pageNum <= maxPages) {
      try {
        const items = await this.fetchListPage(pageNum);
        if (items.length === 0) break;
        allItems.push(...items);
        console.log(`[SH] 목록 페이지 ${pageNum} — ${items.length}건`);
        pageNum++;
        await delay(this.config.requestDelayMs);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[SH] 목록 페이지 ${pageNum} 오류:`, error.message);
        errors.push({
          source: "SH",
          phase: "list",
          message: `페이지 ${pageNum} 수집 실패: ${error.message}`,
        });
        break;
      }
    }

    return allItems;
  }

  /**
   * 상세 페이지 HTML 및 추가 메타데이터 수집 (페이지 재사용)
   */
  private async fetchDetail(
    page: Page,
    seq: string
  ): Promise<{ rawHtml: string; extraData: ShExtraData }> {
    const url = `${SH_DETAIL_BASE_URL}?seq=${seq}&multi_itm_seq=2&page=1`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.timeoutMs });
    await page.waitForSelector(".board_view, .brd_view, .view_content, table", {
      timeout: this.config.timeoutMs,
      state: "attached",
    }).catch(() => {});

    const rawHtml = await page.content();
    const extraData = this.extractExtraData(rawHtml);

    return { rawHtml, extraData };
  }

  /**
   * rawHtml에서 추가 구조화 데이터 추출 (evaluate 불필요 — 문자열 파싱)
   */
  private extractExtraData(rawHtml: string): ShExtraData {
    try {
      const dateRangeRegex = /(\d{4}[.\-]\d{2}[.\-]\d{2})\s*[~～\-]\s*(\d{4}[.\-]\d{2}[.\-]\d{2})/;
      const dateRangeMatch = rawHtml.match(dateRangeRegex);

      return {
        applicationStart: dateRangeMatch ? normalizeDate(dateRangeMatch[1]) : undefined,
        applicationEnd: dateRangeMatch ? normalizeDate(dateRangeMatch[2]) : undefined,
        housingType: inferHousingType(rawHtml),
      };
    } catch (err) {
      console.error("[SH] 추가 데이터 추출 실패:", err instanceof Error ? err.message : err);
      return {};
    }
  }

  private parseToAnnouncement(
    item: ShListItem,
    detail: { rawHtml: string; extraData: ShExtraData }
  ): RawAnnouncement {
    const { extraData, rawHtml } = detail;

    return {
      externalId: `SH-${item.seq}`,
      source: "SH",
      title: item.title,
      detailUrl: `${SH_DETAIL_BASE_URL}?seq=${item.seq}&multi_itm_seq=2&page=1`,
      status: parseStatus(item.statusText),
      housingType: extraData.housingType,
      region: SH_DEFAULT_REGION,
      applicationStart: extraData.applicationStart,
      applicationEnd: extraData.applicationEnd,
      announcementDate: normalizeDate(item.date),
      rawHtml,
    };
  }
}
