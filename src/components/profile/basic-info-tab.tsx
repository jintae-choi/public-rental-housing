"use client";
import React from "react";

// 기본 정보 탭: 이름, 생년월일, 혼인상태, 가구원수, 세대주 여부

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfileFormData } from "@/types/profile";
import { HOUSEHOLD_TYPES } from "@/types/profile";

interface BasicInfoTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

export function BasicInfoTab({ data, onChange }: BasicInfoTabProps): React.ReactElement {
  // 가구 유형 체크박스 토글 처리
  const handleHouseholdTypeToggle = (type: string): void => {
    const current = data.householdTypes ?? [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange("householdTypes", updated);
  };

  return (
    <div className="space-y-6">
      {/* 이름 */}
      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          name="name"
          placeholder="홍길동"
          value={data.name ?? ""}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </div>

      {/* 생년월일 */}
      <div className="space-y-2">
        <Label htmlFor="birthDate">생년월일</Label>
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          value={data.birthDate ?? ""}
          onChange={(e) => onChange("birthDate", e.target.value)}
        />
      </div>

      {/* 혼인 상태 */}
      <div className="space-y-2">
        <Label htmlFor="maritalStatus">혼인 상태</Label>
        <Select
          name="maritalStatus"
          value={data.maritalStatus ?? ""}
          onValueChange={(v) => onChange("maritalStatus", v)}
        >
          <SelectTrigger id="maritalStatus">
            <SelectValue placeholder="선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SINGLE">미혼</SelectItem>
            <SelectItem value="MARRIED">기혼</SelectItem>
            <SelectItem value="DIVORCED">이혼</SelectItem>
            <SelectItem value="WIDOWED">사별</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 예비 혼인 예정일 (SINGLE일 때 선택적으로 표시 가능) */}
      {data.maritalStatus === "SINGLE" && (
        <div className="space-y-2">
          <Label htmlFor="plannedMarriageDate">예정 혼인일 (예비신혼부부)</Label>
          <Input
            id="plannedMarriageDate"
            name="plannedMarriageDate"
            type="date"
            value={data.plannedMarriageDate ?? ""}
            onChange={(e) => onChange("plannedMarriageDate", e.target.value)}
          />
        </div>
      )}

      {/* 가구원 수 */}
      <div className="space-y-2">
        <Label htmlFor="householdMembers">가구원 수</Label>
        <Input
          id="householdMembers"
          name="householdMembers"
          type="number"
          min={1}
          max={20}
          placeholder="1"
          value={data.householdMembers ?? ""}
          onChange={(e) =>
            onChange(
              "householdMembers",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
      </div>

      {/* 세대주 여부 */}
      <div className="flex items-center gap-3">
        <input
          id="isHouseholder"
          name="isHouseholder"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={data.isHouseholder ?? false}
          onChange={(e) => onChange("isHouseholder", e.target.checked)}
        />
        <Label htmlFor="isHouseholder">세대주임</Label>
      </div>

      {/* 가구 유형 (다중 선택) */}
      <div className="space-y-2">
        <Label>가구 유형 (해당 항목 모두 선택)</Label>
        <div className="flex flex-wrap gap-2">
          {HOUSEHOLD_TYPES.map((type) => {
            const selected = (data.householdTypes ?? []).includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleHouseholdTypeToggle(type)}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
        {/* 숨겨진 input들 — FormData 전송용 */}
        {(data.householdTypes ?? []).map((type) => (
          <input key={type} type="hidden" name="householdTypes" value={type} />
        ))}
      </div>

      {/* 주소 */}
      <div className="space-y-2">
        <Label htmlFor="address">현재 주소</Label>
        <Input
          id="address"
          name="address"
          placeholder="서울특별시 강남구..."
          value={data.address ?? ""}
          onChange={(e) => onChange("address", e.target.value)}
        />
      </div>

      {/* 이메일 */}
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="example@email.com"
          value={data.email ?? ""}
          onChange={(e) => onChange("email", e.target.value)}
        />
      </div>
    </div>
  );
}
