"use client";
import React from "react";

// 소득/자산 탭: 월소득, 총자산, 차량가액

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProfileFormData } from "@/types/profile";

interface IncomeAssetsTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

/**
 * 만 원 단위 숫자를 입력받아 원화 표기 보조 텍스트 생성
 */
function formatWon(value: number | null | undefined): string {
  if (!value) return "";
  if (value >= 10000) return `약 ${(value / 10000).toFixed(1)}억 원`;
  return `${value.toLocaleString()}만 원`;
}

export function IncomeAssetsTab({
  data,
  onChange,
}: IncomeAssetsTabProps): React.ReactElement {
  const handleNumber = (
    field: keyof ProfileFormData,
    raw: string
  ): void => {
    onChange(field, raw ? parseInt(raw, 10) : null);
  };

  return (
    <div className="space-y-6">
      {/* 월 소득 */}
      <div className="space-y-2">
        <Label htmlFor="monthlyIncome">월 소득 (만 원)</Label>
        <Input
          id="monthlyIncome"
          name="monthlyIncome"
          type="number"
          min={0}
          placeholder="300"
          value={data.monthlyIncome ?? ""}
          onChange={(e) => handleNumber("monthlyIncome", e.target.value)}
        />
        {data.monthlyIncome && (
          <p className="text-sm text-muted-foreground">
            {formatWon(data.monthlyIncome)}
          </p>
        )}
      </div>

      {/* 총 자산 */}
      <div className="space-y-2">
        <Label htmlFor="totalAssets">총 자산 (만 원)</Label>
        <Input
          id="totalAssets"
          name="totalAssets"
          type="number"
          min={0}
          placeholder="5000"
          value={data.totalAssets ?? ""}
          onChange={(e) => handleNumber("totalAssets", e.target.value)}
        />
        {data.totalAssets && (
          <p className="text-sm text-muted-foreground">
            {formatWon(data.totalAssets)}
          </p>
        )}
      </div>

      {/* 차량 가액 */}
      <div className="space-y-2">
        <Label htmlFor="carValue">차량 가액 (만 원)</Label>
        <Input
          id="carValue"
          name="carValue"
          type="number"
          min={0}
          placeholder="2000"
          value={data.carValue ?? ""}
          onChange={(e) => handleNumber("carValue", e.target.value)}
        />
        {data.carValue && (
          <p className="text-sm text-muted-foreground">
            {formatWon(data.carValue)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          차량이 없으면 0을 입력하세요.
        </p>
      </div>
    </div>
  );
}
