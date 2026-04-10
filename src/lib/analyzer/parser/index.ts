/**
 * 파서 디스패처 — housingType에 따라 적절한 파서를 반환
 */

import type { HousingParser, ParsedCondition, TextSection } from "../types";
import { YeonguParser } from "./yeongu";
import { HaengbokParser } from "./haengbok";
import { SinheuiParser } from "./sinheui";
import { GisuksaParser } from "./gisuksa";
import { MaeipParser } from "./maeip";
import { createEmptyCondition, extractAssetLimit, extractCarLimit, extractRegions } from "./common";

// 주택 유형별 파서 인스턴스 (싱글턴)
const PARSERS: Record<string, HousingParser> = {
  영구임대: new YeonguParser(),
  행복주택: new HaengbokParser(),
  신혼희망타운: new SinheuiParser(),
  기숙사형: new GisuksaParser(),
  매입임대: new MaeipParser(),
};

// 주택 유형 키워드 매핑 (inferHousingType 보완)
const TYPE_KEYWORDS: [string, string][] = [
  ["영구임대", "영구임대"],
  ["행복주택", "행복주택"],
  ["신혼희망타운", "신혼희망타운"],
  ["기숙사형", "기숙사형"],
  ["매입임대", "매입임대"],
  ["국민임대", "국민임대"],
  ["통합공공임대", "통합공공임대"],
  ["전세임대", "전세임대"],
];

/**
 * 제네릭 파서 — 특정 유형 파서가 없을 때 공통 패턴만 추출
 */
class GenericParser implements HousingParser {
  readonly housingType = "기타";

  parse(sections: TextSection[], fullText: string): ParsedCondition[] {
    try {
      const condition = createEmptyCondition();
      condition.assetLimit = extractAssetLimit(fullText);
      condition.carLimit = extractCarLimit(fullText);
      condition.regionRequirement = extractRegions(fullText);
      if (condition.regionRequirement.length === 0) {
        condition.regionRequirement = null;
      }
      return [condition];
    } catch (err) {
      console.error("[GenericParser] 파싱 실패:", err);
      return [createEmptyCondition()];
    }
  }
}

const genericParser = new GenericParser();

/**
 * housingType 문자열로 적절한 파서 반환
 * 정확한 매칭 실패 시 키워드 기반으로 추론
 */
export function getParser(housingType: string | null): HousingParser {
  if (housingType && PARSERS[housingType]) {
    return PARSERS[housingType];
  }

  // 키워드 기반 추론
  if (housingType) {
    for (const [keyword, type] of TYPE_KEYWORDS) {
      if (housingType.includes(keyword) && PARSERS[type]) {
        return PARSERS[type];
      }
    }
  }

  return genericParser;
}
