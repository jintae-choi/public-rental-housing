"use client";
import React from "react";

// income-assets-tab: Phase 3에서 시나리오로 이관됨 (monthlyIncome, totalAssets, carValue → ScenarioFormData)
// 이 파일은 하위 호환성을 위해 유지되나, profile-form.tsx에서 더 이상 참조하지 않음

export function IncomeAssetsTab(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
      소득·자산 정보는 시나리오에서 입력합니다.
    </div>
  );
}
