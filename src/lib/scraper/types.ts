/**
 * 크롤러 공통 인터페이스 및 타입 정의
 */

// 크롤링 소스
export type ScraperSource = "SH" | "LH" | "MYHOME";

// 크롤러가 수집한 원시 공고 데이터
// 필수: externalId, source, title, detailUrl (이것 없이는 저장 의미 없음)
// 나머지: 사이트마다 제공 데이터가 다르므로 전부 optional
export interface RawAnnouncement {
  // 필수
  externalId: string;
  source: ScraperSource;
  title: string;
  detailUrl: string;

  // 기본 정보 (optional)
  status?: "UPCOMING" | "OPEN" | "CLOSED";
  housingType?: string;
  region?: string;
  district?: string;
  supplyCount?: number;
  areaSqm?: number[];
  deposit?: string;
  monthlyRent?: string;

  // 일정 (optional)
  applicationStart?: string; // YYYY-MM-DD
  applicationEnd?: string;
  announcementDate?: string;
  winnerDate?: string;
  contractStart?: string;
  contractEnd?: string;

  // 원본 보존 (보험: 구조화 실패해도 Phase 2에서 복구 가능)
  pdfUrl?: string;
  pdfText?: string;
  rawHtml?: string;

  // 수정공고 여부
  isModified?: boolean;
}

// 크롤러 실행 결과
export interface ScrapeResult {
  source: ScraperSource;
  announcements: RawAnnouncement[];
  errors: ScrapeError[];
  startedAt: Date;
  finishedAt: Date;
}

// 크롤링 에러
export interface ScrapeError {
  source: ScraperSource;
  phase: "list" | "detail" | "pdf";
  externalId?: string;
  message: string;
  stack?: string;
}

// 크롤러 공통 인터페이스
export interface Scraper {
  readonly source: ScraperSource;
  scrape(): Promise<ScrapeResult>;
  dispose(): Promise<void>;
}

// 크롤러 설정
export interface ScraperConfig {
  // 요청 간 딜레이 (ms) — GitHub Actions IP 차단 방지
  requestDelayMs: number;
  // 최대 페이지 수 (0 = 무제한)
  maxPages: number;
  // 타임아웃 (ms)
  timeoutMs: number;
  // PDF 텍스트 추출 여부
  extractPdf: boolean;
}

export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  requestDelayMs: 2000,
  maxPages: 0,
  timeoutMs: 30000,
  extractPdf: true,
};
