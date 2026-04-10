/**
 * 공고문 텍스트 전처리 — 정규화 및 섹션 분할
 * PDF 추출 텍스트의 불규칙한 공백·특수문자를 정리하고,
 * 자격 조건 관련 섹션을 구조화하여 파서에 전달
 */

import type { TextSection } from "./types";

// 섹션 앵커 패턴 — 자격 조건 블록의 시작점
const SECTION_ANCHOR_PRIMARY = /(\d+)\.\s*신청\s*자격/;
const SECTION_ANCHOR_FALLBACK = /입주\s*순위|소득\s*[·∙ㆍ]\s*자산\s*기준/;

// 다음 번호 섹션 시작 패턴 (현재 섹션의 끝을 결정)
const NEXT_SECTION_RE = /\n\s*\d+\.\s*[가-힣]/;

// 서브헤더 패턴: "■ 소득기준", "■ 입주순위" 등
const SUB_HEADER_RE = /■\s*([^\n]+)/g;

// 자격 섹션 최대 캡처 길이 (계약 조건 등 불필요한 부분 방지)
const MAX_SECTION_LENGTH = 20000;

/**
 * PDF 추출 텍스트를 정규화
 * - 다중 공백 → 단일 공백
 * - 페이지 마커 제거 (- 1 -, - 2 - 등)
 * - 불릿 문자 통일 (▪, •, ◾, ○ → •)
 * - 한국어 중점 통일 (·, ∙, ㆍ → ·)
 */
export function normalizeText(raw: string): string {
  try {
    let text = raw;

    // 페이지 마커 제거: "- 1 -", "- 12 -" 등
    text = text.replace(/-\s*\d+\s*-/g, "");

    // 다중 공백/탭 → 단일 공백 (개행은 유지)
    text = text.replace(/[^\S\n]+/g, " ");

    // 불릿 문자 통일
    text = text.replace(/[▪◾○●►▶◇◆□■]/g, "•");

    // 한국어 중점 통일
    text = text.replace(/[∙ㆍ]/g, "·");

    // 연속 개행 정리 (3개 이상 → 2개)
    text = text.replace(/\n{3,}/g, "\n\n");

    // 앞뒤 공백 제거
    text = text.trim();

    return text;
  } catch (err) {
    console.error("[normalizeText] 텍스트 정규화 실패:", err);
    return raw;
  }
}

/**
 * 자격 조건 블록의 시작·끝 인덱스를 찾아 반환
 * 1차: "N. 신청자격" 패턴 (영구임대/행복주택/신혼희망타운)
 * fallback: "입주순위" or "소득·자산 기준" (기숙사형/매입임대)
 */
function findEligibilityBlock(text: string): { start: number; end: number } | null {
  try {
    // 1차: 번호 붙은 "신청자격" 섹션 찾기
    const primaryMatch = SECTION_ANCHOR_PRIMARY.exec(text);
    let start: number;

    if (primaryMatch) {
      start = primaryMatch.index;
    } else {
      // fallback: 입주순위 또는 소득·자산 기준
      const fallbackMatch = SECTION_ANCHOR_FALLBACK.exec(text);
      if (!fallbackMatch) return null;
      start = fallbackMatch.index;
    }

    // 끝: 다음 번호 섹션이나 최대 길이 중 먼저 오는 것
    const afterStart = text.substring(start + 1);
    const nextMatch = NEXT_SECTION_RE.exec(afterStart);

    let end: number;
    if (nextMatch) {
      // 다음 섹션 번호가 현재 섹션 번호보다 큰 경우만 경계로 인정
      end = Math.min(start + 1 + nextMatch.index, start + MAX_SECTION_LENGTH);
    } else {
      end = Math.min(text.length, start + MAX_SECTION_LENGTH);
    }

    return { start, end };
  } catch (err) {
    console.error("[findEligibilityBlock] 자격 블록 탐색 실패:", err);
    return null;
  }
}

/**
 * 정규화된 텍스트를 섹션으로 분할
 * - 전체(full) 자격 블록 + ■ 서브헤더별 세부 섹션
 * - 자격 블록을 찾지 못하면 전체 텍스트를 "unknown" 섹션으로 반환
 */
export function splitSections(text: string): TextSection[] {
  const sections: TextSection[] = [];

  try {
    const block = findEligibilityBlock(text);

    if (!block) {
      // 자격 블록 미발견 — 전체 텍스트를 단일 섹션으로
      sections.push({
        title: "전체",
        content: text,
        startIndex: 0,
      });
      return sections;
    }

    const eligibilityText = text.substring(block.start, block.end);

    // 전체 자격 블록을 첫 번째 섹션으로 추가
    sections.push({
      title: "신청자격",
      content: eligibilityText,
      startIndex: block.start,
    });

    // ■ 서브헤더로 세부 분할
    const subHeaderRe = new RegExp(SUB_HEADER_RE.source, "g");
    const subHeaders: Array<{ title: string; index: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = subHeaderRe.exec(eligibilityText)) !== null) {
      subHeaders.push({
        title: match[1].trim(),
        index: match.index,
      });
    }

    // 각 서브헤더 간 텍스트를 섹션으로 분할
    for (let i = 0; i < subHeaders.length; i++) {
      const start = subHeaders[i].index;
      const end = i + 1 < subHeaders.length
        ? subHeaders[i + 1].index
        : eligibilityText.length;

      sections.push({
        title: subHeaders[i].title,
        content: eligibilityText.substring(start, end).trim(),
        startIndex: block.start + start,
      });
    }

    return sections;
  } catch (err) {
    console.error("[splitSections] 섹션 분할 실패:", err);
    // 실패 시 전체 텍스트 반환
    return [{ title: "전체", content: text, startIndex: 0 }];
  }
}
