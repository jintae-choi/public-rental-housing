/**
 * 크롤러 공통 유틸리티: 브라우저 관리, PDF 추출, 딜레이, 안전 fetch, 공통 파싱
 */

import { chromium, Browser, Page } from "playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ScraperConfig } from "./types";
import { DEFAULT_SCRAPER_CONFIG } from "./types";

// 데스크탑 User-Agent (SH 봇 차단 우회)
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// 주택 유형 키워드 (공고 제목/HTML에서 매칭)
const HOUSING_TYPE_KEYWORDS = [
  "행복주택",
  "영구임대",
  "국민임대",
  "매입임대",
  "전세임대",
  "장기전세",
  "공공분양",
  "공공임대",
  "역세권청년주택",
  "신혼희망타운",
  "기숙사형",
];

export class BrowserManager {
  private browser: Browser | null = null;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
  }

  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error("브라우저가 실행되지 않았습니다. launch()를 먼저 호출하세요.");
    }
    const page = await this.browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": DESKTOP_USER_AGENT });
    return page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// PDF 최대 추출 페이지 수 — 자격조건은 앞부분에 있으므로 전체 추출 불필요
const MAX_PDF_PAGES = 30;

/**
 * PDF 버퍼에서 텍스트 추출 (최대 MAX_PDF_PAGES 페이지)
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const doc = await getDocument({ data: uint8Array }).promise;
  const pageTexts: string[] = [];
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(text);
  }

  return pageTexts.join("\n");
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 타임아웃 + 에러 처리가 포함된 fetch 래퍼
 */
export async function safeFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_SCRAPER_CONFIG.timeoutMs, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`요청 타임아웃 (${timeoutMs}ms) — ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 텍스트에서 주택 유형 키워드 매칭
 */
export function inferHousingType(text: string): string | undefined {
  for (const keyword of HOUSING_TYPE_KEYWORDS) {
    if (text.includes(keyword)) return keyword;
  }
  return undefined;
}

/**
 * 공고 상태 텍스트 → 정규화 코드
 */
export function parseStatus(statusText: string): "UPCOMING" | "OPEN" | "CLOSED" {
  const trimmed = statusText.trim();
  if (trimmed.includes("모집중") || trimmed.includes("접수중")) return "OPEN";
  if (trimmed.includes("마감") || trimmed.includes("완료")) return "CLOSED";
  return "UPCOMING";
}

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 정규화
 * "20260401" → "2026-04-01", "2026.04.01" → "2026-04-01"
 * 잘못된 값이면 undefined 반환
 */
export function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  // YYYY.MM.DD or YYYY-MM-DD
  const match = value.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return undefined;
}
