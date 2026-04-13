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
   *
   * 2026-04-13 사이트 구조 변경 대응:
   *   - 기존: `a[href*="view.do?seq="]` 직접 링크 → 더 이상 존재하지 않음
   *   - 현재: `td.txtL a[onclick="javascript:getDetailView('302870');..."]` 패턴
   *   - 컬럼: 번호 / 제목 / 담당부서 / 작성일 / 조회수 (상태 컬럼 없음 — OPEN 기본 가정)
   */
  private async fetchListPage(pageNum: number): Promise<ShListItem[]> {
    const url = `${SH_LIST_BASE_URL}&page=${pageNum}`;
    const page = await this.browserManager.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.timeoutMs });
      await page
        .waitForSelector("#listTb table tbody tr", {
          timeout: this.config.timeoutMs,
          state: "attached",
        })
        .catch(() => {
          // 마지막 페이지 너머이거나 빈 결과
        });

      const items = await page.$$eval(
        "#listTb table tbody tr",
        (rows) => {
          const SEQ_PATTERN = /getDetailView\('(\d+)'\)/;
          return rows
            .map((row) => {
              const titleAnchor = row.querySelector<HTMLAnchorElement>(
                "td.txtL a[onclick*=getDetailView]"
              );
              if (!titleAnchor) return null;
              const onclick = titleAnchor.getAttribute("onclick") ?? "";
              const seqMatch = onclick.match(SEQ_PATTERN);
              if (!seqMatch) return null;
              const seq = seqMatch[1];

              // 제목 텍스트만 추출 (NEW 뱃지 등 자식 span 제외)
              // textContent를 그대로 쓰면 NEW 등도 포함되니 trim 후 NEW prefix 제거
              const rawTitle = titleAnchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
              const title = rawTitle.replace(/^NEW\s*/, "").trim();

              const cells = Array.from(row.querySelectorAll("td"));
              // 등록일은 보통 4번째 td (번호/제목/부서/등록일/조회수)
              const dateCell = cells.find((td) =>
                /\d{4}[.\-]\d{2}[.\-]\d{2}/.test(td.textContent ?? "")
              );
              const date = dateCell?.textContent?.trim() ?? "";

              return { seq, title, date, statusText: "" };
            })
            .filter((x): x is { seq: string; title: string; date: string; statusText: string } =>
              x !== null
            );
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
   *
   * SH 상세는 GET 직접 접근 가능 (NetFunnel 미적용) — 추가 셀렉터 대기 없이 domcontentloaded만으로 충분
   */
  private async fetchDetail(
    page: Page,
    seq: string
  ): Promise<{ rawHtml: string; extraData: ShExtraData }> {
    const url = `${SH_DETAIL_BASE_URL}?seq=${seq}&multi_itm_seq=2&page=1`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.timeoutMs });

    const rawHtml = await page.content();
    // 제목 기반 housingType 추론을 위해 호출자가 ShListItem.title을 알고 있어야 하지만
    // fetchDetail은 seq만 받으므로 일단 빈 문자열을 넘겨 housingType은 parseToAnnouncement 시점에 보강
    const extraData = this.extractExtraData(rawHtml, "");

    return { rawHtml, extraData };
  }

  /**
   * rawHtml + 제목에서 추가 구조화 데이터 추출
   *
   * housingType은 rawHtml로 inferHousingType 하면 SH 사이트 네비게이션 메뉴의
   * "행복주택" 등이 항상 매칭되어 잘못된 결과가 나옴 → 제목으로만 추론
   */
  private extractExtraData(rawHtml: string, title: string): ShExtraData {
    try {
      const dateRangeRegex = /(\d{4}[.\-]\d{2}[.\-]\d{2})\s*[~～\-]\s*(\d{4}[.\-]\d{2}[.\-]\d{2})/;
      const dateRangeMatch = rawHtml.match(dateRangeRegex);

      return {
        applicationStart: dateRangeMatch ? normalizeDate(dateRangeMatch[1]) : undefined,
        applicationEnd: dateRangeMatch ? normalizeDate(dateRangeMatch[2]) : undefined,
        housingType: inferHousingType(title),
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

    // SH 목록에는 상태 컬럼이 없음 → 제목에서 마감/완료 키워드를 우선 검사하고
    // 없으면 OPEN 가정 (모집 게시판은 활성 공고만 노출)
    const statusFromTitle = parseStatus(item.title);
    const status = statusFromTitle === "UPCOMING" ? "OPEN" : statusFromTitle;

    // housingType은 제목으로 재추론 (extraData에선 빈 문자열을 넘겼으므로 undefined일 수 있음)
    const housingType = extraData.housingType ?? inferHousingType(item.title);

    return {
      externalId: `SH-${item.seq}`,
      source: "SH",
      title: item.title,
      detailUrl: `${SH_DETAIL_BASE_URL}?seq=${item.seq}&multi_itm_seq=2&page=1`,
      status,
      housingType,
      region: SH_DEFAULT_REGION,
      applicationStart: extraData.applicationStart,
      applicationEnd: extraData.applicationEnd,
      announcementDate: normalizeDate(item.date),
      rawHtml,
    };
  }
}
