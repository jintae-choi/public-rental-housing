"use client";
import React from "react";

// 알림 설정 탭: 알림 활성화, 알림 레벨, 빈도, 마감 리마인더 일수

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfileFormData } from "@/types/profile";

interface NotificationTabProps {
  data: Partial<ProfileFormData>;
  onChange: (field: keyof ProfileFormData, value: unknown) => void;
}

// 마감 리마인더 선택지 (일 전)
const REMINDER_DAY_OPTIONS = [7, 3, 1, 0] as const;

export function NotificationTab({
  data,
  onChange,
}: NotificationTabProps): React.ReactElement {
  // 리마인더 일수 토글 처리
  const handleReminderToggle = (day: number): void => {
    const current = data.deadlineReminderDays ?? [3, 1, 0];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => b - a);
    onChange("deadlineReminderDays", updated);
  };

  return (
    <div className="space-y-6">
      {/* 알림 활성화 토글 */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">알림 활성화</p>
          <p className="text-sm text-muted-foreground">
            자격 조건에 맞는 공고가 등록되면 이메일로 알림을 받습니다.
          </p>
        </div>
        <input
          id="notificationEnabled"
          name="notificationEnabled"
          type="checkbox"
          className="h-5 w-5 rounded border-gray-300"
          checked={data.notificationEnabled ?? false}
          onChange={(e) => onChange("notificationEnabled", e.target.checked)}
        />
      </div>

      {/* 알림이 활성화된 경우에만 세부 설정 표시 */}
      {data.notificationEnabled && (
        <>
          {/* 알림 레벨 */}
          <div className="space-y-2">
            <Label htmlFor="notificationLevel">알림 기준</Label>
            <Select
              name="notificationLevel"
              value={data.notificationLevel ?? "ELIGIBLE_ONLY"}
              onValueChange={(v) => onChange("notificationLevel", v)}
            >
              <SelectTrigger id="notificationLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ELIGIBLE_ONLY">
                  자격 충족 공고만 (권장)
                </SelectItem>
                <SelectItem value="ELIGIBLE_AND_CHECK">
                  자격 충족 + 확인 필요 공고
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 알림 빈도 */}
          <div className="space-y-2">
            <Label htmlFor="notificationFrequency">알림 빈도</Label>
            <Select
              name="notificationFrequency"
              value={data.notificationFrequency ?? "IMMEDIATE"}
              onValueChange={(v) => onChange("notificationFrequency", v)}
            >
              <SelectTrigger id="notificationFrequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IMMEDIATE">즉시 알림</SelectItem>
                <SelectItem value="DAILY_SUMMARY">하루 1회 요약</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 마감 리마인더 */}
          <div className="space-y-2">
            <Label>마감 리마인더 (선택)</Label>
            <p className="text-sm text-muted-foreground">
              청약 마감 며칠 전에 알림을 받을지 선택하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_DAY_OPTIONS.map((day) => {
                const selected = (
                  data.deadlineReminderDays ?? [3, 1, 0]
                ).includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleReminderToggle(day)}
                    className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {day === 0 ? "당일" : `${day}일 전`}
                  </button>
                );
              })}
            </div>
            {/* FormData 전송용 숨겨진 input */}
            {(data.deadlineReminderDays ?? []).map((day) => (
              <input
                key={day}
                type="hidden"
                name="deadlineReminderDays"
                value={day}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
