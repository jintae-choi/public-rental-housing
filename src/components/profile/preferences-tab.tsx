"use client";
import React from "react";

// 선호 조건 탭: 관심지역, 희망면적, 근무지, 통근시간, 보증금/월세 한도

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { REGIONS } from "@/types/profile";
import type { ProfileFormData } from "@/types/profile";

interface PreferencesTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

export function PreferencesTab({
  data,
  onChange,
}: PreferencesTabProps): React.ReactElement {
  // 관심 지역 토글 처리
  const handleRegionToggle = (region: string): void => {
    const current = data.interestedRegions ?? [];
    const updated = current.includes(region)
      ? current.filter((r) => r !== region)
      : [...current, region];
    onChange("interestedRegions", updated);
  };

  return (
    <div className="space-y-6">
      {/* 관심 지역 다중 선택 */}
      <div className="space-y-2">
        <Label>관심 지역 (복수 선택 가능)</Label>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((region) => {
            const selected = (data.interestedRegions ?? []).includes(region);
            return (
              <button
                key={region}
                type="button"
                onClick={() => handleRegionToggle(region)}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {region}
              </button>
            );
          })}
        </div>
        {/* FormData 전송용 숨겨진 input */}
        {(data.interestedRegions ?? []).map((region) => (
          <input
            key={region}
            type="hidden"
            name="interestedRegions"
            value={region}
          />
        ))}
      </div>

      {/* 희망 면적 범위 */}
      <div className="space-y-2">
        <Label>희망 면적 (㎡)</Label>
        <div className="flex items-center gap-2">
          <Input
            name="preferredAreaMin"
            type="number"
            min={0}
            placeholder="30"
            value={data.preferredAreaMin ?? ""}
            onChange={(e) =>
              onChange(
                "preferredAreaMin",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
            className="w-28"
          />
          <span className="text-muted-foreground">~</span>
          <Input
            name="preferredAreaMax"
            type="number"
            min={0}
            placeholder="85"
            value={data.preferredAreaMax ?? ""}
            onChange={(e) =>
              onChange(
                "preferredAreaMax",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
            className="w-28"
          />
          <span className="text-muted-foreground text-sm">㎡</span>
        </div>
      </div>

      {/* 근무지 */}
      <div className="space-y-2">
        <Label htmlFor="workplace">근무지 주소</Label>
        <Input
          id="workplace"
          name="workplace"
          placeholder="서울특별시 강남구..."
          value={data.workplace ?? ""}
          onChange={(e) => onChange("workplace", e.target.value)}
        />
      </div>

      {/* 최대 통근 시간 */}
      <div className="space-y-2">
        <Label htmlFor="maxCommuteMinutes">최대 통근 시간 (분)</Label>
        <Input
          id="maxCommuteMinutes"
          name="maxCommuteMinutes"
          type="number"
          min={0}
          max={300}
          placeholder="60"
          value={data.maxCommuteMinutes ?? ""}
          onChange={(e) =>
            onChange(
              "maxCommuteMinutes",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
      </div>

      {/* 최대 보증금 */}
      <div className="space-y-2">
        <Label htmlFor="maxDeposit">최대 보증금 (만 원)</Label>
        <Input
          id="maxDeposit"
          name="maxDeposit"
          type="number"
          min={0}
          placeholder="5000"
          value={data.maxDeposit ?? ""}
          onChange={(e) =>
            onChange(
              "maxDeposit",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
      </div>

      {/* 최대 월세 */}
      <div className="space-y-2">
        <Label htmlFor="maxMonthlyRent">최대 월세 (만 원)</Label>
        <Input
          id="maxMonthlyRent"
          name="maxMonthlyRent"
          type="number"
          min={0}
          placeholder="50"
          value={data.maxMonthlyRent ?? ""}
          onChange={(e) =>
            onChange(
              "maxMonthlyRent",
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
        />
      </div>
    </div>
  );
}
