"use client";
import React from "react";

// 기본 정보 탭: 이름, 생년월일, 세대주 여부, 주소, 이메일
// Phase 3: householdTypes, maritalStatus, plannedMarriageDate, householdMembers는 ScenarioFormData로 이관

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProfileFormData } from "@/types/profile";

interface BasicInfoTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

export function BasicInfoTab({ data, onChange }: BasicInfoTabProps): React.ReactElement {
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
