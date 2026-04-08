"use client";
import React from "react";

// 주거 조건 탭: 무주택기간, 청약통장 유형/가입일/납입횟수

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

interface HousingTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

export function HousingTab({ data, onChange }: HousingTabProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* 무주택 기간 */}
      <div className="space-y-2">
        <Label htmlFor="homelessMonths">무주택 기간 (개월)</Label>
        <Input
          id="homelessMonths"
          name="homelessMonths"
          type="number"
          min={0}
          placeholder="24"
          value={data.homelessMonths ?? ""}
          onChange={(e) =>
            onChange(
              "homelessMonths",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
        {data.homelessMonths != null && (
          <p className="text-sm text-muted-foreground">
            약 {Math.floor(data.homelessMonths / 12)}년{" "}
            {data.homelessMonths % 12}개월
          </p>
        )}
      </div>

      {/* 청약통장 유형 */}
      <div className="space-y-2">
        <Label htmlFor="subscriptionType">청약통장 유형</Label>
        <Select
          name="subscriptionType"
          value={data.subscriptionType ?? ""}
          onValueChange={(v) => onChange("subscriptionType", v)}
        >
          <SelectTrigger id="subscriptionType">
            <SelectValue placeholder="선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">청약저축 (일반공급)</SelectItem>
            <SelectItem value="FIRST_TIME">주택청약종합저축</SelectItem>
            <SelectItem value="NONE">없음</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 청약 가입일 */}
      {data.subscriptionType && data.subscriptionType !== "NONE" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="subscriptionStart">청약통장 가입일</Label>
            <Input
              id="subscriptionStart"
              name="subscriptionStart"
              type="date"
              value={data.subscriptionStart ?? ""}
              onChange={(e) =>
                onChange("subscriptionStart", e.target.value)
              }
            />
          </div>

          {/* 납입 횟수 */}
          <div className="space-y-2">
            <Label htmlFor="subscriptionPayments">납입 횟수 (회)</Label>
            <Input
              id="subscriptionPayments"
              name="subscriptionPayments"
              type="number"
              min={0}
              placeholder="24"
              value={data.subscriptionPayments ?? ""}
              onChange={(e) =>
                onChange(
                  "subscriptionPayments",
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
