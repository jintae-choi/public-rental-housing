/**
 * 파서 검증 스크립트 — verify-pdf-result.json의 5개 샘플로 추출 결과 확인
 * DB 연결 불필요, 순수 파서 로직만 테스트
 *
 * Usage: pnpm tsx scripts/verify-analysis.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { analyzeText } from "../src/lib/analyzer";
import type { ParsedCondition } from "../src/lib/analyzer/types";

// 검증 기대값 정의
interface ExpectedValues {
  title: string;
  housingType: string;
  minConditions: number;
  checks: {
    hasIncome: boolean;
    hasAsset: boolean;
    hasCar: boolean;
    hasRegion: boolean;
    targetGroups: string[];
  };
}

const EXPECTED: ExpectedValues[] = [
  {
    title: "영구임대",
    housingType: "영구임대",
    minConditions: 3,
    checks: {
      hasIncome: true,
      hasAsset: true,
      hasCar: true,
      hasRegion: true,
      targetGroups: ["일반"],
    },
  },
  {
    title: "신혼희망타운",
    housingType: "신혼희망타운",
    minConditions: 4,
    checks: {
      hasIncome: true,
      hasAsset: true,
      hasCar: true,
      hasRegion: true,
      targetGroups: ["신혼부부", "한부모가족"],
    },
  },
  {
    title: "행복주택",
    housingType: "행복주택",
    minConditions: 5,
    checks: {
      hasIncome: true,
      hasAsset: true,
      hasCar: true,
      hasRegion: true,
      targetGroups: ["대학생", "청년", "신혼부부"],
    },
  },
  {
    title: "기숙사형",
    housingType: "기숙사형",
    minConditions: 3,
    checks: {
      hasIncome: true,
      hasAsset: false,
      hasCar: false,
      hasRegion: false,
      targetGroups: ["수급자"],
    },
  },
  {
    title: "매입임대",
    housingType: "매입임대",
    minConditions: 3,
    checks: {
      hasIncome: true,
      hasAsset: true,
      hasCar: true,
      hasRegion: false,
      targetGroups: ["수급자"],
    },
  },
];

/**
 * 조건 배열에서 특정 필드 존재 여부 확인
 */
function hasField(
  conditions: ParsedCondition[],
  field: keyof ParsedCondition
): boolean {
  return conditions.some((c) => c[field] !== null && c[field] !== undefined);
}

/**
 * 조건 배열에서 추출된 대상 그룹 목록
 */
function getTargetGroups(conditions: ParsedCondition[]): string[] {
  return [...new Set(conditions.map((c) => c.targetGroup).filter(Boolean))] as string[];
}

/**
 * 단일 샘플 검증
 */
function verifySample(
  index: number,
  pdfText: string,
  expected: ExpectedValues
): { passed: number; failed: number; details: string[] } {
  const result = analyzeText(expected.housingType, pdfText);
  const conditions = result.conditions;
  const details: string[] = [];
  let passed = 0;
  let failed = 0;

  // 조건 수 확인
  if (conditions.length >= expected.minConditions) {
    passed++;
    details.push(`  ✓ 조건 수: ${conditions.length}건 (최소 ${expected.minConditions}건)`);
  } else {
    failed++;
    details.push(`  ✗ 조건 수: ${conditions.length}건 (최소 ${expected.minConditions}건 기대)`);
  }

  // 소득 확인
  const incomeCheck = expected.checks.hasIncome === hasField(conditions, "incomeLimit");
  if (incomeCheck) {
    passed++;
    details.push(`  ✓ 소득 기준: ${expected.checks.hasIncome ? "있음" : "없음"}`);
  } else {
    failed++;
    details.push(`  ✗ 소득 기준: 기대=${expected.checks.hasIncome}, 실제=${hasField(conditions, "incomeLimit")}`);
  }

  // 자산 확인
  const assetCheck = expected.checks.hasAsset === hasField(conditions, "assetLimit");
  if (assetCheck) {
    passed++;
    details.push(`  ✓ 자산 기준: ${expected.checks.hasAsset ? "있음" : "없음"}`);
  } else {
    failed++;
    details.push(`  ✗ 자산 기준: 기대=${expected.checks.hasAsset}, 실제=${hasField(conditions, "assetLimit")}`);
  }

  // 자동차 확인
  const carCheck = expected.checks.hasCar === hasField(conditions, "carLimit");
  if (carCheck) {
    passed++;
    details.push(`  ✓ 자동차 기준: ${expected.checks.hasCar ? "있음" : "없음"}`);
  } else {
    failed++;
    details.push(`  ✗ 자동차 기준: 기대=${expected.checks.hasCar}, 실제=${hasField(conditions, "carLimit")}`);
  }

  // 지역 확인
  const regionCheck = expected.checks.hasRegion === hasField(conditions, "regionRequirement");
  if (regionCheck) {
    passed++;
    details.push(`  ✓ 지역 요건: ${expected.checks.hasRegion ? "있음" : "없음"}`);
  } else {
    failed++;
    details.push(`  ✗ 지역 요건: 기대=${expected.checks.hasRegion}, 실제=${hasField(conditions, "regionRequirement")}`);
  }

  // 대상 그룹 확인
  const actualGroups = getTargetGroups(conditions);
  const expectedGroups = expected.checks.targetGroups;
  const groupsFound = expectedGroups.every((g) =>
    actualGroups.some((a) => a.includes(g))
  );
  if (groupsFound) {
    passed++;
    details.push(`  ✓ 대상 그룹: ${actualGroups.join(", ")}`);
  } else {
    failed++;
    details.push(`  ✗ 대상 그룹: 기대=[${expectedGroups.join(",")}], 실제=[${actualGroups.join(",")}]`);
  }

  return { passed, failed, details };
}

/**
 * 메인 실행
 */
function main(): void {
  console.log("자격 분석 파서 검증 시작\n");

  // JSON 파일 로드
  const jsonPath = join(__dirname, "verify-pdf-result.json");
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const samples = data.pdfSamples as Array<{
    title: string;
    housingType: string;
    pdfTextFull?: string;
    pdfTextPreview?: string;
  }>;

  let totalPassed = 0;
  let totalFailed = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const pdfText = sample.pdfTextFull ?? sample.pdfTextPreview ?? "";
    const expected = EXPECTED[i];

    if (!expected) {
      console.log(`[${i}] ${sample.title}: 기대값 미정의 — SKIP`);
      continue;
    }

    console.log(`[${i}] ${sample.title} (${sample.housingType})`);

    if (!pdfText) {
      console.log("  ✗ PDF 텍스트 없음\n");
      totalFailed++;
      continue;
    }

    const { passed, failed, details } = verifySample(i, pdfText, expected);
    totalPassed += passed;
    totalFailed += failed;

    for (const d of details) {
      console.log(d);
    }

    // 추출된 조건 상세 출력
    const result = analyzeText(expected.housingType, pdfText);
    console.log(`  --- 추출 조건 상세 (${result.conditions.length}건) ---`);
    for (const c of result.conditions) {
      const income = c.incomeLimit ? JSON.stringify(c.incomeLimit) : "N/A";
      console.log(
        `    [${c.targetGroup ?? "?"}] rank=${c.priorityRank ?? "?"} income=${income} asset=${c.assetLimit ?? "N/A"} car=${c.carLimit ?? "N/A"} region=${c.regionRequirement?.join(",") ?? "N/A"}`
      );
    }
    console.log();
  }

  // 요약
  const total = totalPassed + totalFailed;
  const rate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : "0";
  console.log("========== 검증 요약 ==========");
  console.log(`통과: ${totalPassed}/${total} (${rate}%)`);
  console.log(`실패: ${totalFailed}/${total}`);
  console.log("================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();
