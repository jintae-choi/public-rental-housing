"use client";
import React from "react";

// 배우자 정보 탭: 혼인 상태가 MARRIED일 때만 의미 있는 필드

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProfileFormData } from "@/types/profile";

interface SpouseTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

export function SpouseTab({ data, onChange }: SpouseTabProps): React.ReactElement {
  // MARRIED가 아니면 안내 메시지 표시
  if (data.maritalStatus !== "MARRIED") {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        기본 정보 탭에서 혼인 상태를 &quot;기혼&quot;으로 선택하면 배우자 정보를 입력할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 배우자 생년월일 */}
      <div className="space-y-2">
        <Label htmlFor="spouseBirthDate">배우자 생년월일</Label>
        <Input
          id="spouseBirthDate"
          name="spouseBirthDate"
          type="date"
          value={data.spouseBirthDate ?? ""}
          onChange={(e) => onChange("spouseBirthDate", e.target.value)}
        />
      </div>

      {/* 배우자 소득 */}
      <div className="space-y-2">
        <Label htmlFor="spouseIncome">배우자 월 소득 (만 원)</Label>
        <Input
          id="spouseIncome"
          name="spouseIncome"
          type="number"
          min={0}
          placeholder="200"
          value={data.spouseIncome ?? ""}
          onChange={(e) =>
            onChange(
              "spouseIncome",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
      </div>

      {/* 배우자 자산 */}
      <div className="space-y-2">
        <Label htmlFor="spouseAssets">배우자 자산 (만 원)</Label>
        <Input
          id="spouseAssets"
          name="spouseAssets"
          type="number"
          min={0}
          placeholder="3000"
          value={data.spouseAssets ?? ""}
          onChange={(e) =>
            onChange(
              "spouseAssets",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
      </div>

      {/* 배우자 근무지 */}
      <div className="space-y-2">
        <Label htmlFor="spouseWorkplace">배우자 근무지</Label>
        <Input
          id="spouseWorkplace"
          name="spouseWorkplace"
          placeholder="서울특별시 마포구..."
          value={data.spouseWorkplace ?? ""}
          onChange={(e) => onChange("spouseWorkplace", e.target.value)}
        />
      </div>
    </div>
  );
}
