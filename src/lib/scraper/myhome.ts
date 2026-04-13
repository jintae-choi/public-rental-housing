/**
 * 마이홈(myhome.go.kr) 크롤러 — Playwright 기반 (NetFunnel + JSON API)
 *
 * 2026-04-13 사이트 재설계 대응:
 *   - 목록 테이블이 #schTbody에 클라이언트사이드 jQuery로 렌더링됨 (HTML 파싱 불가)
 *   - fnSearch()는 NetFunnel_Action 콜백 안에서 selectRsdtRcritNtcList.do로 POST 후
 *     {resultCnt, resultList} JSON을 받아 jQuery로 tbody에 주입
 *   - **빈 검색은 시스템 오류 페이지 반환** → srchPrgrStts=1(모집중) 강제 설정 필수
 *   - 페이지당 5건 (recordCountPerPage), 페이지네이션은 fnSearch('N') 호출
 *
 * 처리 흐름:
 *   1) 목록 페이지 GET (세션 + NetFunnel JS 로드)
 *   2) srchPrgrStts=1 라디오 설정 → 빈 검색 회피 + 모집중인 공고만 수집
 *   3) 페이지마다 fnSearch(N) 호출 + waitForResponse로 JSON 캡처
 *   4) JSON.resultList → RawAnnouncement[] 변환
 *   5) 각 공고마다 상세 페이지 접속 → rawHtml + PDF 추출 (기존 흐름)
 */

import type { Page, Response } from "playwright";
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
  normalizeDate,
} from "./base";

const BASE_URL = "https://www.myhome.go.kr";
const LIST_URL = `${BASE_URL}/hws/portal/sch/selectRsdtRcritNtcView.do`;
const LIST_API_PATH = "/hws/portal/sch/selectRsdtRcritNtcList.do";
const DETAIL_BASE_URL = `${BASE_URL}/hws/portal/sch/selectRsdtRcritNtcDetailView.do`;
const PDF_DOWNLOAD_PATH = "/hws/com/fms/cvplFileDownload.do";

// 상세 페이지 PDF 링크 패턴: fnDownFile('atchFileId', 'fileSn')
const PDF_FILE_PATTERN = /fnDownFile\('([^']+)',\s*'([^']+)'\)/;

// 기본 페이지당 레코드 수 — 서버가 강제하는 5건 기준
const DEFAULT_PAGE_SIZE = 5;
// 안전망: 한 번에 너무 많은 페이지를 돌지 않도록 절대 상한 (≈ 250건)
const ABSOLUTE_MAX_PAGES = 50;

interface MyhomeListItem {
  pblancId?: string;
  pblancNm?: string;
  prgrStts?: string;
  brtcCodeNm?: string;
  rcritPblancDe?: string;
  przwnerPresnatnDe?: string;
  houseTyNm?: string;
  suplyTyNm?: string;
  suplyInsttNm?: string;
  url?: string;
  atchFileId?: string;
  sttusSe?: string; // "2" = 정정공고
}

interface MyhomeListResponse {
  resultCnt?: number;
  resultList?: MyhomeListItem[];
}

/**
 * fnSearch 호출 → 응답 JSON 캡처
 * NetFunnel acquire → POST → release 흐름 전체를 Playwright가 자동 처리
 */
async function callFnSearchAndCaptureJson(
  page: Page,
  pageNo: number,
  timeoutMs: number
): Promise<MyhomeListResponse> {
  // waitForResponse는 트리거 *전에* 등록해야 race condition 없음
  const responsePromise = page.waitForResponse(
    (res: Response) =>
      res.url().includes(LIST_API_PATH) && res.request().method() === "POST",
    { timeout: timeoutMs }
  );

  await page.evaluate((p) => {
    const win = window as Window & { fnSearch?: (page: string) => void };
    if (typeof win.fnSearch !== "function") {
      throw new Error("fnSearch 함수가 페이지에 정의되지 않음");
    }
    win.fnSearch(String(p));
  }, pageNo);

  const response = await responsePromise;
  const contentType = (response.headers()["content-type"] ?? "").toLowerCase();

  if (!contentType.includes("json")) {
    // 시스템 오류 페이지(HTML)가 반환된 경우
    const bodyText = await response.text();
    const snippet = bodyText.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `목록 응답이 JSON이 아님 (content-type=${contentType}): ${snippet}`
    );
  }

  return (await response.json()) as MyhomeListResponse;
}

/**
 * JSON 항목 → RawAnnouncement 변환
 */
function buildAnnouncementFromJson(item: MyhomeListItem): RawAnnouncement | null {
  if (!item.pblancId || !item.pblancNm) return null;

  const title = item.pblancNm.trim();
  // 주택 유형: API의 houseTyNm/suplyTyNm 우선, 부족하면 제목 키워드로 추론
  const housingType =
    item.suplyTyNm ?? item.houseTyNm ?? inferHousingType(title);

  return {
    externalId: item.pblancId,
    source: "MYHOME",
    title,
    detailUrl: `${DETAIL_BASE_URL}?pblancId=${item.pblancId}`,
    status: parseStatus(item.prgrStts ?? ""),
    housingType,
    region: item.brtcCodeNm?.trim() || undefined,
    announcementDate: normalizeDate(item.rcritPblancDe),
    winnerDate: normalizeDate(item.przwnerPresnatnDe),
    isModified: item.sttusSe === "2",
  };
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
 * 브라우저 컨텍스트 내 fetch로 PDF 다운로드 — 세션 쿠키 자동 포함
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
      // 큰 버퍼를 String.fromCharCode(...) 한 번에 넘기면 stack overflow → 청크
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
      const items = await this.scrapeAllPages(errors);

      // 상세 페이지용 페이지를 하나 생성하여 재사용 (PDF 다운로드까지 같은 컨텍스트)
      const detailPage = await this.browserManager.newPage();
      try {
        for (const item of items) {
          const announcement = await this.processItem(item, detailPage, errors);
          if (announcement) {
            announcements.push(announcement);
          }
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
   * 모든 페이지를 fnSearch로 순회하며 JSON 데이터 누적
   */
  private async scrapeAllPages(errors: ScrapeError[]): Promise<MyhomeListItem[]> {
    const page = await this.browserManager.newPage();
    const allItems: MyhomeListItem[] = [];

    try {
      await page.goto(LIST_URL, {
        waitUntil: "domcontentloaded",
        timeout: this.config.timeoutMs,
      });

      // fnSearch 함수와 폼이 준비될 때까지 대기
      await page.waitForFunction(
        () => {
          const win = window as Window & { fnSearch?: unknown };
          return typeof win.fnSearch === "function" && !!document.getElementById("frm");
        },
        { timeout: this.config.timeoutMs }
      );

      // ⚠️ 빈 검색은 서버 측에서 시스템 오류 페이지를 반환한다 (HTML, JSON 아님).
      // srchPrgrStts=1(모집중) 라디오를 강제 선택해 회피 — 어차피 모집중인 공고만 필요.
      await page.evaluate(() => {
        const radio = document.querySelector<HTMLInputElement>(
          'input[name="srchPrgrStts"][value="1"]'
        );
        if (radio) radio.checked = true;
      });

      // 첫 페이지 호출
      let currentPage = 1;
      const firstResponse = await callFnSearchAndCaptureJson(
        page,
        currentPage,
        this.config.timeoutMs
      );
      const firstList = firstResponse.resultList ?? [];
      allItems.push(...firstList);

      const totalCount = firstResponse.resultCnt ?? firstList.length;
      const pageSize = firstList.length || DEFAULT_PAGE_SIZE;
      const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;
      const userMaxPages =
        this.config.maxPages > 0 ? this.config.maxPages : ABSOLUTE_MAX_PAGES;
      const effectiveMaxPages = Math.min(totalPages, userMaxPages, ABSOLUTE_MAX_PAGES);

      console.log(
        `[MYHOME] 목록 페이지 ${currentPage}/${effectiveMaxPages} — ${firstList.length}건 (전체 ${totalCount}건 예상)`
      );

      // 2페이지 이상부터 순회
      while (currentPage < effectiveMaxPages) {
        currentPage++;
        await delay(this.config.requestDelayMs);

        try {
          const response = await callFnSearchAndCaptureJson(
            page,
            currentPage,
            this.config.timeoutMs
          );
          const list = response.resultList ?? [];
          if (list.length === 0) {
            console.log(`[MYHOME] 페이지 ${currentPage} 빈 응답 — 종료`);
            break;
          }
          allItems.push(...list);
          console.log(
            `[MYHOME] 목록 페이지 ${currentPage}/${effectiveMaxPages} — ${list.length}건`
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[MYHOME] 페이지 ${currentPage} 수집 실패:`, message);
          errors.push({ source: this.source, phase: "list", message });
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[MYHOME] 목록 수집 실패:", message);
      errors.push({ source: this.source, phase: "list", message });
    } finally {
      await page.close();
    }

    return allItems;
  }

  /**
   * 단일 JSON 항목 처리: RawAnnouncement 변환 + 상세 페이지 보강
   */
  private async processItem(
    item: MyhomeListItem,
    detailPage: Page,
    errors: ScrapeError[]
  ): Promise<RawAnnouncement | null> {
    let announcement = buildAnnouncementFromJson(item);
    if (!announcement) {
      console.warn("[MYHOME] 빈 항목 스킵:", JSON.stringify(item).slice(0, 100));
      return null;
    }

    try {
      announcement = await this.enrichWithDetail(announcement, detailPage, item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MYHOME] 상세 수집 실패 (${item.pblancId}):`, message);
      errors.push({
        source: this.source,
        phase: "detail",
        externalId: item.pblancId,
        message,
      });
    }

    return announcement;
  }

  /**
   * 상세 페이지 접속 → rawHtml + PDF 추출
   * JSON에 atchFileId가 있으면 우선 사용, 없으면 상세 HTML에서 fileSn까지 함께 파싱
   */
  private async enrichWithDetail(
    announcement: RawAnnouncement,
    page: Page,
    item: MyhomeListItem
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
      console.warn(`[MYHOME] PDF 링크 없음 (${item.pblancId})`);
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
